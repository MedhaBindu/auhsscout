import { firedb } from './firebase-config.js';
import { collection, query, where, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

function compressImage(file, maxWidth = 300, maxHeight = 300, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

// ইনপুট ফিল্ড ও হেল্পার এলিমেন্ট সেটআপ এবং অটো-অ্যাট্রিবিউট হ্যান্ডলিং
document.addEventListener("DOMContentLoaded", () => {
    // ১. ক্লাস রোল ফিল্ডে নিউমেরিক কিবোর্ড ও শুধুমাত্র সংখ্যা নিশ্চিত করা
    const classRollInput = document.getElementById('classRoll');
    if (classRollInput) {
        classRollInput.setAttribute('type', 'tel');
        classRollInput.setAttribute('pattern', '[0-9]*');
        classRollInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
        });
    }

    // ২. মোবাইল নাম্বার ফিল্ড হ্যান্ডলিং (১১ ডিজিট, 01 দিয়ে শুরু, নিউমেরিক কিবোর্ড)
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

    // ৩. ইউজারনেম ফিল্ড হ্যান্ডলিং (শুধু ইংরেজি ছোট হাতের অক্ষর, স্পেস বা অন্য কিছু নিষেধ)
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', function() {
            let val = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
            this.value = val;
        });
    }

    // ৪. পাসওয়ার্ড ফিল্ড হ্যান্ডলিং (সর্বনিম্ন ৬ ডিজিট)
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

// ইউজারনেম লাইভ চেক লজিক
let isUsernameAvailableSignup = true;
const usernameInput = document.getElementById('username');
const usernameErrorDiv = document.getElementById('usernameError');

if (usernameInput) {
    usernameInput.addEventListener('input', async () => {
        const val = usernameInput.value.trim();
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
    if (!username.value.trim()) { username.classList.add('error-border'); hasError = true; }
    
    // মোবাইল নাম্বার ১১ ডিজিট ও সঠিক কিনা চেক
    if (!mobile.value.trim() || mobile.value.trim().length !== 11) {
        mobile.classList.add('error-border');
        const mErr = document.getElementById('mobileError');
        if(mErr) { mErr.style.display = 'block'; mErr.innerText = "১১ ডিজিটের মোবাইল নাম্বারটি লিখুন!"; }
        hasError = true;
    }

    if (!dob.value) { dob.classList.add('error-border'); hasError = true; }
    
    if (!birthCertNo.value.trim() || birthCertNo.value.trim().length !== 17) {
        birthCertNo.classList.add('error-border');
        document.getElementById('bcnError').style.display = 'block';
        document.getElementById('bcnError').innerText = "জন্ম নিবন্ধন নম্বর অবধারিতভাবে ১৭ ডিজিটের হতে হবে!";
        hasError = true;
    }

    // পাসওয়ার্ড কমপক্ষে ৬ ডিজিট চেক
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
        errorMsg.style.display = "block";
        errorMsg.innerText = "দয়া করে সকল বাধ্যতামূলক ফিল্ড, সঠিক ১১ ডিজিটের মোবাইল, পাসওয়ার্ড ও অন্যান্য তথ্য সঠিকভাবে পূরণ করুন!";
        return;
    }

    try {
        errorMsg.style.display = "block";
        errorMsg.innerText = "অ্যাকাউন্ট তৈরি করা হচ্ছে, অপেক্ষা করুন...";

        let compressedImageBase64 = "";
        const imageFile = profileImageInput.files[0];
        if (imageFile) {
            compressedImageBase64 = await compressImage(imageFile, 250, 250, 0.6);
        }

        let extraData = {};
        if (role.value === 'scout') {
            extraData = { className, classRoll, secGroupType, secGroupVal };
        }

        const currentLoggedIn = localStorage.getItem("loggedInUser");
        let initialStatus = "pending";
        if (currentLoggedIn && currentLoggedIn !== "undefined" && currentLoggedIn !== "null") {
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
            username: username.value.trim(),
            mobile: mobile.value.trim(),
            email: document.getElementById('email').value.trim(), 
            dob: dob.value, 
            birthCertNo: birthCertNo.value.trim(), 
            bloodGroup: document.getElementById('bloodGroup').value, 
            profileImage: compressedImageBase64,
            password: password.value.trim(),
            status: initialStatus,
            createdAt: new Date().toISOString(),
            ...extraData
        };

        await setDoc(doc(firedb, "users", username.value.trim()), userData);

        // লগইন স্ট্যাটাস চেক করে সঠিক অ্যালার্ট মেসেজ ও রিডাইরেকশন হ্যান্ডলিং
        if (currentLoggedIn && currentLoggedIn !== "undefined" && currentLoggedIn !== "null") {
            alert("সফলভাবে সদস্য যুক্ত করা হয়েছে।");
            window.location.href = "scout-list.html";
        } else {
            alert("সফলভাবে আবেদন করা হয়েছে।");
            window.location.href = "login.html";
        }

    } catch (error) {
        console.error("Signup Error: ", error);
        errorMsg.style.display = "block";
        errorMsg.innerText = "ত্রুটি: " + error.message;
    }
});
