import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export const getScreenshots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized access" });
    return;
  }

  const limit = parseInt(req.query.limit as string) || 12;
  const skip = parseInt(req.query.skip as string) || 0;

  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const screenshots = await prisma.screenshot.findMany({
      where: { 
        userId,
        capturedAt: { gte: twoDaysAgo }
      },
      orderBy: { capturedAt: "desc" },
      take: limit,
      skip: skip,
    });

    res.status(200).json({ screenshots });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve screenshots" });
  }
};

export const uploadScreenshot = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { activeWindow } = req.body;
  const file = req.file;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized access" });
    return;
  }

  if (!file) {
    res.status(400).json({ error: "No screenshot file uploaded" });
    return;
  }

  // Robust File Type Validation: Verify magic bytes match PNG or JPEG
  try {
    const fs = require("fs");
    const buffer = fs.readFileSync(file.path);
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (!isPng && !isJpg) {
      fs.unlinkSync(file.path); // Delete the invalid file
      res.status(400).json({ error: "Robust Validation Block: The uploaded file is not a valid JPEG or PNG image." });
      return;
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to perform file integrity check." });
    return;
  }

  // URL path for protected file download
  const imageUrl = `/api/files/download/screenshots/${file.filename}`;

  try {
    const newScreenshot = await prisma.screenshot.create({
      data: {
        userId,
        imageUrl,
        activeWindow: activeWindow || "Active Desktop App",
        status: "Uploaded"
      }
    });

    res.status(201).json({ 
      message: "Screenshot synchronized with Database successfully", 
      screenshot: newScreenshot 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to upload screenshot" });
  }
};
