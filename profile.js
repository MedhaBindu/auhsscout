import { firedb } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadImageToCloudinary } from './cloudinary-config.js'; // ক্লাউডিনারি কনফিগ ফাইল থেকে ইম্পোর্ট করা হলো

const loggedInUser = localStorage.getItem("loggedInUser"); 
if (!loggedInUser) {
    window.location.href = "login.html";
}

const urlParams = new URLSearchParams(window.location.search);
const targetUid = urlParams.get("uid");

const profileTargetKey = targetUid ? targetUid : loggedInUser;
const userRef = doc(firedb, "users", profileTargetKey);

let currentData = {};
let canEdit = false;

async function loadProfile() {
    try {
        let isUserAdultLeader = false;
        if (targetUid && targetUid !== loggedInUser) {
            const loggedInRef = doc(firedb, "users", loggedInUser);
            const loggedInSnap = await getDoc(loggedInRef);
            if (loggedInSnap.exists()) {
                const loggedInData = loggedInSnap.data();
                const role = loggedInData.role ? loggedInData.role.toLowerCase().trim() : "";
                if (role === "adult leader" || role === "adult_leader") {
                    isUserAdultLeader = true;
                }
            }
        }

        canEdit = (!targetUid || targetUid === loggedInUser || isUserAdultLeader);

        const snap = await getDoc(userRef);
        if (snap.exists()) {
            currentData = snap.data();
            
            if (currentData.profileImage) {
                let displayImg = currentData.profileImage.replace('/upload/', '/upload/w_300,h_300,c_fill,q_auto,f_auto/');
                let userImgEl = document.getElementById('userImg');
                userImgEl.src = displayImg;
                
                userImgEl.onclick = () => {
                    let hdImg = currentData.profileImage.replace('/upload/', '/upload/q_100/');
                    window.open(hdImg, '_blank');
                };
                userImgEl.style.cursor = "pointer";
            }
            
            document.getElementById('dispUsername').innerText = "@" + (currentData.username || profileTargetKey);
            document.getElementById('dispNameBn').innerText = currentData.nameBn || "";
            document.getElementById('dispNameEn').innerText = currentData.nameEn ? "(" + currentData.nameEn + ")" : "";
            
            document.querySelector('#valDob .static').innerText = currentData.dob || "";
            document.querySelector('#valBlood .static').innerText = currentData.bloodGroup || "প্রযোজ্য নয়";
            let genderText = currentData.gender || "প্রযোজ্য নয়";
            if (genderText.toLowerCase() === 'male') genderText = 'Male (পুরুষ)';
            else if (genderText.toLowerCase() === 'female') genderText = 'Female (মহিলা)';
            document.querySelector('#valGender .static').innerText = genderText;

            document.querySelector('#valBcn .static').innerText = currentData.birthCertNo || "";
            
            document.querySelector('#valFatherBn .static').innerText = currentData.fatherNameBn || "";
            document.querySelector('#valFatherEn .static').innerText = currentData.fatherNameEn || "";
            document.querySelector('#valMotherBn .static').innerText = currentData.motherNameBn || "";
            document.querySelector('#valMotherEn .static').innerText = currentData.motherNameEn || "";
            
            document.querySelector('#valAddr .static').innerText = currentData.address || "";
            document.querySelector('#valMobile .static').innerText = currentData.mobile || "";
            document.querySelector('#valEmail .static').innerText = currentData.email || "";
            document.getElementById('valRole').innerText = currentData.role === 'scout' ? 'স্কাউট' : 'অ্যাডাল্ট লিডার';

            if (currentData.role === 'scout') {
                document.getElementById('studentSection').style.display = 'block';
                document.querySelector('#valClass .static').innerText = currentData.className || '';
                document.querySelector('#valRoll .static').innerText = currentData.classRoll || '';
                
                const groupTypeLabel = currentData.secGroupType === 'group' ? 'গ্রুপ' : 'শাখা';
                document.getElementById('secGroupTypeLabel').innerText = groupTypeLabel;
                document.querySelector('#valSecGroup .static').innerText = currentData.secGroupVal || '';
            }

            if (!canEdit) {
                const editBtnEl = document.getElementById('editBtn');
                if (editBtnEl) editBtnEl.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("প্রোফাইল লোড করতে সমস্যা হয়েছে:", error);
    }
}

// প্রোফাইল এডিটে রোল ফিল্ড, মোবাইল নাম্বার, ইউজারনেম ও ইমেজ প্রিভিউ হ্যান্ডলিং
document.addEventListener("DOMContentLoaded", () => {
    const editImageInput = document.getElementById('editImage');
    if (editImageInput) {
        editImageInput.setAttribute('accept', 'image/*');
        
        // ছবি সিলেক্ট করার সাথে সাথে গোল বৃত্তে লাইভ প্রিভিউ দেখানোর জন্য
        editImageInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const userImgEl = document.getElementById('userImg');
                    if (userImgEl) {
                        userImgEl.src = e.target.result; // প্রিভিউ সেট হবে
                    }
                }
                reader.readAsDataURL(file);
            }
        });
    }

    const editRollInput = document.getElementById('editRoll');
    if (editRollInput) {
        editRollInput.setAttribute('type', 'tel');
        editRollInput.setAttribute('pattern', '[0-9]*');
        editRollInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
        });
    }

    const editMobileInput = document.getElementById('editMobile');
    if (editMobileInput) {
        editMobileInput.setAttribute('type', 'tel');
        editMobileInput.setAttribute('maxlength', '11');
        editMobileInput.setAttribute('pattern', '[0-9]*');

        let editMobError = document.getElementById('editMobError');
        if (!editMobError) {
            editMobError = document.createElement('div');
            editMobError.id = 'editMobError';
            editMobError.style.color = '#ef4444';
            editMobError.style.fontSize = '12px';
            editMobError.style.marginTop = '4px';
            editMobError.style.display = 'none';
            editMobileInput.parentNode.appendChild(editMobError);
        }

        editMobileInput.addEventListener('input', function() {
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
                editMobError.style.display = 'block';
                editMobError.innerText = "১১ ডিজিটের মোবাইল নাম্বারটি লিখুন!";
            } else {
                this.classList.remove('error-border');
                editMobError.style.display = 'none';
            }
        });
    }

    const editUsernameInput = document.getElementById('editUsername');
    if (editUsernameInput) {
        editUsernameInput.addEventListener('input', function() {
            let val = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
            this.value = val;
        });
    }
});

