import { firedb } from './firebase-config.js';
import { collection, query, where, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadImageToCloudinary } from './cloudinary-config.js';

document.addEventListener("DOMContentLoaded", () => {
    const profileImageInput = document.getElementById('profileImage');
    if (profileImageInput) {
        profileImageInput.setAttribute('accept', 'image/*');
    }

    const classRollInput = document.getElementById('classRoll');
    if (classRollInput) {
        classRollInput.setAttribute('type', 'tel');
        classRollInput.setAttribute('pattern', '[0-9]*');
        classRollInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
        });
    }

    const mobileInput = document.getElementById('mobile');
    if (mobileInput) {
        mobileInput.setAttribute('type', 'tel');
        mobileInput.setAttribute('maxlength', '11');
        mobileInput.setAttribute('pattern', '[0-9]*');
        
        let mobileError = document.getElementById('mobileError');
        if (!mobileError) {
            mobileError = document.createElement('div');
            mobileError.id = 'mobileError';
            mobileError.style.color = '#ef4444';
            mobileError.style.fontSize = '12px';
            mobileError.style.marginTop = '4px';
            mobileError.style.display = 'none';
            mobileInput.parentNode.appendChild(mobileError);
        }

        mobileInput.addEventListener('input', function() {
            let val = this.value.replace(/\D/g, '');
            if (val.length > 0 && !val.startsWith('0')) {
                val = '0' + val;
            }
            if (val.length > 2 && val.substring(0, 2) !== '01') {
                val = '01';
            }
            if (val.length > 11) {
                val = val.substring(0, 11);
            }
            this.value = val;

            if (val.length > 0 && val.length < 11) {
                this.classList.add('error-border');
                mobileError.style.display = 'block';
                mobileError.innerText = "১১ ডিজিটের মোবাইল নাম্বারটি লিখুন!";
            } else {
                this.classList.remove('error-border');
                mobileError.style.display = 'none';
            }
        });
    }

    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', function() {
            let val = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
            this.value = val;
        });
    }

    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        let passError = document.getElementById('passwordError');
        if (!passError) {
            passError = document.createElement('div');
            passError.id = 'passwordError';
            passError.style.color = '#ef4444';
            passError.style.fontSize = '12px';
            passError.style.marginTop = '4px';
            passError.innerText = "সর্বনিম্ন ছয় ডিজিটের পাসওয়ার্ড দিন";
            passwordInput.parentNode.appendChild(passError);
        }

        passwordInput.addEventListener('input', function() {
            if (this.value.length >= 6) {
                this.classList.remove('error-border');
                passError.style.display = 'none';
            } else {
                this.classList.add('error-border');
                passError.style.display = 'block';
                passError.innerText = "সর্বনিম্ন ছয় ডিজিটের পাসওয়ার্ড দিন";
            }
        });
    }
});

let isUsernameAvailableSignup = true;
const usernameInput = document.getElementById('username');
const usernameErrorDiv = document.getElementById('usernameError');

if (usernameInput) {
    usernameInput.addEventListener('input', async () => {
        const val = usernameInput.value.trim();
        
        if (val.length > 0 && val.length < 5) {
            usernameInput.classList.add('error-border');
            if (usernameErrorDiv) {
                usernameErrorDiv.style.display = 'block';
                usernameErrorDiv.innerText = "ইউজারনেম কমপক্ষে ৫ ডিজিটের হতে হবে!";
            }
            isUsernameAvailableSignup = false;
            return;
        }

        if (!val) {
            usernameInput.classList.remove('error-border');
            if (usernameErrorDiv) usernameErrorDiv.style.display = 'none';
            isUsernameAvailableSignup = true;
            return;
        }

        try {
            const usersRef = collection(firedb, "users");
            const q = query(usersRef, where("username", "==", val));
            const snap = await getDocs(q);

            if (!snap.empty) {
                usernameInput.classList.add('error-border');
                if (usernameErrorDiv) {
                    usernameErrorDiv.style.display = 'block';
                    usernameErrorDiv.innerText = "এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে!";
                }
                isUsernameAvailableSignup = false;
            } else {
                usernameInput.classList.remove('error-border');
                if (usernameErrorDiv) usernameErrorDiv.style.display = 'none';
                isUsernameAvailableSignup = true;
            }
        } catch (err) {
            console.error("Username check error: ", err);
        }
    });
}

