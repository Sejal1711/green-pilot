import React, { useState } from "react";
import "../App.css";

const CreateJob = () => {
  const [form, setForm] = useState({
    jobName: "",
    description: "",
  });
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("jobName", form.jobName);
      formData.append("description", form.description);
      formData.append("script", file);

      const res = await fetch("http://localhost:5050/api/jobs/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Job creation failed");
      }

      setResult(data.job);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-job-container">
      <h2 className="section-title">Create New Job</h2>
      <form onSubmit={handleSubmit} className="create-job-form">
        <input
          type="text"
          name="jobName"
          value={form.jobName}
          onChange={handleChange}
          placeholder="Job Name"
          required
        />
        <input
          type="text"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Description"
        />
        <input
          type="file"
          name="script"
          accept="*/*"
          onChange={handleFileChange}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Scheduling..." : "Create Job"}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <div className="result-card">
          <h3>✅ Job Scheduled Successfully</h3>
          <p><strong>Job Name:</strong> {result.jobName}</p>
          <p><strong>Current Time:</strong> {new Date().toLocaleString()}</p><p/>
          <p><strong>Suggested Time to run the job:</strong> {new Date(result.scheduledTime).toLocaleString()}</p>
          <p><strong>Predicted Intensity:</strong> {result.carbonIntensity} gCO₂eq/kWh</p>
          <p><strong>Status:</strong> {result.status}</p>
          <p><strong>Output:</strong> <pre className="job-output">🎉 Your script is scheduled at the optimal time to reduce carbon footprint.
 </pre></p>
        </div>
      )}
    </div>
  );
};

export default CreateJob;
