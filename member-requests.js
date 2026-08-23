import { firedb } from './firebase-config.js';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loggedInUser = localStorage.getItem("loggedInUser");

document.addEventListener("DOMContentLoaded", async () => {
    if (!loggedInUser) {
        window.location.href = "login.html";
        return;
    }

    try {
        await getDocs(query(collection(firedb, "users"), where("username", "==", loggedInUser)));
    } catch (e) {
        console.error(e);
    }

    loadPendingRequests();
});

async function loadPendingRequests() {
    const listContainer = document.getElementById('requestsList');
    const badge = document.getElementById('reqCountBadge');

    listContainer.innerHTML = "";

    try {
        const usersRef = collection(firedb, "users");
        const q = query(usersRef, where("status", "==", "pending"));
        const snapshot = await getDocs(q);

        let count = 0;

        if (snapshot.empty) {
            listContainer.innerHTML = `<div class="no-request">কোনো নতুন সদস্য রিকোয়েস্ট নেই।</div>`;
            badge.innerText = "0";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const username = docSnap.id;
            count++;

            const roleLower = (data.role || "").toLowerCase();
            const isScout = roleLower === "scout";

            let extraInfoHtml = "";
            if (isScout) {
                const className = data.className || data.class || '';
                const roll = data.classRoll || data.roll || '';
                
                // secGroupType এবং secGroupVal অনুযায়ী ডায়নামিক লেবেল (সেকশন বা গ্রুপ) তৈরি করা
                let secGroupHtml = "";
                const type = (data.secGroupType || "").trim();
                const val = (data.secGroupVal || "").trim();

                if (val !== "") {
                    let label = "সেকশন/গ্রুপ";
                    if (type === "section" || type === "সেকশন") {
                        label = "সেকশন";
                    } else if (type === "group" || type === "গ্রুপ") {
                        label = "গ্রুপ";
                    }
                    secGroupHtml = `<p>${label}: ${val}</p>`;
                }

                let classHtml = className ? `<p>ক্লাস: ${className}</p>` : "";
                let rollHtml = roll ? `<p>রোল: ${roll}</p>` : "";

                if (classHtml || secGroupHtml || rollHtml) {
                    extraInfoHtml = `
                        <div class="user-right-info">
                            ${classHtml}
                            ${secGroupHtml}
                            ${rollHtml}
                        </div>
                    `;
                }
            }

            const card = document.createElement('div');
            card.className = 'request-card';
            card.innerHTML = `
                <div class="user-info-row">
                    <img src="${data.profileImage || 'https://via.placeholder.com/60'}" class="user-avatar" alt="Profile">
                    <div class="user-details">
                        <div class="user-left-info">
                            <h3>${data.nameBn || data.nameEn || data.fullName || data.name || 'নামহীন'} (${data.role || 'স্কাউট'})</h3>
                            <p>ইউজারনেম: <b>${username}</b></p>
                            <p>মোবাইল: ${data.mobile || 'প্রযোজ্য নয়'}</p>
                            <p>ঠিকানা: ${data.address || 'প্রযোজ্য নয়'}</p>
                        </div>
                        ${extraInfoHtml}
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn-approve" onclick="approveMember('${username}')">এপ্রুভ করুন</button>
                    <button class="btn-reject" onclick="rejectMember('${username}')">বাতিল করুন</button>
                </div>
            `;
            listContainer.appendChild(card);
        });

        badge.innerText = count;

    } catch (error) {
        console.error("Error loading requests: ", error);
        listContainer.innerHTML = `<div class="no-request">ডেটা লোড করতে সমস্যা হয়েছে।</div>`;
    }
}

window.approveMember = async function(username) {
    if (!confirm("আপনি কি এই সদস্যকে এপ্রুভ করতে চান?")) return;
    try {
        const userRef = doc(firedb, "users", username);
        await updateDoc(userRef, {
            status: "approved"
        });
        alert("সদস্য সফলভাবে এপ্রুভ করা হয়েছে!");
        loadPendingRequests();
    } catch (err) {
        console.error("Approve error: ", err);
        alert("সমস্যা হয়েছে: " + err.message);
    }
}

window.rejectMember = async function(username) {
    if (!confirm("আপনি কি এই সদস্যের রিকোয়েস্ট ডিলিট/বাতিল করতে চান?")) return;
    try {
        const userRef = doc(firedb, "users", username);
        await deleteDoc(userRef);
        alert("সদস্য রিকোয়েস্ট বাতিল করা হয়েছে।");
        loadPendingRequests();
    } catch (err) {
        console.error("Reject error: ", err);
        alert("সমস্যা হয়েছে: " + err.message);
    }
}
