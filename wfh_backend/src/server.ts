import fs from "fs";
import path from "path";
import app from "./app";
import prisma from "./lib/prisma";

const PORT = process.env.PORT || 5000;

// Automated Storage optimization routine (purges screenshots older than 7 days)
const runDailyScreenshotCleanup = async () => {
  try {
    const daysToKeep = 7;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysToKeep);

    console.log(`[CLEANUP] Starting daily screenshot cleanup (Purging older than ${daysToKeep} days)...`);

    const oldScreenshots = await prisma.screenshot.findMany({
      where: {
        capturedAt: {
          lt: thresholdDate
        }
      }
    });

    if (oldScreenshots.length === 0) {
      console.log(`[CLEANUP] No screenshots older than ${daysToKeep} days found.`);
      return;
    }

    let deletedCount = 0;
    for (const ss of oldScreenshots) {
      // Resolve path relative to backend root folder
      const relativePath = ss.imageUrl.startsWith("/") ? ss.imageUrl.substring(1) : ss.imageUrl;
      const fullPath = path.join(process.cwd(), relativePath);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedCount++;
        }
      } catch (err: any) {
        console.warn(`[CLEANUP] Failed to delete file ${fullPath}:`, err.message);
      }
    }

    const dbResult = await prisma.screenshot.deleteMany({
      where: {
        capturedAt: {
          lt: thresholdDate
        }
      }
    });

    console.log(`[CLEANUP] Purged ${deletedCount} files from disk and ${dbResult.count} records from database.`);
  } catch (error: any) {
    console.error("[CLEANUP] Screenshot storage optimization failed:", error.message || error);
  }
};

const startServer = async () => {
  try {
    console.log("Verifying Database Connection...");
    // Ping DB to verify connection
    await prisma.$connect();
    console.log("Prisma PostgreSQL Database Connected Successfully!");
    
    // Execute screenshot storage optimization sweep
    runDailyScreenshotCleanup();
    // Schedule sweep to run every 24 hours
    setInterval(runDailyScreenshotCleanup, 24 * 60 * 60 * 1000);
  } catch (error: any) {
    console.warn("=============================================================");
    console.warn("DATABASE CONNECTION FAILURE: Could not connect to PostgreSQL.");
    console.warn("Reason:", error.message || error);
    console.warn("FALLBACK ENABLED: Running in Dynamic Mock In-Memory Mode!");
    console.warn("=============================================================");
  }

  app.listen(PORT, () => {
    console.log(`=============================================================`);
    console.log(` WFH Management System Backend is running on port ${PORT} `);
    console.log(` API Endpoint: http://localhost:${PORT} `);
    console.log(`=============================================================`);
  });
};

startServer();