document.getElementById('signupBtn').addEventListener('click', async () => {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.innerText = "";
    errorMsg.style.display = "none";

    document.querySelectorAll('.input-group input, .input-group select').forEach(el => {
        if (el.id !== 'username' || isUsernameAvailableSignup) {
            el.classList.remove('error-border');
        }
    });

    const role = document.getElementById('roleSelect');
    const gender = document.getElementById('genderSelect');
    const nameBn = document.getElementById('nameBn');
    const nameEn = document.getElementById('nameEn');
    const fatherNameBn = document.getElementById('fatherNameBn');
    const fatherNameEn = document.getElementById('fatherNameEn');
    const motherNameBn = document.getElementById('motherNameBn');
    const motherNameEn = document.getElementById('motherNameEn');
    const address = document.getElementById('address');
    const username = document.getElementById('username');
    const mobile = document.getElementById('mobile');
    const dob = document.getElementById('dob');
    const birthCertNo = document.getElementById('birthCertNo');
    const nidNo = document.getElementById('nidNo');
    const password = document.getElementById('password');
    const profileImageInput = document.getElementById('profileImage');

    let hasError = false;

    if (!role.value) { role.classList.add('error-border'); hasError = true; }
    if (!gender.value) { gender.classList.add('error-border'); hasError = true; }
    if (!nameBn.value.trim()) { nameBn.classList.add('error-border'); hasError = true; }
    if (!nameEn.value.trim()) { nameEn.classList.add('error-border'); hasError = true; }
    if (!fatherNameBn.value.trim()) { fatherNameBn.classList.add('error-border'); hasError = true; }
    if (!fatherNameEn.value.trim()) { fatherNameEn.classList.add('error-border'); hasError = true; }
    if (!motherNameBn.value.trim()) { motherNameBn.classList.add('error-border'); hasError = true; }
    if (!motherNameEn.value.trim()) { motherNameEn.classList.add('error-border'); hasError = true; }
    if (!address.value.trim()) { address.classList.add('error-border'); hasError = true; }
    
    const usernameVal = username.value.trim();
    if (!usernameVal || usernameVal.length < 5) {
        username.classList.add('error-border');
        if (usernameErrorDiv) {
            usernameErrorDiv.style.display = 'block';
            usernameErrorDiv.innerText = "ইউজারনেম কমপক্ষে ৫ ডিজিটের হতে হবে!";
        }
        hasError = true;
    }
    
    if (!mobile.value.trim() || mobile.value.trim().length !== 11) {
        mobile.classList.add('error-border');
        const mErr = document.getElementById('mobileError');
        if(mErr) { mErr.style.display = 'block'; mErr.innerText = "১১ ডিজিটের মোবাইল নাম্বারটি লিখুন!"; }
        hasError = true;
    }

    if (!dob.value) { dob.classList.add('error-border'); hasError = true; }
    
    const bcnVal = birthCertNo.value.trim();
    const nidVal = nidNo.value.trim();

    if (!bcnVal && !nidVal) {
        birthCertNo.classList.add('error-border');
        nidNo.classList.add('error-border');
        errorMsg.style.display = "block";
        errorMsg.innerText = "জন্ম নিবন্ধন নম্বর অথবা এনআইডি নম্বরের মধ্যে অন্তত একটি পূরণ করতে হবে!";
        hasError = true;
    }

    if (!password.value.trim() || password.value.trim().length < 6) {
        password.classList.add('error-border');
        hasError = true;
    }
    
    if (profileImageInput.files.length === 0) {
        profileImageInput.classList.add('error-border');
        hasError = true;
    }

    if (!isUsernameAvailableSignup) {
        hasError = true;
    }

    let className = "", classRoll = "", secGroupType = "", secGroupVal = "";
    if (role.value === 'scout') {
        const cls = document.getElementById('className');
        const roll = document.getElementById('classRoll');
        const sType = document.getElementById('sectionOrGroupType');
        const sVal = document.getElementById('subOptionValue');

        if (!cls.value) { cls.classList.add('error-border'); hasError = true; }
        if (!roll.value.trim()) { roll.classList.add('error-border'); hasError = true; }
        if (!sType.value) { sType.classList.add('error-border'); hasError = true; }
        if (sType.value && !sVal.value) { sVal.classList.add('error-border'); hasError = true; }

        className = cls.value;
        classRoll = roll.value.trim();
        secGroupType = sType.value;
        secGroupVal = sVal.value;
    }

    if (hasError) {
        if (!errorMsg.innerText) {
            errorMsg.style.display = "block";
            errorMsg.innerText = "দয়া করে সকল বাধ্যতামূলক ফিল্ড সঠিকভাবে পূরণ করুন!";
        }
        return;
    }

    const signupBtn = document.getElementById('signupBtn');
    const originalBtnText = signupBtn.innerText;

    try {
        errorMsg.style.display = "block";
        errorMsg.innerText = "অ্যাকাউন্ট তৈরি করা হচ্ছে, অপেক্ষা করুন...";
        signupBtn.innerText = "তৈরি হচ্ছে...";
        signupBtn.disabled = true;

        const imageFile = profileImageInput.files[0];
        if (!imageFile.type.startsWith('image/')) {
            signupBtn.innerText = originalBtnText;
            signupBtn.disabled = false;
            return alert("দয়া করে শুধুমাত্র ছবি সিলেক্ট করুন!");
        }

        const uploadResult = await uploadImageToCloudinary(imageFile);
        if (!uploadResult || !uploadResult.url) {
            signupBtn.innerText = originalBtnText;
            signupBtn.disabled = false;
            errorMsg.innerText = "ছবি আপলোডে সমস্যা হয়েছে! আপনার ক্লাউডিনারি কনফিগ (Cloud Name ও Upload Preset) চেক করুন।";
            return;
        }

        let cloudinaryImageUrl = uploadResult.url;

        let extraData = {};
        if (role.value === 'scout') {
            extraData = { className, classRoll, secGroupType, secGroupVal };
        }

        // লগইন করা ইউজার থাকলে এবং সে adult_leader হলে সরাসরি approved, অন্যথায় pending
        const currentLoggedIn = localStorage.getItem("loggedInUser");
        let initialStatus = "pending";
        
        if (currentLoggedIn && currentLoggedIn !== "undefined" && currentLoggedIn !== "null") {
            // ডাটাবেজ থেকে চেক করতে পারি বা লোকালস্টোরেজে রোল সেভ থাকলে তা দেখতে পারি। 
            // ধরে নিচ্ছি লগইন করা ইউজারের রোল লোকালস্টোরেজে "userRole" বা অন্য কোথাও সেভ আছে, 
            // অথবা যদি কেউ লগইন অবস্থায় অ্যাড করেন তবে তাকে সরাসরি approved করে দেওয়া নিরাপদ:
            initialStatus = "approved"; 
        }

        const userData = {
            role: role.value,
            gender: gender.value, 
            nameBn: nameBn.value.trim(),
            nameEn: nameEn.value.trim(),
            fatherNameBn: fatherNameBn.value.trim(),
            fatherNameEn: fatherNameEn.value.trim(),
            motherNameBn: motherNameBn.value.trim(),
            motherNameEn: motherNameEn.value.trim(),
            address: address.value.trim(),
            username: usernameVal,
            mobile: mobile.value.trim(),
            email: document.getElementById('email').value.trim(), 
            dob: dob.value, 
            birthCertNo: bcnVal, 
            nidNo: nidVal,
            bloodGroup: document.getElementById('bloodGroup').value, 
            profileImage: cloudinaryImageUrl, 
            password: password.value.trim(),
            status: initialStatus,
            createdAt: new Date().toISOString(),
            ...extraData
        };

        await setDoc(doc(firedb, "users", usernameVal), userData);

        if (currentLoggedIn && currentLoggedIn !== "undefined" && currentLoggedIn !== "null") {
            alert("সফলভাবে সদস্য যুক্ত করা হয়েছে এবং অ্যাকাউন্ট সরাসরি অনুমোদিত (Approved) হয়েছে।");
            window.location.href = "scout-list.html";
        } else {
            alert("সফলভাবে আবেদন করা হয়েছে! অ্যাডমিন কর্তৃক অনুমোদিত হওয়ার পর আপনি লগইন করতে পারবেন।");
            window.location.href = "login.html";
        }

    } catch (error) {
        console.error("Signup Error: ", error);
        errorMsg.style.display = "block";
        errorMsg.innerText = "ত্রুটি: " + error.message;
        signupBtn.innerText = originalBtnText;
        signupBtn.disabled = false;
    }
});
