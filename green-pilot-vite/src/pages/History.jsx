import React, { useEffect, useState } from 'react';
import axios from 'axios';
import JobCard from '../components/JobCard';
import '../App.css'; 

const JobHistory = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentCarbon, setCurrentCarbon] = useState(null);
  const [predictedCarbon, setPredictedCarbon] = useState(null);
  const [carbonSaved, setCarbonSaved] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5050/api/jobs/my-jobs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setJobs(res.data.jobs);
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchCarbonStats = async () => {
      try {
        const currentRes = await axios.get('https://api.electricitymap.org/v3/carbon-intensity/latest?zone=IN-WE', {
          headers: { 'auth-token': 'aSnF6p8GDqmjIc58PViJ' }
        });
        const predictRes = await axios.post('http://localhost:8000/predict', { duration: 1 });

        const current = currentRes.data.carbonIntensity;
        const predicted = predictRes.data.predicted_intensity;

        setCurrentCarbon(current);
        setPredictedCarbon(predicted);

        const savedPercent = ((current - predicted) / current) * 100;
        setCarbonSaved(savedPercent.toFixed(2));
      } catch (err) {
        console.error('Failed to fetch carbon stats:', err);
      }
    };

    fetchJobs();
    fetchCarbonStats();
  }, []);

  if (loading) return <div className="center-text pad-top">Loading job history...</div>;

  return (
    <div className="job-history-container">
      <h2 className="section-title">Your Job History</h2>

      {currentCarbon && predictedCarbon && (
        <div className="carbon-stats">
          <p><strong>Current Carbon Intensity:</strong> {currentCarbon} gCO₂eq/kWh</p>
          <p><strong>Predicted Best Time Intensity:</strong> {predictedCarbon} gCO₂eq/kWh</p>
          <p><strong>Estimated Carbon Saved:</strong> {carbonSaved}%</p>
        </div>
      )}

      {jobs.length === 0 ? (
        <p>No jobs scheduled yet.</p>
      ) : (
        <div className="job-grid">
          {jobs.map((job) => (
            <JobCard key={job._id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
};

export default JobHistory;
