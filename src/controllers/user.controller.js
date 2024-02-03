import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
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
    try {
        const dbUser = await User.findById(userId);

        const accessToken = dbUser.generateAccessToken();
        const refreshToken = dbUser.generateRefreshToken();
        // console.log(accessToken, refreshToken);

        dbUser.refreshToken = refreshToken;
        // to avoid checking mandatory fields while saving
        await dbUser.save({ validateBeforeSave: false }); 
        
        return { accessToken, refreshToken };
    } catch (err) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
}

const loginUser = asyncHandler(async (req, res) => {
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
    // we can access user because verifyJWT middleware function adds the user to req
    await User.findByIdAndUpdate(
        req.user._id, // find clause
        {
            $set: { // update values
                refreshToken: undefined,
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
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request");
        }
    
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.ACCESS_TOKEN_SECRET);
    
        // while creating the jwt token we have given the db _id; check user.model
        const dbUser = await User.findById(decodedToken?._id);
        if (!dbUser) {
            throw new ApiError(401, "Invalid refresh token");
        }
    
        if (incomingRefreshToken !== dbUser?.refreshAccessToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }
    
        // create new tokens
        const { newAccessToken, newRefreshToken } = await generateAccessAndRefreshTokens(dbUser._id);

        const options = {
            httpOnly: true,
            secure: true
        }
        
        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .cookies("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken: newAccessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access token refreshed successfully"
                )
            )

    } catch (error) {
        throw new ApiError(401, error?.message, "Invalid refresh token")
    }
});

export { loginUser, logoutUser, refreshAccessToken, registerUser };

