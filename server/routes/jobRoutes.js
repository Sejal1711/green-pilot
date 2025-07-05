
const express = require("express");
const router = express.Router();
const multer = require("multer");

const jobController = require("../controllers/jobController");
const authMiddleware = require("../middleware/authMiddleware");

// Setup file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "scripts");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Routes
router.post("/create", authMiddleware, upload.single("script"), jobController.createJob);
router.get("/my-jobs", authMiddleware, jobController.getUserJobs);
router.get("/stats", authMiddleware, jobController.getUserStats); 



module.exports = router;
