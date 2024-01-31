import cors from "cors";
import express from "express";
import cookieParser from from;
"cookie-parser";

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

// to perform CRUB operations on user's browser
app.use(cookieParser());

export {
    app
};