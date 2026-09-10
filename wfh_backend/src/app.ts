import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { errorHandler } from "./middleware/error.middleware";
import authRouter from "./routes/auth.routes";
import shiftRouter from "./routes/shift.routes";
import taskRouter from "./routes/task.routes";
import adminRouter from "./routes/admin.routes";
import screenshotRouter from "./routes/screenshot.routes";
import fileRouter from "./routes/file.routes";
import configRouter from "./routes/config.routes";
import { appConfig } from "./config/app.config";

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: appConfig.corsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/shifts", shiftRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/admin", adminRouter);
app.use("/api/telemetry/screenshot", screenshotRouter);
app.use("/api/files", fileRouter);
app.use("/api/config", configRouter);

// Centralized error handling
app.use(errorHandler as any);

export default app;
