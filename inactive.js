import { firedb } from './firebase-config.js';
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loggedInUser = localStorage.getItem("loggedInUser");
let isAdultLeader = false;

async function checkUserAndLoad() {
    if (!loggedInUser) {
        window.location.href = "login.html";
        return;
    }

    try {
        const userRef = doc(firedb, "users", loggedInUser);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const userRole = userData.role ? userData.role.toLowerCase().trim() : "";
            
            isAdultLeader = (userRole === "adult leader" || userRole === "adult_leader");

            // শুধুমাত্র অ্যাডাল্ট লিডাররাই এই পেজ দেখতে পারবে
            if (!isAdultLeader) {
                document.getElementById('unauthorizedDiv').style.display = 'block';
                return;
            }

            document.getElementById('mainAppContainer').style.display = 'flex';
            loadInactiveScouts();
        } else {
            window.location.href = "login.html";
        }
    } catch (err) {
        console.error("অথোরাইজেশন চেক করতে সমস্যা হয়েছে:", err);
    }
}

let allInactiveScouts = [];
let selectedTargetUid = null;

async function loadInactiveScouts() {
    const contentDiv = document.getElementById('scoutListContent');
    contentDiv.innerHTML = "<p style='color:#94a3b8; text-align:center;'>লোড হচ্ছে...</p>";

    try {
        const querySnapshot = await getDocs(collection(firedb, "users"));
        allInactiveScouts = [];
        querySnapshot.forEach((docSnap) => {
            let data = docSnap.data();
            data.uid = docSnap.id;
            
            // শুধুমাত্র ইনঅ্যাক্টিভ মেম্বারদের ফিল্টার করা হলো
            if (data.status === "inactive") {
                allInactiveScouts.push(data);
            }
        });

        applyFilters(); 
    } catch (err) {
        console.error("ইনঅ্যাক্টিভ লিস্ট লোড করতে সমস্যা:", err);
        contentDiv.innerHTML = "<p style='color:#f43f5e; text-align:center;'>ডেটা লোড করতে ব্যর্থ হয়েছে।</p>";
    }
}

