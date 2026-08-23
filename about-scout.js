import { firedb } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const docRef = doc(firedb, "siteData", "aboutScoutModernPage");

// এডিট করার সময় ট্র্যাক রাখার জন্য গ্লোবাল ভেরিয়েবল
window.editingContext = null; 

// বর্তমানে কোন ক্যাটাগরি ওপেন আছে তা ট্র্যাক করার জন্য
let currentActiveCategory = null;

// কঠোরভাবে শুধু 'adult_leader' রোল চেক করার ফাংশন
async function checkIsAdultLeader() {
    try {
        // ১. লোকাল স্টোরেজ থেকে সরাসরি লগইন করা ইউজারের আইডি বা ইউজারনেম নেওয়া
        let currentUsername = localStorage.getItem("loggedInUser") || localStorage.getItem("scoutUser") || localStorage.getItem("currentUser") || localStorage.getItem("username");
        
        // যদি লোকাল স্টোরেজেচ্ছু কিছুই না থাকে, তবে সে নিশ্চিতভাবেই নন-ইউজার (অ্যাডমিন নয়)
        if (!currentUsername) return false;

        // যদি JSON অবজেক্ট আকারে সেভ থাকে
        try {
            let parsed = JSON.parse(currentUsername);
            if (typeof parsed === 'object' && parsed !== null) {
                if (parsed.role === "adult_leader") return true;
                currentUsername = parsed.username || parsed.name || parsed.id || "";
            }
        } catch(err) {
            // JSON না হলে স্ট্রিং হিসেবে ধরবে
        }

        // লোকাল স্টোরেজে যদি সরাসরি role="adult_leader" সেভ করা থাকে
        if (localStorage.getItem("role") === "adult_leader") return true;

        // ২. ফায়ারস্টোরের 'users' কালেকশন থেকে নির্দিষ্ট ইউজারের ডকুমেন্ট চেক করা
        if (currentUsername) {
            const userDocRef = doc(firedb, "users", String(currentUsername).trim());
            const userSnap = await getDoc(userDocRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.role === "adult_leader") {
                    return true;
                }
            }
        }

    } catch (e) {
        console.error("Role check error:", e);
    }
    
    // অন্যথায় কাউকেই অ্যাডমিন হিসেবে গণ্য করা হবে না
    return false;
}

