require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const cron = require("node-cron");

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Middleware for parsing form data
app.use(bodyParser.urlencoded({ extended: true }));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Worker Schema and Model
const workerSchema = new mongoose.Schema({
  name: String,
  phoneNumber: String,
  birthday: String, // MM-DD format
});

const Worker = mongoose.model("Worker", workerSchema);

// Route to display the form and list of workers
app.get("/", async (req, res) => {
  try {
    const workers = await Worker.find();
    res.render("index", { workers });
  } catch (err) {
    console.error("Error fetching workers:", err);
    res.send("Error fetching workers.");
  }
});

// Route to add a worker
app.post("/add-worker", async (req, res) => {
  const { name, phoneNumber, birthday } = req.body;
  const newWorker = new Worker({ name, phoneNumber, birthday });
  try {
    await newWorker.save();
    res.redirect("/");
  } catch (err) {
    console.error("Error adding worker:", err);
    res.send("Error adding worker.");
  }
});

// Route to update worker details
app.post("/edit-worker/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phoneNumber, birthday } = req.body;
  try {
    await Worker.findByIdAndUpdate(id, { name, phoneNumber, birthday });
    res.redirect("/");
  } catch (err) {
    console.error("Error updating worker:", err);
    res.send("Error updating worker.");
  }
});

// Route to delete a worker
app.get("/delete-worker/:id", async (req, res) => {
  try {
    await Worker.findByIdAndDelete(req.params.id);
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting worker:", err);
    res.send("Error deleting worker.");
  }
});

// Send SMS to Workers on Their Birthday using Arkesel API
async function sendBirthdaySMS() {
  try {
    const today = new Date().toISOString().slice(5, 10); // MM-DD format
    console.log(today);
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

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