const editBcnInput = document.getElementById('editBcn');
const bcnError = document.getElementById('bcnError');

if (editBcnInput) {
    editBcnInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
        
        if (this.value.length > 0 && this.value.length !== 17) {
            this.classList.add('error-border');
            bcnError.style.display = 'block';
            if (this.value.length < 17) {
                bcnError.innerText = "জন্ম নিবন্ধন নম্বর কম হয়েছে (১৭ ডিজিট হতে হবে)!";
            } else {
                bcnError.innerText = "জন্ম নিবন্ধন নম্বর ১৭ ডিজিটের বেশি হতে পারবে না!";
            }
        } else {
            this.classList.remove('error-border');
            bcnError.style.display = 'none';
        }
    });
}

let isUsernameAvailableProfile = true;
const editUsernameInput = document.getElementById('editUsername');
const editUsernameError = document.getElementById('editUsernameError');

if (editUsernameInput) {
    editUsernameInput.addEventListener('input', async function() {
        const val = this.value.trim();
        if (!val || val === currentData.username) {
            this.classList.remove('error-border');
            if (editUsernameError) editUsernameError.style.display = 'none';
            isUsernameAvailableProfile = true;
            return;
        }

        try {
            const usersRef = collection(firedb, "users");
            const q = query(usersRef, where("username", "==", val));
            const snap = await getDocs(q);

            if (!snap.empty) {
                this.classList.add('error-border');
                if (editUsernameError) {
                    editUsernameError.style.display = 'block';
                    editUsernameError.innerText = "এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হয়েছে!";
                }
                isUsernameAvailableProfile = false;
            } else {
                this.classList.remove('error-border');
                if (editUsernameError) editUsernameError.style.display = 'none';
                isUsernameAvailableProfile = true;
            }
        } catch (err) {
            console.error("Profile username check error:", err);
        }
    });
}

const editBtn = document.getElementById('editBtn');
if (editBtn) {
    editBtn.onclick = () => {
        if (!canEdit) return;
        document.querySelectorAll('.card').forEach(c => c.classList.add('edit-mode'));
        document.getElementById('cameraIcon').classList.add('edit-mode-file');
        document.getElementById('editBtn').style.display = 'none';
        document.getElementById('saveBtn').style.display = 'block';

        document.getElementById('editDob').value = currentData.dob || "";
        document.getElementById('editBlood').value = currentData.bloodGroup || "";
        document.getElementById('editBcn').value = currentData.birthCertNo || "";
        document.getElementById('editFatherBn').value = currentData.fatherNameBn || "";
        document.getElementById('editFatherEn').value = currentData.fatherNameEn || "";
        document.getElementById('editMotherBn').value = currentData.motherNameBn || "";
        document.getElementById('editMotherEn').value = currentData.motherNameEn || "";
        document.getElementById('editAddr').value = currentData.address || "";
        document.getElementById('editMobile').value = currentData.mobile || "";
        document.getElementById('editEmail').value = currentData.email || "";
        if (document.getElementById('editUsername')) {
            document.getElementById('editUsername').value = currentData.username || "";
        }

        if (currentData.role === 'scout') {
            document.getElementById('editClass').value = currentData.className || "";
            document.getElementById('editRoll').value = currentData.classRoll || "";
            document.getElementById('editSecGroup').value = currentData.secGroupVal || "";
        }
    };
}

