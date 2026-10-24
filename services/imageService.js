import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { Buffer } from 'buffer'; // Import Buffer for Base64 conversion
import { supabaseURL } from '../constants';

export const getUserImageSrc = (imagePath) => {
    if (imagePath) {
         return getSupabaseFileUrl(imagePath);
    }else{
        return require('../assets/images/defaultuser.jpg');
    }
};

export const getSupabaseFileUrl = filePath =>{
    if(filePath){
        return {uri: `${supabaseURL}/storage/v1/object/public/uploads/${filePath}`}
    }
    return null;
}

// ✅ Function to convert Base64 to ArrayBuffer
const base64ToArrayBuffer = (base64) => {   
    const binaryString = Buffer.from(base64, 'base64'); // Decode Base64
    return new Uint8Array(binaryString).buffer;
};

export const uploadFile = async (folderName, fileUri, isImage = true) => {
    try {
        if (!fileUri) {
            throw new Error("No file URI provided");
        }

        let fileName = getFilePath(folderName, isImage);

        console.log("Reading file:", fileUri);

        // ✅ Read file as Base64
        const base64String = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        if (!base64String) {
            throw new Error("Failed to read file as Base64");
        }

        console.log("Base64 length:", base64String.length);

        // ✅ Convert Base64 to ArrayBuffer
        let fileBuffer = base64ToArrayBuffer(base64String);

        // ✅ Upload to Supabase
        let { data, error } = await supabase.storage
            .from('uploads') // Change 'uploads' to your actual bucket name
            .upload(fileName, fileBuffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: isImage ? 'image/png' : 'video/mp4',
            });

        if (error) {
            console.log('File upload error:', error);
            return { success: false, msg: 'Could not upload media' };
        }

        console.log('Upload success:', data);
        return { success: true, data: data.path };

    } catch (error) {
        console.log('File upload error:', error.message);
        return { success: false, msg: error.message };
    }
};

// ✅ Generate Unique File Path
export const getFilePath = (folderName, isImage) => {
    return `${folderName}/${Date.now()}${isImage ? '.png' : '.mp4'}`;
};
