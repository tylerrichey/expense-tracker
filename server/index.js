import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { databaseService } from "./database.js";
import { placesService } from "./places.js";
import { budgetScheduler } from "./budget-scheduler.js";
import { logger } from "./logger.js";

// Set NODE_ENV to development if not set (for dev server)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

if (!AUTH_PASSWORD) {
  logger.log("error", "ERROR: AUTH_PASSWORD environment variable is required");
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.raw({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Authentication middleware
const authenticateRequest = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  if (token !== AUTH_PASSWORD) {
    return res.status(401).json({ error: "Invalid authentication" });
  }

  next();
};

// Serve static files from the dist directory
app.use(express.static(join(__dirname, "../dist")));

// Authentication endpoint
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password === AUTH_PASSWORD) {
    res.json({
      success: true,
      token: AUTH_PASSWORD,
      message: "Authentication successful",
    });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

// API Routes (protected)
app.post("/api/expenses", authenticateRequest, async (req, res) => {
  try {
    const { amount, latitude, longitude, place_id, place_name, place_address } =
      req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const expense = {
      amount: parseFloat(amount),
      latitude: latitude || null,
      longitude: longitude || null,
      place_id: place_id || null,
      place_name: place_name || null,
      place_address: place_address || null,
      timestamp: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== "production") {
      logger.log(
        "info",
        "Server: Received expense data",
        { data: req.body }
      );
      logger.log(
        "info",
        "Server: Prepared expense object",
        { expense }
      );
    }

    const savedExpense = await databaseService.addExpense(expense);
    res.status(201).json(savedExpense);
  } catch (error) {
    logger.log("error", "Error saving expense:", { error: error.message });
    res.status(500).json({ error: "Failed to save expense" });
  }
});

// Image upload endpoint for expenses
app.post(
  "/api/expenses/upload-image",
  authenticateRequest,
  upload.single("image"),
  async (req, res) => {
    try {
      const { expenseId } = req.body;
      const imageFile = req.file;

      logger.log("info", "📷 Image upload request received:", {
        expenseId,
        hasFile: !!imageFile,
        fileSize: imageFile?.size,
        fileName: imageFile?.originalname,
        mimeType: imageFile?.mimetype,
      });

      if (!expenseId) {
        logger.log("error", "Image upload failed: Missing expense ID");
        return res.status(400).json({ error: "Expense ID is required" });
      }

      if (!imageFile) {
        logger.log("error", "Image upload failed: Missing image file");
        return res.status(400).json({ error: "Image file is required" });
      }

      logger.log(
        "info",
        `📷 Uploading image for expense ${expenseId}: ${
          imageFile.originalname
        } (${(imageFile.size / 1024).toFixed(1)}KB)`
      );

      // Update the expense with the image data
      const expenseIdNum = parseInt(expenseId);
      const success = await databaseService.updateExpenseImage(
        expenseIdNum,
        imageFile.buffer
      );

      if (!success) {
        logger.log("error", `Image upload failed: Expense ${expenseId} not found`);
        return res.status(404).json({ error: "Expense not found" });
      }

      logger.log("info", `✅ Image uploaded successfully for expense ${expenseId}`);
      res.json({ message: "Image uploaded successfully" });
    } catch (error) {
      logger.log("error", "Error uploading image:", { error: error.message });
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ error: "File too large. Maximum size is 5MB" });
      }
      res
        .status(500)
        .json({ error: "Failed to upload image: " + error.message });
    }
  }
);

// Get expense image endpoint
app.get("/api/expenses/:id/image", authenticateRequest, async (req, res) => {
  try {
    const expenseId = parseInt(req.params.id);

    if (!expenseId || isNaN(expenseId)) {
      return res.status(400).json({ error: "Valid expense ID is required" });
    }

    const imageBuffer = await databaseService.getExpenseImage(expenseId);

    if (!imageBuffer) {
      return res
        .status(404)
        .json({ error: "Image not found for this expense" });
    }

    // Detect image format from binary data
    let contentType = "image/jpeg"; // default fallback
    if (imageBuffer.length >= 8) {
      const header = imageBuffer.slice(0, 8);
      if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
        contentType = "image/jpeg";
      } else if (
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47
      ) {
        contentType = "image/png";
      } else if (
        header[0] === 0x47 &&
        header[1] === 0x49 &&
        header[2] === 0x46
      ) {
        contentType = "image/gif";
      } else if (
        header[0] === 0x52 &&
        header[1] === 0x49 &&
        header[2] === 0x46 &&
        header[3] === 0x46
      ) {
        contentType = "image/webp";
      }
    }

    // Set appropriate headers for image response
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", imageBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours

    res.send(imageBuffer);
  } catch (error) {
    logger.log("error", "Error retrieving expense image:", { error: error.message });
    res.status(500).json({ error: "Failed to retrieve image" });
  }
});

