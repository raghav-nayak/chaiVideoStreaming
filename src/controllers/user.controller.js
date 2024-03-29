import { response } from "express";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import mongoose from "mongoose";

const registerUser = asyncHandler(async (req, res) => {
    console.log("registerUser() is called");
    // get user details from frontend or request
    const { fullName, email, username, password } = req.body;
    // console.log(fullName, email, username, password);

    // validation i.e. empty values
    if (
        [fullName,
            email,
            username,
            password
        ].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "fullName is mandatory")
    }

    // check if the user already exist; username, email
    const existedUser = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    });
    if (existedUser) {
        throw new ApiError(409, `User with ${username} or ${email} already exists. ${existedUser}}`);
    }

    // check for images, check for avatar
    // multer give files as we come from middleware multer
    // to get the uploaded path from multer
    console.log("req.files: ", req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        const coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // upload them to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    // create a user object - create entry in db
    const userDetails = {
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "", // check if coverImage exists; if yes, get url, else empty
        email,
        password,
        username: username.toLowerCase(),
    }
    const dbUser = await User.create(userDetails)

    // remove password and refresh token fields from response
    const createdDBUser = await User.findById(dbUser._id).select(
        "-password -refreshToken"
    );

    // check for user creation
    if (!createdDBUser) {
        throw new ApiError(500, "Something went wrong while creating the user");
    }

    console.log(`User registered successfully with ${fullName} and ${email}`);
    // return response
    const response = new ApiResponse(200, createdDBUser, "User registered successfully");
    return res.status(201).json(response);
});

const generateAccessAndRefreshTokens = async (userId) => {
    console.log("generateAccessAndRefreshTokens() is called");
    try {
        const dbUser = await User.findById(userId);

        const accessToken = dbUser.generateAccessToken();
        const refreshToken = dbUser.generateRefreshToken();

        dbUser.refreshToken = refreshToken;
        // to avoid checking mandatory fields while saving
        await dbUser.save({ validateBeforeSave: false }); 
        
        return { accessToken, refreshToken };
    } catch (err) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
}

const loginUser = asyncHandler(async (req, res) => {
    console.log("loginUser() is called");
    // req body -> data
    const { email, username, password } = req.body;

    // username or email
    if (!(username || password)) {
        throw new ApiError(400, "username or email required");
    }

    // find the user from the db
    const dbUser = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    });

    if (!dbUser) {
        throw new ApiError(400, "User does not exist");
    }

    // password check
    // Note: User is mongoose object and user is dbUser object; so use dbUser
    const isPasswordValid = await dbUser.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    // if valid, generate access token and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(dbUser._id);

    const loggedInUser = await User.findById(dbUser._id)
        .select("-password -refreshToken");

    // send the token in cookies securely
    // cookie options to make only server can modify the cookie
    const options = {
        httpOnly: true,
        secure: true,
    }

    console.log("User logged in successfully");

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged in successfully"
            )
        );

});

const logoutUser = asyncHandler(async (req, res) => {
    console.log("logoutUser() is called");
    // we can access user because verifyJWT middleware function adds the user to req
    await User.findByIdAndUpdate(
        req.user._id, // find clause
        {
            // $set: { // update values
            //     refreshToken: undefined,
            // }
            $unset: { // unset the refreshToken
                refreshToken: 1
            }
        },
        { // to return the new updated user object from the db
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    console.log("refreshAccessToken() is called");
    try {
        const userId = req.user._id;
        // create new tokens
        const { newAccessToken, newRefreshToken } = await generateAccessAndRefreshTokens(userId);

        const options = {
            httpOnly: true,
            secure: true
        }
        
        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken: newAccessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    console.log("changeCurrentPassword() is called");
    const { oldPassword, newPassword } = req.body;

    const dbUser = await User.findById(req.user?._id);
    const isPasswordCorrect = await dbUser.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    dbUser.password = newPassword;
    await dbUser.save({
        validateBeforeSave: false
    });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));

});

const getCurrentUser = asyncHandler(async (req, res) => {
    console.log("getCurrentUser() is called");
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully")); 
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    console.log("updateAccountDetails() is called");
    const { fullName, email } = req.body;

    if (!(fullName || email)) {
        throw new ApiError(400, "All fields are required");
    }

    const updatedDbUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName, // es6 syntax
                email: email // another way to write the same thing
            }
        },
        {new: true}
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedDbUser, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    console.log("updateUserAvatar() is called");
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatarCloudinaryPath = await uploadOnCloudinary(avatarLocalPath);
    if (!avatarCloudinaryPath) {
        throw new ApiError(400, "Error while uploading avatar file on cloudinary");
    }

    const updatedDbUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatarCloudinaryPath.url
            }
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedDbUser, "Avatar is updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    console.log("updateUserCoverImage() is called");
    const coverImageLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const coverImageCloudinaryPath = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImageCloudinaryPath) {
        throw new ApiError(400, "Error while uploading cover image file on cloudinary");
    }

    const updatedDbUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImageCloudinaryPath.url
            }
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedDbUser, "CoverImage is updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    console.log("getUserChannelProfile() is called");
    const { username } = req.body;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions", // Subscription becomes subscription in mongodb
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions", // Subscription becomes subscription in mongodb
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            // adds these fields to the collection temporarily
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [
                                req.user?._id,
                                "$subscribers.subscriber"
                            ],
                            then: true,
                            else: false
                        }
                    }
                }
            }
        },
        {
            // return only selected values from user
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist");
    }

    return response
        .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
});

const getWatchHistory = asyncHandler(async (req, res) => {
    console.log("getWatchHistory() is called");
    const user = await User.aggregate([
        {
            $match: {
                // this conversion is necessary as we get user._id as string
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        // to get the first value from the owner array
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully"));
});

export {
    changeCurrentPassword,
    getCurrentUser,
    getUserChannelProfile,
    getWatchHistory,
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};

