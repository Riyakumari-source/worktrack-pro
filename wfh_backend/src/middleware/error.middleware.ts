import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Centralized Error Handler caught exception:", err);
  
  const status = err.status || 500;
  let message = err.message || "Internal server error";

  if (process.env.NODE_ENV === "production" && status === 500) {
    message = "An unexpected internal server error occurred.";
  }

  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