document.addEventListener("DOMContentLoaded", async () => {
    const toggleBtn = document.getElementById("togglePostFormBtn");
    const adminSection = document.getElementById("adminPostSection");
    
    // ইউজার অ্যাডাল্ট লিডার কি না তা নিখুঁতভাবে যাচাই করা হচ্ছে
    const isAdultLeader = await checkIsAdultLeader();

    if (toggleBtn) {
        if (isAdultLeader) {
            toggleBtn.style.display = "block";
            toggleBtn.onclick = () => {
                if (!window.editingContext) {
                    clearAdminForm();
                }
                adminSection.style.display = adminSection.style.display === "block" ? "none" : "block";
            };
        } else {
            toggleBtn.style.display = "none"; // নন-ইউজার বা সাধারণ স্কাউট হলে ফর্ম বাটন চিরতরে লুকানো থাকবে
            if (adminSection) adminSection.style.display = "none";
        }
    }

    const cards = document.querySelectorAll(".aesthetic-card");
    cards.forEach(card => {
        card.addEventListener("click", () => {
            const viewType = card.getAttribute("data-view");
            const subViewContainer = document.getElementById("subViewContainer");

            if (currentActiveCategory === viewType && subViewContainer && subViewContainer.style.display === "block") {
                subViewContainer.style.display = "none";
                currentActiveCategory = null;
            } else {
                currentActiveCategory = viewType;
                loadCategoryData(viewType);
            }
        });
    });

    const backMenuBtn = document.getElementById("backToMenuBtn");
    if (backMenuBtn) {
        backMenuBtn.onclick = () => {
            document.getElementById("subViewContainer").style.display = "none";
            currentActiveCategory = null;
        };
    }

    const publishBtn = document.getElementById("submitPublishBtn");
    if (publishBtn) {
        publishBtn.addEventListener("click", async () => {
            if (!(await checkIsAdultLeader())) {
                alert("দুঃখিত! আপনার এই কাজটি করার অনুমতি নেই।");
                return;
            }

            const category = document.getElementById("postCategorySelector").value;
            const title = document.getElementById("postTitle").value.trim();

            if (!title) {
                alert("দয়া করে মূল শিরোনাম লিখুন!");
                return;
            }

            let newItem = { title };

            if (category.includes("Articles")) {
                const sectionGroups = document.querySelectorAll(".section-box-group");
                let sections = [];
                sectionGroups.forEach(group => {
                    const secTitleInput = group.querySelector(".sec-title");
                    const secDescInput = group.querySelector(".sec-desc");
                    const secTitle = secTitleInput ? secTitleInput.value.trim() : "";
                    const secDesc = secDescInput ? secDescInput.value.trim() : "";
                    if (secTitle || secDesc) {
                        sections.push({ secTitle, secDesc });
                    }
                });
                newItem.sections = sections;
                const imgLinkElem = document.getElementById("postImageLink");
                newItem.fileUrl = imgLinkElem ? imgLinkElem.value.trim() : "";
            } else {
                const fileLinkElem = document.getElementById("postFileLink");
                newItem.fileUrl = fileLinkElem ? fileLinkElem.value.trim() : "";
            }

            try {
                let snap = await getDoc(docRef);
                let existingData = snap.exists() ? snap.data() : {};
                
                if (!existingData[category]) {
                    existingData[category] = [];
                }
                
                if (window.editingContext && window.editingContext.category === category) {
                    let idx = window.editingContext.index;
                    existingData[category][idx] = newItem;
                    alert("সফলভাবে আপডেট করা হয়েছে!");
                    window.editingContext = null;
                } else {
                    existingData[category].unshift(newItem);
                    alert("সফলভাবে নতুন আইটেম পাবলিশ করা হয়েছে!");
                }

                await setDoc(docRef, existingData, { merge: true });
                location.reload();
            } catch (error) {
                console.error("Error publishing:", error);
                alert("সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
            }
        });
    }
});

// এডমিন ফর্ম ফাকা করার ফাংশন
function clearAdminForm() {
    const titleElem = document.getElementById("postTitle");
    if (titleElem) titleElem.value = "";
    const imgElem = document.getElementById("postImageLink");
    if (imgElem) imgElem.value = "";
    const fileElem = document.getElementById("postFileLink");
    if (fileElem) fileElem.value = "";
    
    window.editingContext = null;
}

// নির্দিষ্ট ক্যাটাগরির ডেটা লোড করার ফাংশন
async function loadCategoryData(category) {
    const subViewContainer = document.getElementById("subViewContainer");
    const subViewTitle = document.getElementById("subViewTitle");
    const contentList = document.getElementById("subViewContentList");
    const counterBox = document.getElementById("listCounterBox");

    if (subViewContainer) subViewContainer.style.display = "block";

    const titles = {
        nationalBooks: "জাতীয় স্কাউট বইসমূহ",
        internationalBooks: "আন্তর্জাতিক স্কাউট বইসমূহ",
        nationalArticles: "জাতীয় স্কাউট আর্টিকেলসমূহ",
        internationalArticles: "আন্তর্জাতিক স্কাউট আর্টিকেলসমূহ"
    };

    if (subViewTitle) subViewTitle.innerText = titles[category] || "তালিকাসমূহ";
    if (counterBox) counterBox.innerHTML = "";
    if (contentList) contentList.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 20px;">লোড হচ্ছে...</p>`;

    try {
        let snap = await getDoc(docRef);
        if (snap.exists()) {
            let data = snap.data();
            let items = data[category] || [];

            if (items.length === 0) {
                if (counterBox) counterBox.innerHTML = `<span class="list-counter-badge">মোট আইটেম: ০টি</span>`;
                contentList.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 20px;">এই বিভাগে এখনো কোনো তথ্য যোগ করা হয়নি।</p>`;
                return;
            }

            if (counterBox) {
                counterBox.innerHTML = `<span class="list-counter-badge">📊 মোট আইটেম সংখ্যা: ${items.length} টি</span>`;
            }

            // রেন্ডার করার সময় কঠোরভাবে আবার চেক করা হচ্ছে
            const isAdultLeader = await checkIsAdultLeader();

            let html = "";
            items.forEach((item, index) => {
                let rawUrl = item.fileUrl || '#';
                let downloadUrl = rawUrl;
                if (rawUrl.includes("drive.google.com")) {
                    downloadUrl = rawUrl.replace(/\/view.*$/, "/export?format=pdf").replace(/\/edit.*$/, "/export?format=pdf");
                }

                let serialNumber = index + 1;

                // শুধুমাত্র যদি adult_leader হয়, তবেই এডিট ও ডিলিট বাটন দেখাবে
                let actionButtonsHTML = "";
                if (isAdultLeader) {
                    actionButtonsHTML = `
                        <div style="display: flex; gap: 6px;">
                            <button onclick="editItemForm('${category}', ${index})" style="background: #f59e0b; color: #fff; border: none; padding: 4px 8px; border-radius: 5px; font-size: 10.5px; cursor: pointer; font-weight: bold;">✏️ এডিট</button>
                            <button onclick="deleteItem('${category}', ${index})" style="background: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 5px; font-size: 10.5px; cursor: pointer; font-weight: bold;">🗑️ ডিলিট</button>
                        </div>
                    `;
                }

                if (category.includes("Articles")) {
                    html += `
                        <div class="clean-article-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                            <h4 class="clean-article-title" style="margin: 0; width: 100%;">${serialNumber}. ${item.title}</h4>
                            <div style="display: flex; gap: 8px; width: 100%; justify-content: space-between; align-items: center; border-top: 1px solid #1e293b; padding-top: 8px; margin-top: 4px;">
                                <a href="scout-article.html?cat=${category}&index=${index}" class="read-btn-new" style="background: #38bdf8; color: #0b1329; padding: 5px 10px; font-size: 11px; text-decoration: none; border-radius: 4px; font-weight: bold;">বিস্তারিত পড়ুন ➔</a>
                                ${actionButtonsHTML}
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="clean-article-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                            <h4 class="clean-article-title" style="margin: 0; width: 100%;">${serialNumber}. ${item.title}</h4>
                            <div style="display: flex; gap: 6px; width: 100%; justify-content: space-between; align-items: center; flex-wrap: wrap; border-top: 1px solid #1e293b; padding-top: 8px; margin-top: 4px;">
                                <div style="display: flex; gap: 6px;">
                                    <a href="${rawUrl}" target="_blank" style="background: #38bdf8; color: #0b1329; padding: 5px 10px; border-radius: 5px; font-size: 11px; text-decoration: none; font-weight: bold;">👁️ দেখুন</a>
                                    <a href="${downloadUrl}" target="_blank" style="background: #10b981; color: #fff; padding: 5px 10px; border-radius: 5px; font-size: 11px; text-decoration: none; font-weight: bold;">📥 ডাউনলোড</a>
                                </div>
                                ${actionButtonsHTML}
                            </div>
                        </div>
                    `;
                }
            });

            contentList.innerHTML = html;
        } else {
            if (counterBox) counterBox.innerHTML = `<span class="list-counter-badge">মোট আইটেম: ০টি</span>`;
            contentList.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 20px;">কোনো ডেটা পাওয়া যায়নি।</p>`;
        }
    } catch (e) {
        console.error("Error loading data:", e);
        contentList.innerHTML = `<p style="text-align: center; color: #ef4444; padding: 20px;">ডেটা লোড করতে ত্রুটি ঘটেছে।</p>`;
    }
}

// গ্লোবাল ডিলিট ফাংশন (সফলভাবে ডিলিট হওয়ার পরের অ্যালার্ট পপআপ বাদ দেওয়া হয়েছে)
window.deleteItem = async function(category, index) {
    if (!(await checkIsAdultLeader())) {
        alert("আপনার ডিলিট করার অনুমতি নেই।");
        return;
    }
    if (!confirm("আপনি কি নিশ্চিতভাবে এই আইটেমটি ডিলিট করতে চান?")) return;
    try {
        let snap = await getDoc(docRef);
        if (snap.exists()) {
            let data = snap.data();
            if (data[category]) {
                data[category].splice(index, 1);
                await setDoc(docRef, data, { merge: true });
                // এখানে সফলতার পপআপটি (alert) রিমুভ করে দেওয়া হয়েছে
                loadCategoryData(category);
            }
        }
    } catch (err) {
        console.error("Delete error:", err);
        alert("ডিলিট করতে সমস্যা হয়েছে।");
    }
}

// এডিট করার জন্য এডমিন ফর্মে ডেটা লোড করার ফাংশন
window.editItemForm = async function(category, index) {
    if (!(await checkIsAdultLeader())) {
        alert("আপনার এডিট করার অনুমতি নেই।");
        return;
    }
    try {
        let snap = await getDoc(docRef);
        if (snap.exists()) {
            let data = snap.data();
            let item = data[category][index];
            
            let selector = document.getElementById("postCategorySelector");
            if (selector) {
                selector.value = category;
                selector.dispatchEvent(new Event('change'));
            }

            let titleInput = document.getElementById("postTitle");
            if (titleInput) titleInput.value = item.title || "";

            if (!category.includes("Articles")) {
                let fileInput = document.getElementById("postFileLink");
                if (fileInput) fileInput.value = item.fileUrl || "";
            } else {
                let imgInput = document.getElementById("postImageLink");
                if (imgInput) imgInput.value = item.fileUrl || "";

                if (item.sections && item.sections.length > 0) {
                    const firstGroup = document.querySelector(".section-box-group");
                    if (firstGroup) {
                        let sTitle = firstGroup.querySelector(".sec-title");
                        let sDesc = firstGroup.querySelector(".sec-desc");
                        if (sTitle) sTitle.value = item.sections[0].secTitle || "";
                        if (sDesc) sDesc.value = item.sections[0].secDesc || "";
                    }
                }
            }

            window.editingContext = { category, index };

            let adminSec = document.getElementById("adminPostSection");
            if (adminSec) {
                adminSec.style.display = "block";
                adminSec.scrollIntoView({ behavior: 'smooth' });
            }
        }
    } catch (err) {
        console.error("Edit form load error:", err);
        alert("এডিট করার ডেটা লোড করতে সমস্যা হয়েছে।");
    }
}
