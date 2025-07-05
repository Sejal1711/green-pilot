const Job = require("../models/Job");
const axios = require("axios");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.createJob = async (req, res) => {
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

    // 🔮 Get ML prediction
    const predictionRes = await axios.post("http://localhost:8000/predict", {
      duration: 1,
    });

    const { best_time, predicted_intensity } = predictionRes.data;

    // 🧠 Determine command based on file extension
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
        command = `ts-node "${scriptPath}"`; // if ts-node is installed
        break;

      default:
        // Not executable
        const job = new Job({
          userId,
          jobName,
          description,
          region: "IN-WE",
          scheduledTime: best_time,
          scriptPath,
          carbonIntensity: predicted_intensity,
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

    // 🏃 Execute the script
    exec(command, async (error, stdout, stderr) => {
      try {
        const job = new Job({
          userId,
          jobName,
          description,
          region: "IN-WE",
          scheduledTime: best_time,
          scriptPath,
          carbonIntensity: predicted_intensity,
          output: stdout || stderr,
          status: error ? "failed" : "completed",
         
        });

        await job.save();

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
    console.error("❌ Job creation error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating job",
      error: err.message,
    });
  }
};
exports.getUserStats = async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.id });

    if (!jobs.length) {
      return res.json({ totalJobs: 0, totalSaved: 0, avgSaved: 0 });
    }

    let totalSaved = 0;
    let count = 0;

    jobs.forEach(job => {
      if (job.carbonIntensity) {
        totalSaved += (400 - job.carbonIntensity); 
        count++;
      }
    });

    const avgSaved = count ? totalSaved / count : 0;

    res.json({
      totalJobs: jobs.length,
      totalSaved: totalSaved.toFixed(2),
      avgSaved: avgSaved.toFixed(2),
    });
  } catch (err) {
    res.status(500).json({
      error: "Error fetching stats",
      details: err.message,
    });
  }
};

exports.getUserJobs = async (req, res) => {
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
