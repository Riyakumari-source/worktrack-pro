import { Router } from "express";
import { getAppConfig } from "../controllers/config.controller";

const router = Router();

router.get("/", getAppConfig);

export default router;
