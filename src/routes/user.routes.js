import {
    Router
} from "express";
import {
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
} from "../controllers/user.controller.js";
import {
    verifyJWT
} from "../middlewares/auth.middleware.js";
import {
    upload
} from "../middlewares/multer.middleware.js";

const router = Router();

// route would be something like this -> http://localhost:8000/api/v1/users/register
router.route("/register").post(
    // adding middleware : Multer
    upload.fields([{
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser);

router.route("/login").post(loginUser);

// secured routes
router.route("/logout").post(
    verifyJWT, // middleware to get user details
    logoutUser
);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/change-password").post(
    verifyJWT, // only verified users can change
    changeCurrentPassword
);

router.route("/current-user").post(
    verifyJWT,
    getCurrentUser
);

router.route("/update-account").patch(
    verifyJWT,
    updateAccountDetails
);

router.route("/update-avatar").patch(
    verifyJWT,
    update.single("avatar"), // from multer, only single file update
    updateUserAvatar
);

router.route("/update-cover-image").patch(
    verifyJWT,
    update.single("coverImage"), // from multer, only single file update
    updateUserCoverImage
);

router.route("/c/:username").get( // to get username from the params
    verifyJWT,
    getUserChannelProfile
);

router.route("/history").get(
    verifyJWT,
    getWatchHistory
);

export default router;