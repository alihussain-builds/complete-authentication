import { Router } from "express";
import * as authControllers from "../controllers/auth.controller.js";

const authRouter = Router();

/**
 * POST /api/auth/register
 */
authRouter.post("/register", authControllers.register);

/**
 * POST /api/auth/login
 */
authRouter.post("/login", authControllers.login);

/**
 * GET /api/auth/get-me
 */
authRouter.get("/get-me", authControllers.getMe);

/**
 * GET /api/auth/refresh-token
 */
authRouter.get("/refresh-token", authControllers.refreshToken);

/**
 *  Get /api/auth/logout
 */
authRouter.get("/logout", authControllers.logout);

/**
 *  Get /api/auth/logout-all
 */
authRouter.get("/logout-all", authControllers.logoutAll);

/**
 *  Get /api/auth/verify-email
 */
authRouter.get("/verify-email", authControllers.verifyEmail);

export default authRouter;
