const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    jobName: {
        type: String,
        required: true
    },
    description: String,
    region: {
        type: String,
        required: true
    },
    scheduledTime: Date,
    status: {
        type: String,
        enum: ["pending", "running", "completed", "failed"],
        default: "pending"
    },
    carbonIntensity: Number,
    carbonEstimate: Number,
    scriptPath: String,
    output: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
    
});

module.exports = mongoose.model("Job", jobSchema);
