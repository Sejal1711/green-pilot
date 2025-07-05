import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import "../App.css";

const Home = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [carbonSaved, setCarbonSaved] = useState(null);

  useEffect(() => {
    const fetchCarbonStats = async () => {
      try {
        const currentRes = await fetch("https://api.electricitymap.org/v3/carbon-intensity/latest?zone=IN-WE", {
          headers: { "auth-token": "uJNaG5zxCwFMKgf3A7zg" }
        });
        const predictRes = await fetch("http://localhost:8000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration: 1 })
        });

        const currentData = await currentRes.json();
        const predictData = await predictRes.json();

        const current = currentData.carbonIntensity;
        const predicted = predictData.predicted_intensity;
        const saved = ((current - predicted) / current) * 100;

        setCarbonSaved(saved.toFixed(2));
      } catch (err) {
        console.error("Failed to fetch carbon stats", err);
      }
    };

    fetchCarbonStats();
  }, []);

  return (
    <div className="home-container">
      <h1 className="home-title">Welcome, {user?.name || "User"} 👋</h1>

      <div className="stat-grid">
        <StatCard
          title="Estimated Savings"
          value={`${carbonSaved || "--"}%`}
          description="Compared to current carbon intensity"
        />
      </div>
      

      <div className="action-buttons">
        <button className="primary-btn" onClick={() => navigate("/create-job")}>Create New Job</button>
        <button className="secondary-btn" onClick={() => navigate("/job-history")}>View Job History</button>
      </div>

      <div>
        <p className="intro">
          🌱 Green Pilot is a smart job-scheduling assistant designed to help developers and organizations reduce their carbon footprint.
By analyzing real-time and historical carbon intensity data, it recommends the most environmentally friendly time to schedule compute-heavy jobs.
Just log in, upload your script, and Green Pilot suggests the optimal time slot—so you can run your jobs with maximum efficiency and minimal environmental impact.
        <p>
          Just upload your script → get a low-carbon time slot → and help reduce your digital carbon footprint 💻🌍
        </p>
        </p>
      </div>
    </div>
    
  );
};

export default Home;