const saveBtn = document.getElementById('saveBtn');
if (saveBtn) {
    saveBtn.onclick = async () => {
        if (!canEdit) return;
        try {
            const bcnVal = document.getElementById('editBcn').value.trim();
            const mobVal = document.getElementById('editMobile').value.trim();
            
            if (bcnVal && bcnVal.length !== 17) {
                editBcnInput.classList.add('error-border');
                bcnError.style.display = 'block';
                bcnError.innerText = "সঠিক ১৭ ডিজিটের জন্ম নিবন্ধন নম্বর প্রদান করুন!";
                alert("জন্ম নিবন্ধন নম্বর ভুল রয়েছে! ১৭ ডিজিট নিশ্চিত করুন।");
                return;
            }

            if (mobVal && mobVal.length !== 11) {
                alert("মোবাইল নাম্বার অবধারিতভাবে ১১ ডিজিটের হতে হবে!");
                return;
            }

            if (!isUsernameAvailableProfile) {
                alert("ইউজারনেমটি সঠিক নয় বা ইতিমধ্যে ব্যবহৃত হচ্ছে!");
                return;
            }

            const originalBtnText = saveBtn.innerText;
            saveBtn.innerText = "আপডেট হচ্ছে...";
            saveBtn.disabled = true;

            let updatedImage = currentData.profileImage;
            const imageFileInput = document.getElementById('editImage');
            const imageFile = imageFileInput && imageFileInput.files ? imageFileInput.files[0] : null;
            
            if (imageFile) {
                if (!imageFile.type.startsWith('image/')) {
                    saveBtn.innerText = originalBtnText;
                    saveBtn.disabled = false;
                    return alert("দয়া করে শুধুমাত্র ছবি সিলেক্ট করুন, কোনো ভিডিও বা অন্য ফাইল নয়!");
                }
                
                try {
                    // ক্লাউডিনারি কনফিগ ফাইল থেকে ইম্পোর্ট করা ফাংশন কল করা হলো
                    const uploadResult = await uploadImageToCloudinary(imageFile);
                    if (uploadResult && uploadResult.url) {
                        updatedImage = uploadResult.url;
                    } else {
                        throw new Error("Cloudinary upload failed");
                    }
                } catch(err) {
                    console.error("Cloudinary Upload Error:", err);
                    saveBtn.innerText = originalBtnText;
                    saveBtn.disabled = false;
                    return alert("ছবি আপলোডে সমস্যা হয়েছে! আবার চেষ্টা করুন।");
                }
            }

            const updatePayload = {
                dob: document.getElementById('editDob').value.trim() || currentData.dob,
                bloodGroup: document.getElementById('editBlood').value || currentData.bloodGroup,
                birthCertNo: bcnVal || currentData.birthCertNo,
                fatherNameBn: document.getElementById('editFatherBn').value.trim() || currentData.fatherNameBn,
                fatherNameEn: document.getElementById('editFatherEn').value.trim() || currentData.fatherNameEn,
                motherNameBn: document.getElementById('editMotherBn').value.trim() || currentData.motherNameBn,
                motherNameEn: document.getElementById('editMotherEn').value.trim() || currentData.motherNameEn,
                address: document.getElementById('editAddr').value.trim() || currentData.address,
                mobile: mobVal || currentData.mobile,
                email: document.getElementById('editEmail').value.trim() || currentData.email,
                profileImage: updatedImage
            };

            if (document.getElementById('editUsername')) {
                const newUname = document.getElementById('editUsername').value.trim();
                if (newUname) {
                    updatePayload.username = newUname;
                }
            }

            if (currentData.role === 'scout') {
                updatePayload.className = document.getElementById('editClass').value.trim() || currentData.className;
                updatePayload.classRoll = document.getElementById('editRoll').value.trim() || currentData.classRoll;
                updatePayload.secGroupVal = document.getElementById('editSecGroup').value.trim() || currentData.secGroupVal;
            }

            await updateDoc(userRef, updatePayload);
            alert("সফলভাবে প্রোফাইল আপডেট হয়েছে!");
            location.reload();
        } catch (error) {
            console.error("আপডেট করতে ত্রুটি হয়েছে: ", error);
            alert("আপডেট করা সম্ভব হয়নি!");
            saveBtn.innerText = "Save / সংরক্ষণ করুন";
            saveBtn.disabled = false;
        }
    };
}

loadProfile();
