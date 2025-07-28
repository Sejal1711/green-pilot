import os
import requests
import pandas as pd
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, Form, File
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from dotenv import load_dotenv
from xgboost import XGBRegressor
from prophet import Prophet
import numpy as np

app = FastAPI()
templates = Jinja2Templates(directory="app/templates")

load_dotenv()
EM_API_TOKEN = os.getenv("ELECTRICITY_MAPS_API_TOKEN")

csv_path = "data/IN-WE_hourly.csv"  # ← This must be writable


def fetch_and_update_history():
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    past_90_days = now - timedelta(days=90)

    url = f"https://api.electricitymap.org/v3/power-breakdown/history?zone=IN-WE&start={past_90_days.isoformat()}&end={now.isoformat()}"
    headers = {"auth-token": EM_API_TOKEN}
    response = requests.get(url, headers=headers)
    data = response.json()["history"]

    df_new = pd.DataFrame([{
        "Datetime (UTC)": datetime.strptime(point["datetime"], "%Y-%m-%dT%H:%M:%SZ"),
        "Carbon Intensity": point["carbonIntensity"]
    } for point in data])

    if os.path.exists(csv_path):
        df_existing = pd.read_csv(csv_path)
        df_existing["Datetime (UTC)"] = pd.to_datetime(df_existing["Datetime (UTC)"])
    else:
        df_existing = pd.DataFrame(columns=["Datetime (UTC)", "Carbon Intensity"])

    df_combined = pd.concat([df_existing, df_new], ignore_index=True).drop_duplicates(subset=["Datetime (UTC)"])
    df_combined = df_combined.sort_values(by="Datetime (UTC)")

    # ✅ Ensure directory exists before saving
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)

    df_combined.to_csv(csv_path, index=False)
    return df_combined


def create_features(df):
    df["hour"] = df["Datetime (UTC)"].dt.hour
    df["dayofweek"] = df["Datetime (UTC)"].dt.dayofweek
    df["lag_3"] = df["Carbon Intensity"].shift(3)
    df["lag_6"] = df["Carbon Intensity"].shift(6)
    df["rolling_12hr"] = df["Carbon Intensity"].rolling(window=12).mean()
    df["exp_smooth"] = df["Carbon Intensity"].ewm(alpha=0.3).mean()
    df = df.dropna()
    return df


def train_xgb_model(df):
    df = create_features(df)
    X = df[["hour", "dayofweek", "lag_3", "lag_6", "rolling_12hr", "exp_smooth"]]
    y = df["Carbon Intensity"]
    model = XGBRegressor()
    model.fit(X, y)
    return model


def forecast_next_24_hours_xgb(model, df):
    future_times = [df["Datetime (UTC)"].max() + timedelta(hours=i + 1) for i in range(24)]
    last_row = df.iloc[-1].copy()
    future_df = pd.DataFrame({
        "Datetime (UTC)": future_times,
        "hour": [dt.hour for dt in future_times],
        "dayofweek": [dt.dayofweek for dt in future_times],
    })

    # For lag and rolling features, assume values remain stable for next hours
    future_df["lag_3"] = last_row["Carbon Intensity"]
    future_df["lag_6"] = last_row["Carbon Intensity"]
    future_df["rolling_12hr"] = df["Carbon Intensity"].rolling(window=12).mean().iloc[-1]
    future_df["exp_smooth"] = df["Carbon Intensity"].ewm(alpha=0.3).mean().iloc[-1]

    X_future = future_df[["hour", "dayofweek", "lag_3", "lag_6", "rolling_12hr", "exp_smooth"]]
    preds = model.predict(X_future)
    future_df["Predicted Intensity"] = preds
    return future_df


def forecast_prophet(df):
    prophet_df = df.rename(columns={"Datetime (UTC)": "ds", "Carbon Intensity": "y"})
    model = Prophet()
    model.fit(prophet_df)
    future = model.make_future_dataframe(periods=24, freq='H')
    forecast = model.predict(future)
    return forecast[["ds", "yhat"]].tail(24)


@app.post("/predict")
async def predict(file: UploadFile = File(...), job_name: str = Form(...)):
    df_history = fetch_and_update_history()

    xgb_model = train_xgb_model(df_history)
    xgb_forecast = forecast_next_24_hours_xgb(xgb_model, df_history)

    prophet_forecast = forecast_prophet(df_history)

    # Merge forecasts
    merged = xgb_forecast.copy()
    merged["Prophet Prediction"] = prophet_forecast["yhat"].values
    merged["Average Intensity"] = merged[["Predicted Intensity", "Prophet Prediction"]].mean(axis=1)

    best_row = merged.loc[merged["Average Intensity"].idxmin()]
    best_time = best_row["Datetime (UTC)"].strftime("%Y-%m-%d %H:%M:%S")
    predicted_intensity = best_row["Average Intensity"]

    file_location = f"app/uploads/{file.filename}"
    os.makedirs(os.path.dirname(file_location), exist_ok=True)
    with open(file_location, "wb") as f:
        f.write(await file.read())

    return {
        "job_name": job_name,
        "best_time_to_run": best_time,
        "predicted_intensity": round(predicted_intensity, 2),
        "carbon_savings_percent": round(100 * (merged["Average Intensity"].max() - predicted_intensity) / merged["Average Intensity"].max(), 2)
    }


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
