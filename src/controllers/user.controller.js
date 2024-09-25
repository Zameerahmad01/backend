import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Failed to generate access token and refresh token"
    );
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  //validation
  if (!username || !email) {
    throw new ApiError(400, "username and email are required");
  }

  //check if user exists
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(400, "Invalid username or email");
  }

  //check if password is correct
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid password");
  }

  //generate access token and refresh token
  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //set refresh token in cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  //send access token and refresh token to frontend
  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        loggedInUser,
        accessToken,
        refreshToken,
        "User logged in successfully"
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

export { registerUser, loginUser, logOutUser };
