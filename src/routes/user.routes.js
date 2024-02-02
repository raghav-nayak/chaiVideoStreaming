import {
    Router
} from "express";
import {
    registerUser
} from "../controllers/user.controller.js";
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
    registerUser)

export default router;