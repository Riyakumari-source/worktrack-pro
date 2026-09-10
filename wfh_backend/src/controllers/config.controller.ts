import { Request, Response } from "express";
import { getPublicConfig } from "../config/app.config";

export const getAppConfig = (_req: Request, res: Response): void => {
  res.status(200).json({ config: getPublicConfig() });
};
