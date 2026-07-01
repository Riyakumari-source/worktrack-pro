import { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const JWT_SECRET = process.env.JWT_SECRET || "wfh_secret_key_2026_super_secure_telemetry";

export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { employeeId, name, password, role } = req.body;

  if (!employeeId || !name || !password || !role) {
    res.status(400).json({ error: "Missing required fields (employeeId, name, password, role)" });
    return;
  }

  const normalizedRole: "ADMIN" | "EMPLOYEE" = role.toUpperCase() === "ADMIN" ? "ADMIN" : "EMPLOYEE";
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const existingUser = await prisma.regUser.findUnique({ where: { employeeId } });
    if (existingUser) {
      res.status(400).json({ error: "User already exists with this employeeId" });
      return;
    }

    const newUser = await prisma.regUser.create({
      data: {
        employeeId,
        name,
        password: hashedPassword,
        role: normalizedRole,
      },
    });

    res.status(201).json({
      message: "User registered successfully in Database",
      user: { id: newUser.id, employeeId: newUser.employeeId, name: newUser.name, role: newUser.role },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Registration failed" });
  }
};

export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { employeeId, password } = req.body;

  if (!employeeId || !password) {
    res.status(400).json({ error: "Missing employeeId or password" });
    return;
  }

  try {
    // Attempt database login using employeeId
    const user = await prisma.regUser.findUnique({
      where: { employeeId }
    });

    if (!user) {
      res.status(401).json({ error: "Invalid employee ID or password" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      res.status(401).json({ error: "Invalid employee ID or password" });
      return;
    }

    const token = jwt.sign(
      { id: user.id, employeeId: user.employeeId, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful from Database",
      token,
      user: { id: user.id, employeeId: user.employeeId, name: user.name, role: user.role },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Missing currentPassword or newPassword" });
    return;
  }

  if (newPassword.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters long" });
    return;
  }

  try {
    const user = await prisma.regUser.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ error: "Incorrect current password" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.regUser.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update password" });
  }
};

export const getClientIp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || "127.0.0.1";
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  res.status(200).json({ ip });
};
