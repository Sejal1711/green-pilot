import React, { useEffect, useState } from 'react';
import '../App.css'; 

const StatCard = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch("http://localhost:5050/api/jobs/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats", error);
      }
    };

    fetchStats();
  }, []);

  if (!stats) return <div className="center-text">Loading statistics...</div>;

  return (
    <div className="stat-card">
      <h2 className="stat-title">🌱 Your Carbon Savings</h2>
      <p><strong>Total Jobs:</strong> {stats.totalJobs}</p>
      <p><strong>Total Carbon Saved:</strong> {stats.totalSaved} gCO₂eq</p>
      <p><strong>Avg Carbon Saved Per Job:</strong> {stats.avgSaved} gCO₂eq</p>
    </div>
  );
};

export default StatCard;
