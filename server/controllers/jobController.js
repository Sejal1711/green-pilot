const Job = require("../models/Job");
const axios = require("axios");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const createJob = async (req, res) => {
  try {
    const { jobName, description } = req.body;
    const userId = req.user.id;
    const scriptFile = req.file;

    if (!jobName || !description || !scriptFile) {
      return res.status(400).json({
        success: false,
        message: "Missing job name, description, or file",
      });
    }

    const scriptPath = path.resolve(scriptFile.path);
    const ext = path.extname(scriptPath).toLowerCase();

    const predictionRes = await axios.post("http://localhost:8000/predict", {
      duration: 1,
    });

    const { best_time, predicted_intensity, current_intensity } = predictionRes.data;
    const carbonSaved = Math.max(current_intensity - predicted_intensity, 0); // ✅ Add this

    let command = "";
    switch (ext) {
      case ".js":
        command = `node "${scriptPath}"`;
        break;
      case ".py":
        command = `python "${scriptPath}"`;
        break;
      case ".cpp":
        const exePath = path.join(path.dirname(scriptPath), "a.out");
        command = `g++ "${scriptPath}" -o "${exePath}" && "${exePath}"`;
        break;
      case ".sh":
        command = `bash "${scriptPath}"`;
        break;
      case ".ts":
        command = `ts-node "${scriptPath}"`;
        break;
      default:
        const job = new Job({
          userId,
          jobName,
          description,
          region: "IN-WE",
          scheduledTime: best_time,
          scriptPath,
          carbonIntensity: predicted_intensity,
          currentIntensity: current_intensity,
          carbonSaved,
          output: `File type ${ext} is not executable. Saved but not run.`,
          status: "not-executed",
        });

        await job.save();
        return res.status(201).json({
          success: true,
          job,
          message: "Job saved (non-executable file).",
        });
    }

    exec(command, async (error, stdout, stderr) => {
      try {
        const isFailed = error && error.code !== 0;

const job = new Job({
  userId,
  jobName,
  description,
  region: "IN-WE",
  scheduledTime: best_time,
  scriptPath,
  carbonIntensity: predicted_intensity,
  currentIntensity: current_intensity,
  carbonSaved,
  output: stdout + stderr,
  status: isFailed ? "failed" : "completed",
});

console.log("Saving job:", job);
        await job.save();
        console.log(" Job saved successfully");

        res.status(201).json({
          success: true,
          job,
          message: error ? "Script failed" : "Job completed successfully",
        });
      } catch (dbErr) {
        res.status(500).json({
          success: false,
          message: "Error saving job to database",
          error: dbErr.message,
        });
      }
    });
  } catch (err) {
    console.error(" Job creation error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating job",
      error: err.message,
    });
  }
};


const getUserJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({
      error: "Error fetching jobs",
      details: err.message,
    });
  }
};


const getUserStats = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id || req.user.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID not found in request" });
    }

   
    const jobs = await Job.find({ userId: new mongoose.Types.ObjectId(userId) });

    const totalJobs = jobs.length;
    const totalSaved = jobs.reduce((sum, job) => sum + (job.carbonSaved || 0), 0);
    const avgSaved = totalJobs > 0 ? totalSaved / totalJobs : 0;

    res.status(200).json({
      success: true,
      totalJobs,
      totalSaved: parseFloat(totalSaved.toFixed(2)),
      avgSaved: parseFloat(avgSaved.toFixed(2))
    });

  } catch (err) {
    console.error("Error in getUserStats:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      error: err.message
    });
  }
};

module.exports = { getUserStats };


module.exports = {
  createJob,
  getUserJobs,
  getUserStats,
};