app.get("/api/expenses", authenticateRequest, async (req, res) => {
  try {
    const expenses = await databaseService.getAllExpenses();
    res.json(expenses);
  } catch (error) {
    logger.log("error", "Error fetching expenses:", { error: error.message });
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

app.get("/api/expenses/recent", authenticateRequest, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const expenses = await databaseService.getRecentExpenses(days);
    res.json(expenses);
  } catch (error) {
    logger.log("error", "Error fetching recent expenses:", { error: error.message });
    res.status(500).json({ error: "Failed to fetch recent expenses" });
  }
});

app.delete("/api/expenses/:id", authenticateRequest, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid expense ID is required" });
    }

    const result = await databaseService.deleteExpense(id);

    if (result.deleted) {
      res.json({ message: "Expense deleted successfully", id });
    } else {
      res.status(404).json({ error: "Expense not found" });
    }
  } catch (error) {
    logger.log("error", "Error deleting expense:", { error: error.message });
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

app.get("/api/places/nearby", authenticateRequest, async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ error: "Latitude and longitude are required" });
    }

    const places = await placesService.searchNearbyPlaces(
      latitude,
      longitude,
      radius ? parseInt(radius) : 500
    );

    res.json(places);
  } catch (error) {
    logger.log("error", "Error fetching nearby places:", { error: error.message });
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch nearby places" });
  }
});

app.get(
  "/api/expenses/summary/:days",
  authenticateRequest,
  async (req, res) => {
    try {
      const days = parseInt(req.params.days);

      if (!days || isNaN(days) || days <= 0) {
        return res
          .status(400)
          .json({ error: "Valid number of days is required" });
      }

      const summary = await databaseService.getExpenseSummary(days);
      res.json(summary);
    } catch (error) {
      logger.log("error", "Error fetching expense summary:", { error: error.message });
      res.status(500).json({ error: "Failed to fetch expense summary" });
    }
  }
);

app.get(
  "/api/expenses/summary/month/current",
  authenticateRequest,
  async (req, res) => {
    try {
      const summary = await databaseService.getCurrentMonthSummary();
      res.json(summary);
    } catch (error) {
      logger.log("error", "Error fetching current month summary:", { error: error.message });
      res.status(500).json({ error: "Failed to fetch current month summary" });
    }
  }
);

app.get("/api/places/all", authenticateRequest, async (req, res) => {
  try {
    const places = await databaseService.getAllUniquePlaces();
    res.json(places);
  } catch (error) {
    logger.log("error", "Error fetching all places:", { error: error.message });
    res.status(500).json({ error: "Failed to fetch places" });
  }
});

// Database backup endpoint
app.get("/api/backup/download", authenticateRequest, (req, res) => {
  try {
    const dbPath = databaseService.getDatabasePath();

    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: "Database file not found" });
    }

    // Get file stats for size
    const stats = fs.statSync(dbPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `expenses-backup-${timestamp}.db`;

    // Set headers for file download
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", stats.size);

    // Stream the database file
    const readStream = fs.createReadStream(dbPath);
    readStream.pipe(res);

    readStream.on("error", (error) => {
      logger.log("error", "Error streaming backup file:", { error: error.message });
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download backup" });
      }
    });

    logger.log(
      "info",
      `📥 Database backup downloaded: ${filename} (${stats.size} bytes)`
    );
  } catch (error) {
    logger.log("error", "Error creating backup:", { error: error.message });
    res.status(500).json({ error: "Failed to create backup" });
  }
});

// Budget API Endpoints
// ====================

