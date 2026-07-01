import { Response } from "express";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export const downloadFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const type = req.params.type as string;
  const filename = req.params.filename as string;
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Unauthorized access." });
    return;
  }

  if (type !== "screenshots" && type !== "reports") {
    res.status(400).json({ error: "Invalid file type requested." });
    return;
  }

  // Prevent directory traversal
  const safeFilename = path.basename(filename);
  const uploadDir = path.join(process.cwd(), "public", "uploads", type);
  const filePath = path.join(uploadDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found on server." });
    return;
  }

  try {
    // Perform authorization checks based on user role and ownership
    if (type === "screenshots") {
      const screenshot = await prisma.screenshot.findFirst({
        where: { imageUrl: { contains: safeFilename } }
      });
      if (!screenshot) {
        res.status(404).json({ error: "Screenshot record not found in database." });
        return;
      }
      if (user.role !== "ADMIN" && screenshot.userId !== user.id) {
        res.status(403).json({ error: "Access denied. You do not have permission to view this screenshot." });
        return;
      }
    } else {
      // reports
      const shift = await prisma.shift.findFirst({
        where: { pdfReportName: safeFilename }
      });
      if (!shift) {
        res.status(404).json({ error: "Report record not found in database." });
        return;
      }
      if (user.role !== "ADMIN" && shift.userId !== user.id) {
        res.status(403).json({ error: "Access denied. You do not have permission to view this report." });
        return;
      }
    }

    // Stream/Send the file to the client
    res.sendFile(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to download file." });
  }
};
