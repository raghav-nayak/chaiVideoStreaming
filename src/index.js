// require("dotenv").config({ path: "./.env" });
import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/index.js";

dotenv.config({
    path: "./env"
});

//const app = express(); 

connectDB()
    .then(() => {
        let port = process.env.PORT
        app.listen(port || 8000, () => {
            console.log("Server is running at port", port);
        });
    })
    .catch((err) => {
        console.log("MongoDB connection failed");
    });


/*
(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error", (error) => {
            console.log("Error while connecting to DB");
            throw error;
        });

        app.listen(process.env.PORT, () => {
            console.log("App is listening on port " + process.env.PORT);
        });
    } catch (error) {
        console.error("Error while connecting to DB", error);
        throw error;
    }
})();
*/