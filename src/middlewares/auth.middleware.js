import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    //get token from cookies or headers
    const token =
      req.cookies?.accessToken ||
      req.headers("Authorization")?.replace("bearer ", "");

    //if token is not present, throw an error
    if (!token) {
      throw new ApiError(401, "Unauthorized access");
    }

    //verify the token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    //get user details from database
    const user = await User.findById(decoded?._id).select(
      "-password, -refreshToken"
    );

    //if user is not found, throw an error
    if (!user) {
      throw new ApiError(401, "Unauthorized access");
    }

    //attach user details to the request object
    req.user = user;
    next();
  } catch (error) {
    //if there is an error, throw an error
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