// Create a new budget
app.post("/api/budgets", authenticateRequest, async (req, res) => {
  try {
    const { name, amount, start_weekday, duration_days } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Budget name is required" });
    }

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ error: "Budget amount must be greater than 0" });
    }

    if (start_weekday < 0 || start_weekday > 6) {
      return res
        .status(400)
        .json({
          error: "Start weekday must be between 0 (Sunday) and 6 (Saturday)",
        });
    }

    if (duration_days < 7 || duration_days > 28) {
      return res
        .status(400)
        .json({ error: "Duration must be between 7 and 28 days" });
    }

    const budget = await databaseService.createBudget({
      name: name.trim(),
      amount,
      start_weekday,
      duration_days,
    });

    res.json(budget);
  } catch (error) {
    logger.log("error", "Error creating budget:", { error: error.message });
    res.status(500).json({ error: error.message || "Failed to create budget" });
  }
});

// Get all budgets
app.get("/api/budgets", authenticateRequest, async (req, res) => {
  try {
    const budgets = await databaseService.getAllBudgets();
    res.json(budgets);
  } catch (error) {
    logger.log("error", "Error fetching budgets:", { error: error.message });
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

// Get budget by ID
app.get("/api/budgets/:id", authenticateRequest, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid budget ID" });
    }

    const budget = await databaseService.getBudgetById(id);

    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    res.json(budget);
  } catch (error) {
    logger.log("error", "Error fetching budget:", { error: error.message });
    res.status(500).json({ error: "Failed to fetch budget" });
  }
});

// Update budget
app.put("/api/budgets/:id", authenticateRequest, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, amount, start_weekday, duration_days, is_active, is_upcoming, vacation_mode } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid budget ID" });
    }

    const updateData = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: "Budget name cannot be empty" });
      }
      updateData.name = name.trim();
    }

    if (amount !== undefined) {
      if (amount <= 0) {
        return res
          .status(400)
          .json({ error: "Budget amount must be greater than 0" });
      }
      updateData.amount = amount;
    }

    if (start_weekday !== undefined) {
      if (start_weekday < 0 || start_weekday > 6) {
        return res.status(400).json({ error: "Start weekday must be between 0-6" });
      }
      updateData.start_weekday = start_weekday;
    }

    if (duration_days !== undefined) {
      if (duration_days <= 0) {
        return res.status(400).json({ error: "Duration must be greater than 0" });
      }
      updateData.duration_days = duration_days;
    }

    if (is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
    }

    if (is_upcoming !== undefined) {
      updateData.is_upcoming = Boolean(is_upcoming);
    }

    if (vacation_mode !== undefined) {
      updateData.vacation_mode = Boolean(vacation_mode);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const budget = await databaseService.updateBudget(id, updateData);

    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    res.json(budget);
  } catch (error) {
    logger.log("error", "Error updating budget:", { error: error.message });
    res.status(500).json({ error: error.message || "Failed to update budget" });
  }
});

// Delete budget
app.delete("/api/budgets/:id", authenticateRequest, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid budget ID" });
    }

    const success = await databaseService.deleteBudget(id);

    if (!success) {
      return res.status(404).json({ error: "Budget not found" });
    }

    res.json({ message: "Budget deleted successfully" });
  } catch (error) {
    logger.log("error", "Error deleting budget:", { error: error.message });
    res.status(500).json({ error: error.message || "Failed to delete budget" });
  }
});

// Activate budget
app.post("/api/budgets/:id/activate", authenticateRequest, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid budget ID" });
    }

    const budget = await databaseService.activateBudget(id);

    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    res.json(budget);
  } catch (error) {
    logger.log("error", "Error activating budget:", { error: error.message });
    res
      .status(500)
      .json({ error: error.message || "Failed to activate budget" });
  }
});

// Schedule budget as upcoming
app.post("/api/budgets/:id/schedule", authenticateRequest, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid budget ID" });
    }

    const budget = await databaseService.scheduleUpcomingBudget(id);

    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    res.json(budget);
  } catch (error) {
    logger.log("error", "Error scheduling budget:", { error: error.message });
    res
      .status(500)
      .json({ error: error.message || "Failed to schedule budget" });
  }
});

