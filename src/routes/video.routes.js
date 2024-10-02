import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  uploadVideo,
  updateVideo,
  deleteVideo,
  getVideoById,
  togglePublishStatus,
} from "../controllers/video.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/uploadVideo").post(
  upload.fields([
    {
      name: "videoFile",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    },
  ]),
  uploadVideo
);

router
  .route("/:videoId")
  .get(getVideoById)
  .post(togglePublishStatus)
  .delete(deleteVideo)
  .patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

export default router;
