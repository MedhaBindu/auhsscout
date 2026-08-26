// ==========================================
// ক্লাউডিনারি মাস্টার কনফিগারেশন ফাইল
// ==========================================

const CLOUDINARY_CLOUD_NAME = "fa4tc5wr";       
const CLOUDINARY_UPLOAD_PRESET = "scout_preset"; 

export async function uploadImageToCloudinary(file) {
    if (!file) {
        alert("দয়া করে আপলোড করার জন্য কোনো ছবি সিলেক্ট করুন!");
        return null;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const apiEndpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (data.secure_url) {
            return {
                url: data.secure_url,
                public_id: data.public_id 
            };
        } else {
            console.error("Cloudinary Error Details:", data);
            alert("ক্লাউডিনারি আপলোড ব্যর্থ হয়েছে! ক্লাউডিনারি প্রিসেট সেটিংস চেক করুন।");
            return null;
        }
    } catch (error) {
        console.error("Network or Fetch Error:", error);
        alert("নেটওয়ার্ক সমস্যার কারণে ছবি আপলোড করা যায়নি!");
        return null;
    }
}
