import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
const registerUser = asyncHandler(async (req, res) => {
  //get user from frontend
  //validation - non empty, valid email, valid password
  //check if user already exists
  //check for images check for profile picture
  //upload profile picture to cloudinary
  //create user object - payload create entry in database
  //remove password and refresh token from response
  //check for user creation
  //send response to frontend

  //get user from frontend
  const { fullName, username, email, password } = req.body;

  //validation - non empty, valid email, valid password
  if (
    [fullName, username, email, password].some((field) => field.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  //check if user already exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  //if user exists throw an error
  if (existedUser) {
    throw new ApiError(409, "User with username or email already exists");
  }

  //check for images
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverLocalPath = req.files?.cover[0]?.path;
  let coverLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.cover) &&
    req.files.cover.length > 0
  ) {
    coverLocalPath = req.files.cover[0].path;
  }
  //if no avatar throw an error
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  //upload avatar and cover to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const cover = await uploadOnCloudinary(coverLocalPath);

  //if avatar is not uploaded throw an error
  if (!avatar) {
    throw new ApiError(500, "Failed to upload avatar");
  }

  //create user object
  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: cover?.url || "",
  });

  //remove password and refresh token from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken "
  );

  //if user is not created throw an error
  if (!createdUser) {
    throw new ApiError(500, "Failed to create user");
  }

  //send response to frontend
  const response = new ApiResponse(
    201,
    createdUser,
    "User created successfully"
  );
  res.status(201).json(response);
});

export { registerUser };
