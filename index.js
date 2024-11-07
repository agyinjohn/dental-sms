require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const cron = require("node-cron");
const cors = require("cors");
const path = require("path");

const app = express();
const port = process.env.PORT || 5000; // Express server port

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Middleware for parsing form data
app.use(
  cors({
    origin: "https://dental-sms.netlify.app", // React client URL for development
    credentials: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Enable JSON parsing

// Worker Schema and Model
const workerSchema = new mongoose.Schema({
  name: String,
  phoneNumber: String,
  birthday: String, // Format: MM-DD
});

const Worker = mongoose.model("Worker", workerSchema);

// API Routes

// Get all workers
app.get("/workers", async (req, res) => {
  try {
    const workers = await Worker.find();
    res.json(workers);
  } catch (err) {
    console.error("Error fetching workers:", err);
    res.status(500).json({ error: "Error fetching workers" });
  }
});

// Add a new worker
app.post("/add-worker", async (req, res) => {
  const { name, phoneNumber, birthday } = req.body;
  const newWorker = new Worker({ name, phoneNumber, birthday });
  try {
    await newWorker.save();
    res.status(201).json(newWorker);
  } catch (err) {
    console.error("Error adding worker:", err);
    res.status(500).json({ error: "Error adding worker" });
  }
});

// Update a worker
app.put("/edit-worker/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phoneNumber, birthday } = req.body;
  try {
    const updatedWorker = await Worker.findByIdAndUpdate(
      id,
      { name, phoneNumber, birthday },
      { new: true }
    );
    res.json(updatedWorker);
  } catch (err) {
    console.error("Error updating worker:", err);
    res.status(500).json({ error: "Error updating worker" });
  }
});

// Delete a worker
app.delete("/delete-worker/:id", async (req, res) => {
  try {
    await Worker.findByIdAndDelete(req.params.id);
    res.json({ message: "Worker deleted successfully" });
  } catch (err) {
    console.error("Error deleting worker:", err);
    res.status(500).json({ error: "Error deleting worker" });
  }
});

// Send SMS to Workers on Their Birthday
async function sendBirthdaySMS() {
  try {
    const today = new Date().toISOString().slice(5, 10); // MM-DD format
    const workers = await Worker.find({ birthday: today });

    if (workers.length === 0) {
      console.log("No birthdays today.");
      return;
    }

    for (const worker of workers) {
      const message = `Happy Birthday, ${worker.name}! Have a fantastic day!`;
      const phoneNumber = worker.phoneNumber;

      // Build the Arkesel API URL
      const url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${
        process.env.ARKESSEL_API_KEY
      }&to=${phoneNumber}&from=${process.env.SENDERID}&sms=${encodeURIComponent(
        message
      )}`;

      try {
        const response = await fetch(url, { method: "GET" });
        const result = await response.json();

        if (result.status === "success") {
          console.log(`SMS sent to ${worker.name}`);
        } else {
          console.error(`Failed to send SMS to ${worker.name}:`, result);
        }
      } catch (error) {
        console.error(`Failed to send SMS to ${worker.name}:`, error);
      }
    }
  } catch (err) {
    console.error("Error fetching workers:", err);
  }
}

// Schedule Task to Run Daily at 9 AM
cron.schedule("0 9 * * *", sendBirthdaySMS);
console.log("Cron job scheduled to run every day at 9 AM.");

// Serve React client in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
  });
}

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
