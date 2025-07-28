from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from prophet import Prophet
from xgboost import XGBRegressor
from sklearn.metrics import mean_squared_error
from datetime import timedelta
from pathlib import Path
import httpx
import os
from dotenv import load_dotenv
from math import sqrt
import warnings

warnings.filterwarnings("ignore")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
API_TOKEN = os.getenv("ELECTRICITY_MAPS_API_TOKEN")

# Config
ZONE = "IN-WE"
CSV_FILENAME = "IN-WE_hourly.csv"
CSV_PATH = os.path.join("/app/app", CSV_FILENAME)


HISTORICAL_HOURS = 90 * 24

# ---------------------- Fetch + Update CSV ---------------------- #

async def fetch_and_update_history(csv_path: str) -> pd.DataFrame:
    if os.path.exists(csv_path):
        df_existing = pd.read_csv(csv_path, parse_dates=['Datetime (UTC)'])
        last_timestamp = df_existing['Datetime (UTC)'].max().tz_localize(None)
    else:
        df_existing = pd.DataFrame()
        last_timestamp = None

    end = pd.Timestamp.utcnow().floor('h').tz_localize(None)
    start = end - pd.Timedelta(hours=HISTORICAL_HOURS) if last_timestamp is None else last_timestamp + pd.Timedelta(hours=1)

    if last_timestamp is not None and start >= end:
        return df_existing

    url = "https://api.electricitymap.org/v3/carbon-intensity/history"
    headers = {"auth-token": API_TOKEN}
    params = {"zone": ZONE, "start": start.isoformat(), "end": end.isoformat()}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json().get("history", [])

    if not data:
        return df_existing

    df_new = pd.DataFrame([
        {
            "Datetime (UTC)": pd.to_datetime(item["datetime"]).tz_localize(None),
            "Carbon intensity gCO₂eq/kWh (direct)": item.get("carbonIntensity"),
            "Zone": ZONE
        } for item in data
    ]).dropna()

    df_combined = pd.concat([df_existing, df_new], ignore_index=True).drop_duplicates(subset=['Datetime (UTC)'])
    df_combined = df_combined.sort_values(by='Datetime (UTC)')
    df_combined.to_csv(csv_path, index=False)
    return df_combined

# ---------------------- Fetch Current Intensity ---------------------- #

async def fetch_current_intensity() -> float:
    url = f"https://api.electricitymap.org/v3/carbon-intensity/latest?zone={ZONE}"
    headers = {"auth-token": API_TOKEN}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    return data["carbonIntensity"]

# ---------------------- Prediction Endpoint ---------------------- #

class PredictRequest(BaseModel):
    duration: int = 1

@app.post("/predict")
async def predict_best_time(payload: PredictRequest):
    try:
        duration = max(1, min(payload.duration, 24))

        # Update CSV with latest history
        df = await fetch_and_update_history(CSV_PATH)
        df = df.rename(columns={
            "Datetime (UTC)": "datetime",
            "Carbon intensity gCO₂eq/kWh (direct)": "carbon_intensity"
        })[['datetime', 'carbon_intensity']]

        df['datetime'] = pd.to_datetime(df['datetime'])
        df = df.sort_values('datetime')

        # Feature engineering
        df['hour'] = df['datetime'].dt.hour
        df['dayofweek'] = df['datetime'].dt.dayofweek
        df['month'] = df['datetime'].dt.month
        df['day'] = df['datetime'].dt.day
        df['is_weekend'] = df['dayofweek'] >= 5
        df['is_peak'] = df['hour'].between(18, 22)

        df['lag_1'] = df['carbon_intensity'].shift(1)
        df['lag_3'] = df['carbon_intensity'].shift(3)
        df['rolling_6'] = df['carbon_intensity'].rolling(6).mean()
        df['rolling_12'] = df['carbon_intensity'].rolling(12).mean()
        df = df.dropna().reset_index(drop=True)

        if df.empty or len(df) < 24:
            raise ValueError("Not enough data to predict reliably.")

        # Split into train + future
        now = pd.Timestamp.utcnow().floor('h').tz_localize(None)
        future_dates = pd.date_range(start=now + pd.Timedelta(hours=1), periods=12, freq='H')
        train_df = df[df['datetime'] < now]

        # Prophet
        prophet_df = train_df[['datetime', 'carbon_intensity']].rename(columns={'datetime': 'ds', 'carbon_intensity': 'y'})
        prophet_model = Prophet(daily_seasonality=True, yearly_seasonality=True, weekly_seasonality=True)
        prophet_model.fit(prophet_df)
        future_df = pd.DataFrame({'ds': future_dates})
        prophet_pred = prophet_model.predict(future_df)['yhat'].values

        # XGBoost
        features = ['hour', 'dayofweek', 'month', 'day', 'is_weekend', 'is_peak', 'lag_1', 'lag_3', 'rolling_6', 'rolling_12']
        future_features = pd.DataFrame({'datetime': future_dates})
        future_features['hour'] = future_features['datetime'].dt.hour
        future_features['dayofweek'] = future_features['datetime'].dt.dayofweek
        future_features['month'] = future_features['datetime'].dt.month
        future_features['day'] = future_features['datetime'].dt.day
        future_features['is_weekend'] = future_features['dayofweek'] >= 5
        future_features['is_peak'] = future_features['hour'].between(18, 22)

        latest = df.iloc[-1]
        future_features['lag_1'] = latest['carbon_intensity']
        future_features['lag_3'] = latest['carbon_intensity']
        future_features['rolling_6'] = latest['carbon_intensity']
        future_features['rolling_12'] = latest['carbon_intensity']
        future_features = future_features[features]

        xgb_model = XGBRegressor(n_estimators=100, learning_rate=0.1)
        xgb_model.fit(train_df[features], train_df['carbon_intensity'])
        xgb_pred = xgb_model.predict(future_features)

        # Ensemble
        ensemble_pred = []
        for i in range(len(future_dates)):
            hour = future_dates[i].hour
            weight = 0.7 if 0 <= hour < 6 else 0.3
            combined = weight * prophet_pred[i] + (1 - weight) * xgb_pred[i]
            ensemble_pred.append(combined)

        ensemble_pred = pd.Series(ensemble_pred, index=future_dates)

        smoothed = ensemble_pred.ewm(span=3).mean()
        rolling = smoothed.rolling(duration).mean().dropna()

        best_time = rolling.idxmin()
        predicted_intensity = rolling.min()
        current_intensity = await fetch_current_intensity()
        savings = max(0, current_intensity - predicted_intensity)

        decision = "Run now" if current_intensity <= predicted_intensity else "Wait for suggested time"

        return {
            "best_time": best_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            "predicted_intensity": round(predicted_intensity, 2),
            "current_intensity": round(current_intensity, 2),
            "savings": round(savings, 2),
            "recommendation": decision
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)} 