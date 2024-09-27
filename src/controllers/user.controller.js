import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

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
  //get user from frontend
  const { username, email, password } = req.body;

  //validation
  if (!username && !email) {
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

const refreshAccessToken = asyncHandler(async (req, res) => {
  //get refresh token from frontend
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  //if refresh token is not present throw an error
  if (!incomingRefreshToken) {
    throw new ApiError(400, "unauthorized access");
  }

  try {
    //verify refresh token
    const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);

    //if user is not found throw an error
    if (!user) {
      throw new ApiError(400, "invalid refresh token");
    }

    //check if refresh token is expired or used
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(400, "refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    //generate new access token and refresh token
    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {},
          accessToken,
          newRefreshToken,
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  //get old password and new password from frontend
  const { oldPassword, newPassword } = req.body;

  //find user by id
  const user = await User.findById(req.user._id);

  //check if old password is correct
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  //if old password is not correct throw an error
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  //update the password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  //send response to frontend
  const response = new ApiResponse(200, {}, "Password updated successfully");
  return res.status(200).json(response);
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password ");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));
});

const updateAvatar = asyncHandler(async (req, res) => {
  //check for avatar
  const avatarLocalPath = req.file?.path;

  //if avatar is not present throw an error
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  //upload avatar to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  //if avatar is not uploaded throw an error
  if (!avatar.url) {
    throw new ApiError(500, "Failed to upload avatar");
  }

  //update avatar in database
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password ");

  //send response to frontend
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));

  //todo: delete the old avatar from cloudinary
});

const updateCoverImage = asyncHandler(async (req, res) => {
  //check for cover image
  const coverLocalPath = req.file?.path;

  //if cover image is not present throw an error
  if (!coverLocalPath) {
    throw new ApiError(400, "Cover image is required");
  }

  //upload cover image to cloudinary
  const cover = await uploadOnCloudinary(coverLocalPath);

  //if cover image is not uploaded throw an error
  if (!cover.url) {
    throw new ApiError(500, "Failed to upload cover image");
  }

  //update cover image in database
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: cover.url,
      },
    },
    { new: true }
  ).select("-password ");

  //send response to frontend
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  //get username from params
  const { username } = req.params;

  //if username is not present throw an error
  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  //get user channel profile from database
  const channel = await User.aggregate([
    {
      //match the username
      $match: {
        username: username.toLowerCase(),
      },
    },
    {
      //lookup for subscribers
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      //lookup for subscribedTo
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      //add fields to the response
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: {
              //check if the user is subscribed to the channel if the is logged in check user subscribed or not by checking the subscriber id in the subscribers array
              $in: [req.user._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  //if channel is not found throw an error
  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }

  //send response to frontend
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channel[0],
        " User Channel profile fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logOutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getUserChannelProfile,
};