function renderScouts(scouts) {
    const contentDiv = document.getElementById('scoutListContent');
    contentDiv.innerHTML = "";

    if (scouts.length === 0) {
        contentDiv.innerHTML = "<p style='color:#94a3b8; text-align:center; padding: 20px;'>কোনো ইনঅ্যাক্টিভ সদস্য নেই।</p>";
        return;
    }

    scouts.forEach((scout, index) => {
        let avatarHTML = scout.profileImage 
            ? `<img src="${scout.profileImage}" class="scout-avatar" alt="">` 
            : `<div class="scout-avatar">👤</div>`;

        let displayName = scout.nameBn || scout.nameEn || scout.fullName || scout.name || "নামহীন সদস্য";

        let rawRole = scout.role ? scout.role.toLowerCase() : "";
        let roleText = (rawRole.includes("leader") || rawRole.includes("adult")) ? "অ্যাডাল্ট লিডার" : "স্কাউট সদস্য";

        let rawClass = scout.className || scout.class || "";
        let classHTML = rawClass ? `<span class="scout-class-inline">• ক্লাস: ${rawClass}</span>` : "";

        let rightActionHTML = `
            <div class="action-area">
                <div class="dropdown-action">
                    <button class="action-btn" onclick="toggleActionMenu('${scout.uid}')">অপশন ▾</button>
                    <div class="action-dropdown-content" id="menu-${scout.uid}">
                        <a href="profile.html?uid=${scout.uid}">প্রোফাইল দেখুন</a>
                        <button onclick="openPasswordModal('${scout.uid}', '${displayName}')">পাসওয়ার্ড পরিবর্তন</button>
                        <button onclick="confirmAndDeleteAccount('${scout.uid}', '${displayName}')" style="color: #f43f5e; font-weight: bold;">অ্যাকাউন্ট ডিলিট</button>
                    </div>
                </div>
                <div class="toggle-container">
                    <span class="status-text inactive" id="st-label-${scout.uid}">Inactive</span>
                    <label class="switch">
                        <input type="checkbox" checked onchange="toggleInactiveStatus('${scout.uid}', this)">
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;

        let row = document.createElement('div');
        row.className = 'scout-row';
        row.innerHTML = `
            <div class="scout-info">
                <span style="color:#94a3b8; font-size:11px; font-weight:bold;">${index + 1}.</span>
                ${avatarHTML}
                <div class="scout-details">
                    <h4 title="${displayName}">${displayName}</h4>
                    <p>
                        <span>${roleText}</span>
                        ${classHTML}
                    </p>
                </div>
            </div>
            <div class="scout-extra">
                ${rightActionHTML}
            </div>
        `;
        contentDiv.appendChild(row);
    });
}

// পাসওয়ার্ড পরিবর্তনের মডাল
window.openPasswordModal = function(uid, name) {
    if (!isAdultLeader) return;
    selectedTargetUid = uid;
    document.getElementById('pwdModalTitle').innerText = `${name}-এর পাসওয়ার্ড পরিবর্তন`;
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('passwordModal').style.display = 'flex';
};

window.closePasswordModal = function() {
    document.getElementById('passwordModal').style.display = 'none';
    selectedTargetUid = null;
};

window.togglePasswordVisibility = function(fieldId, btnElement) {
    let inputField = document.getElementById(fieldId);
    if (inputField.type === "password") {
        inputField.type = "text";
        btnElement.innerText = "🙈";
    } else {
        inputField.type = "password";
        btnElement.innerText = "👁️";
    }
};

window.submitNewPassword = async function() {
    if (!isAdultLeader) return;
    let newPass = document.getElementById('newPassword').value;
    let confirmPass = document.getElementById('confirmPassword').value;

    if (!newPass || !confirmPass) {
        alert("দয়া করে উভয় ফিল্ডে পাসওয়ার্ড দিন!");
        return;
    }

    if (newPass !== confirmPass) {
        alert("দুটি পাসওয়ার্ড এক হয়নি! দয়া করে আবার চেক করুন।");
        return;
    }

    try {
        const userRef = doc(firedb, "users", selectedTargetUid);
        await updateDoc(userRef, { password: newPass });
        alert("পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!");
        closePasswordModal();
    } catch (err) {
        console.error("পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে:", err);
        alert("পাসওয়ার্ড পরিবর্তন করতে ব্যর্থ হয়েছে!");
    }
};

window.confirmAndDeleteAccount = async function(uid, name) {
    if (!isAdultLeader) return;
    let confirmAction = confirm(`সতর্কতা! আপনি কি নিশ্চিতভাবে "${name}"-এর অ্যাকাউন্ট চিরতরে ডিলিট করতে চান?\n\nনিশ্চিত করতে ৩ সেকেন্ড অপেক্ষা করুন এবং 'OK' চাপুন।`);
    
    if (confirmAction) {
        let alertBox = document.createElement('div');
        alertBox.style.position = 'fixed';
        alertBox.style.top = '20px';
        alertBox.style.left = '50%';
        alertBox.style.transform = 'translateX(-50%)';
        alertBox.style.background = '#f43f5e';
        alertBox.style.color = '#fff';
        alertBox.style.padding = '10px 20px';
        alertBox.style.borderRadius = '8px';
        alertBox.style.zIndex = '9999';
        alertBox.style.fontWeight = 'bold';
        alertBox.innerText = "৩ সেকেন্ড কাউন্টডাউন চলছে, অ্যাকাউন্ট ডিলিট হচ্ছে...";
        document.body.appendChild(alertBox);

        setTimeout(async () => {
            try {
                await deleteDoc(doc(firedb, "users", uid));
                alertBox.innerText = "অ্যাকাউন্ট সফলভাবে ডিলিট করা হয়েছে!";
                setTimeout(() => {
                    alertBox.remove();
                    loadInactiveScouts();
                }, 1000);
            } catch (err) {
                console.error("অ্যাকাউন্ট ডিলিট করতে সমস্যা:", err);
                alertBox.remove();
                alert("ডিলিট করতে ব্যর্থ হয়েছে!");
            }
        }, 3000);
    }
};

window.toggleActionMenu = function(uid) {
    if (!isAdultLeader) return;
    event.stopPropagation();
    document.querySelectorAll('.action-dropdown-content').forEach(m => {
        if(m.id !== `menu-${uid}`) m.classList.remove('show-menu');
    });
    let currentMenu = document.getElementById(`menu-${uid}`);
    if(currentMenu) {
        currentMenu.classList.toggle('show-menu');
    }
};

window.onclick = function() {
    document.querySelectorAll('.action-dropdown-content').forEach(m => {
        m.classList.remove('show-menu');
    });
};

// এখানেভ থেকেভ একটিভ করলে সরাসরি লিস্ট থেকে রিমুভ হয়ে যাবে
window.toggleInactiveStatus = async function(uid, checkboxElement) {
    if (!isAdultLeader) return;
    let newStatus = checkboxElement.checked ? "inactive" : "active";
    let confirmMsg = checkboxElement.checked ? "আপনি কি নিশ্চিতভাবে এই সদস্যকে ইনঅ্যাক্টিভ করতে চান?" : "আপনি কি এই সদস্যকে আবার অ্যাক্টিভ করতে চান? (তাহলে এটি স্কাউট লিস্টে চলে যাবে)";
    
    if (confirm(confirmMsg)) {
        try {
            const userRef = doc(firedb, "users", uid);
            await updateDoc(userRef, { status: newStatus });
            
            // সফলভাবে স্ট্যাটাস বদলানোর পর তালিকা থেকে রিফ্রেশ করে সরিয়ে দেওয়া হবে
            loadInactiveScouts();
        } catch (err) {
            console.error("স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে:", err);
            alert("ব্যর্থ হয়েছে!");
            checkboxElement.checked = !checkboxElement.checked;
        }
    } else {
        checkboxElement.checked = !checkboxElement.checked;
    }
};

function applyFilters() {
    const searchNameEl = document.getElementById('searchName');
    const searchUsernameEl = document.getElementById('searchUsername');
    const filterClassEl = document.getElementById('filterClass');
    const filterRoleEl = document.getElementById('filterRole');
    const filterGenderEl = document.getElementById('filterGender');

    const nameVal = searchNameEl ? searchNameEl.value.toLowerCase() : "";
    const usernameVal = searchUsernameEl ? searchUsernameEl.value.toLowerCase() : "";
    const classVal = filterClassEl ? filterClassEl.value.toLowerCase() : "";
    const roleVal = filterRoleEl ? filterRoleEl.value.toLowerCase() : "";
    const genderVal = filterGenderEl ? filterGenderEl.value.toLowerCase() : "";

    const filtered = allInactiveScouts.filter(scout => {
        const name = (scout.nameBn || scout.nameEn || scout.fullName || scout.name || "").toLowerCase();
        const username = (scout.username || "").toLowerCase();
        const sClass = (scout.className || scout.class || "").toLowerCase();
        const sGender = (scout.gender || "").toLowerCase();
        const sRole = (scout.role || "").toLowerCase();

        let matchesRole = true;
        if (roleVal !== "") {
            if (roleVal === "adult leader") {
                matchesRole = sRole.includes("leader") || sRole.includes("adult");
            } else if (roleVal === "scout") {
                matchesRole = !sRole.includes("leader") && !sRole.includes("adult");
            }
        }

        let matchesClass = true;
        if (classVal !== "") {
            matchesClass = sClass.includes(classVal);
        }

        return name.includes(nameVal) &&
               username.includes(usernameVal) &&
               matchesClass &&
               matchesRole &&
               (genderVal === "" || sGender === genderVal);
    });

    renderScouts(filtered);
}

if (document.getElementById('searchName')) document.getElementById('searchName').addEventListener('input', applyFilters);
if (document.getElementById('searchUsername')) document.getElementById('searchUsername').addEventListener('input', applyFilters);
if (document.getElementById('filterClass')) document.getElementById('filterClass').addEventListener('change', applyFilters);
if (document.getElementById('filterRole')) document.getElementById('filterRole').addEventListener('change', applyFilters);
if (document.getElementById('filterGender')) document.getElementById('filterGender').addEventListener('change', applyFilters);

checkUserAndLoad();
