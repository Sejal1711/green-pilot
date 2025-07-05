import React from 'react';
import '../App.css';

const JobCard = ({ job }) => {
  return (
    <div className="job-card">
      <h3 className="job-title">{job.jobName}</h3>
      <p><strong>Status:</strong> {job.status}</p>
      <p><strong>Suggested Time to run the job:</strong> {new Date(job.scheduledTime).toLocaleString()}</p>
      <p><strong>Carbon Intensity:</strong> {job.carbonIntensity} gCO₂eq/kWh</p>
      <p><strong>Region:</strong> {job.region}</p>
      
      
      <p><strong>Output:</strong> <pre className="job-output">{job.output}</pre></p>
    </div>
  );
};

export default JobCard;