// Toggle vacation mode
app.post(
  "/api/budgets/:id/vacation-mode",
  authenticateRequest,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { vacation_mode } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid budget ID" });
      }

      if (typeof vacation_mode !== "boolean") {
        return res
          .status(400)
          .json({ error: "vacation_mode must be a boolean" });
      }

      const budget = await databaseService.updateBudget(id, { vacation_mode });

      if (!budget) {
        return res.status(404).json({ error: "Budget not found" });
      }

      res.json(budget);
    } catch (error) {
      logger.log("error", "Error toggling vacation mode:", { error: error.message });
      res
        .status(500)
        .json({ error: error.message || "Failed to toggle vacation mode" });
    }
  }
);

// Get budget periods
app.get("/api/budget-periods", authenticateRequest, async (req, res) => {
  try {
    const { budget_id } = req.query;

    let periods;
    if (budget_id) {
      const budgetId = parseInt(budget_id);
      if (isNaN(budgetId)) {
        return res.status(400).json({ error: "Invalid budget ID" });
      }
      periods = await databaseService.getBudgetPeriods(budgetId);
    } else {
      periods = await databaseService.getBudgetPeriods();
    }

    res.json(periods);
  } catch (error) {
    logger.log("error", "Error fetching budget periods:", { error: error.message });
    res.status(500).json({ error: "Failed to fetch budget periods" });
  }
});

// Get current budget period
app.get(
  "/api/budget-periods/current",
  authenticateRequest,
  async (req, res) => {
    try {
      const period = await databaseService.getCurrentBudgetPeriod();

      if (!period) {
        return res
          .status(404)
          .json({ error: "No current budget period found" });
      }

      res.json(period);
    } catch (error) {
      logger.log("error", "Error fetching current budget period:", { error: error.message });
      res.status(500).json({ error: "Failed to fetch current budget period" });
    }
  }
);

// Get budget period by ID
app.get("/api/budget-periods/:id", authenticateRequest, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid period ID" });
    }

    const period = await databaseService.getBudgetPeriodById(id);

    if (!period) {
      return res.status(404).json({ error: "Budget period not found" });
    }

    res.json(period);
  } catch (error) {
    logger.log("error", "Error fetching budget period:", { error: error.message });
    res.status(500).json({ error: "Failed to fetch budget period" });
  }
});

// Get current budget analytics
app.get(
  "/api/budget-analytics/current",
  authenticateRequest,
  async (req, res) => {
    try {
      const analytics = await databaseService.getCurrentBudgetAnalytics();

      if (!analytics) {
        return res
          .status(404)
          .json({ error: "No current budget analytics available" });
      }

      res.json(analytics);
    } catch (error) {
      logger.log("error", "Error fetching current budget analytics:", { error: error.message });
      res.status(500).json({ error: "Failed to fetch budget analytics" });
    }
  }
);

// Get budget history
app.get(
  "/api/budget-analytics/history",
  authenticateRequest,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const history = await databaseService.getBudgetHistory(limit);

      res.json(history);
    } catch (error) {
      logger.log("error", "Error fetching budget history:", { error: error.message });
      res.status(500).json({ error: "Failed to fetch budget history" });
    }
  }
);

// Get budget trends
app.get(
  "/api/budget-analytics/trends",
  authenticateRequest,
  async (req, res) => {
    try {
      const trends = await databaseService.getBudgetTrends();

      res.json(trends);
    } catch (error) {
      logger.log("error", "Error fetching budget trends:", { error: error.message });
      res.status(500).json({ error: "Failed to fetch budget trends" });
    }
  }
);

// Trigger auto-continuation (for manual testing)
app.post(
  "/api/budgets/auto-continue",
  authenticateRequest,
  async (req, res) => {
    try {
      await budgetScheduler.performScheduledTasks();
      res.json({ message: "Auto-continuation triggered successfully" });
    } catch (error) {
      logger.log("error", "Error triggering auto-continuation:", { error: error.message });
      res.status(500).json({ error: "Failed to trigger auto-continuation" });
    }
  }
);

// Health check endpoint for deployment monitoring
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// Serve the Vue app for all other routes
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "../dist/index.html"));
});

app.listen(PORT, () => {
  logger.log("info", `Server running on http://localhost:${PORT}`);

  // Start budget scheduler
  budgetScheduler.start();
});
