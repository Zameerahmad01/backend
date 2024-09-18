import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";

const router = Router();

// USER ROUTES
router.route("/register").post(registerUser);

export default router;
