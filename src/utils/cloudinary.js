import {
    v2 as cloudinary
} from 'cloudinary';
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        })

        //file has been successfully uploaded
        console.log("File is successfully uploaded to cloudinary", response); // cloudinary returns public url
        fs.unlinkSync(localFilePath); // to remove the file from local storage
        
        return response
    } catch (err) {
        fs.unlinkSync(localFilePath); // remove local temporary file as the upload action failed
        return null
    }
}

export {
    uploadOnCloudinary
};
