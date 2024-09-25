import { Router } from "express";
import { registerUser, loginUser, logOutUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

// USER ROUTES
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "cover",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

// PROTECTED ROUTES
//verify jwt token is middleware to verify the token and get user details
router.route("/logout").post(verifyJWT, logOutUser);

export default router;
