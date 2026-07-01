import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export const getTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user ID in token." });
    return;
  }

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
      include: { tasks: true },
    });

    if (!activeShift) {
      res.status(200).json({ tasks: [] });
      return;
    }

    res.status(200).json({ tasks: activeShift.tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve tasks" });
  }
};

export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user ID in token." });
    return;
  }
  const { text } = req.body;

  if (!text || text.trim() === "") {
    res.status(400).json({ error: "Task description text cannot be empty" });
    return;
  }

  try {
    const activeShift = await prisma.shift.findFirst({
      where: { userId, status: "Active" },
    });

    if (!activeShift) {
      res.status(404).json({ error: "No active shift found. Clock in first." });
      return;
    }

    const newTask = await prisma.task.create({
      data: {
        shiftId: activeShift.id,
        text,
        completed: false,
      },
    });

    res.status(201).json({ message: "Task created in Database", task: newTask });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create task" });
  }
};

export const toggleTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized. Missing user ID in token." });
    return;
  }
  const { taskId } = req.params as { taskId: string };

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { shift: true }
    });

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Verify IDOR ownership and active shift
    if (task.shift.userId !== userId) {
      res.status(403).json({ error: "Forbidden. You are not authorized to update this task." });
      return;
    }

    if (task.shift.status !== "Active") {
      res.status(400).json({ error: "Lockout Compliance Block: Cannot toggle tasks on a completed shift." });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : null,
      },
    });

    res.status(200).json({ message: "Task updated in Database", task: updatedTask });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update task" });
  }
};
