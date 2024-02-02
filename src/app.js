import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

// to accept json values and giving limit to the input file
app.use(express.json({
    limit: "16kb"
}));

// to handle values coming from URL encoding
app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}));

// public assets
app.use(express.static("public"));

// to perform CRUD operations on user's browser
app.use(cookieParser());

// routes imports
import userRouter from "./routes/user.routes.js";

// routes declaration
// route would be something like this : http://localhost:8000/api/v1/users

app.use("/api/v1/users", userRouter)

export default app;