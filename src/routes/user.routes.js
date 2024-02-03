import { Router } from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

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

export default router;