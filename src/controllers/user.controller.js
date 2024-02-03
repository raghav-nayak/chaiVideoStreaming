import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend or request
    const {
        fullName,
        email,
        username,
        password
    } = req.body;
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

export {
    registerUser
};
