import mongoose from "mongoose";
import {
    DB_NAME
} from "../constants.js";

const connectDB = async () => {
    try {
        const mongoInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`MongoDB connected!! DB HOST: ${mongoInstance.connection.host}`);
    } catch (error) {
        console.error("MongoDB connection failed. ", error);
        process.exit(1);
    }
}

export default connectDB;