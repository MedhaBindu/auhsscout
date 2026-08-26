import { firedb } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadImageToCloudinary } from './cloudinary-config.js';

const docRef = doc(firedb, "siteData", "scoutGalleryData");
let galleryData = { folders: [] };
let currentPath = []; // [] = Root, [fIndex] = Folder, [fIndex, sIndex] = Subfolder
let currentUserRole = null; 
let selectedImageIndices = [];

let statusBar = null;
function createStatusBar() {
    if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.id = 'uploadStatusBar';
        statusBar.style.cssText = `
            display: none;
            padding: 12px 20px;
            margin: 10px 15px;
            background-color: #3b82f6;
            color: white;
            text-align: center;
            font-weight: 500;
            font-size: 14px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            position: relative;
            z-index: 1000;
        `;
        const contentArea = document.getElementById('contentArea');
        if (contentArea && contentArea.parentNode) {
            contentArea.parentNode.insertBefore(statusBar, contentArea);
        } else {
            document.body.insertBefore(statusBar, document.body.firstChild);
        }
    }
}

function showStatus(message, type = 'info') {
    createStatusBar();
    statusBar.style.display = 'block';
    statusBar.innerText = message;
    if (type === 'success') {
        statusBar.style.backgroundColor = '#10b981';
    } else if (type === 'error') {
        statusBar.style.backgroundColor = '#ef4444';
    } else {
        statusBar.style.backgroundColor = '#3b82f6';
    }
}

function hideStatusAfterDelay(delay = 3000) {
    setTimeout(() => {
        if (statusBar) {
            statusBar.style.display = 'none';
        }
    }, delay);
}

async function checkUserRole() {
    try {
        let roleFromStorage = localStorage.getItem("role");
        if (roleFromStorage) return roleFromStorage;

        let loggedInUser = localStorage.getItem("loggedInUser") || localStorage.getItem("scoutUser") || localStorage.getItem("username");
        
        if (loggedInUser === "adult_leader") return "adult_leader";

        if (loggedInUser) {
            let userDoc = await getDoc(doc(firedb, "users", loggedInUser));
            if (userDoc.exists()) {
                let userData = userDoc.data();
                if (userData.role) {
                    return userData.role;
                }
            }
        }
    } catch (e) {
        console.log("Role check error:", e);
    }
    return null;
}

document.addEventListener("DOMContentLoaded", async () => {
    currentUserRole = await checkUserRole();

    if (!currentUserRole) {
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: #f8fafc; font-family: sans-serif; text-align: center; padding: 20px;">
                <div>
                    <h2 style="color: #ef4444; margin-bottom: 10px;">অ্যাক্সেস Denied!</h2>
                    <p style="font-size: 16px; color: #94a3b8; margin-bottom: 20px;">আফাজ উদ্দিন উচ্চ বিদ্যালয় স্কাউট গ্রুপ এর সদস্য ব্যতিরেকে অন্য কোনো ব্যক্তি গ্যালারি দেখতে পারবে না।</p>
                    <a href="login.html" style="background: #0284c7; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">লগইন করুন</a>
                </div>
            </div>
        `;
        return;
    }

    await loadData();
    injectHiddenFileInput();
    createStatusBar();
});

async function loadData() {
    let snap = await getDoc(docRef);
    if (snap.exists()) {
        galleryData = snap.data();
        if(!galleryData.folders) galleryData.folders = [];
    }
    renderView();
}

async function saveData() {
    await setDoc(docRef, galleryData);
    renderView();
}

const genId = () => Math.random().toString(36).substr(2, 9);

function injectHiddenFileInput() {
    if (document.getElementById("dynamicImageInput")) return;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "dynamicImageInput";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    fileInput.addEventListener("change", handleImageUploadToCloudinary);
    document.body.appendChild(fileInput);
}

window.renderView = function() {
    const content = document.getElementById("contentArea");
    const leftAction = document.getElementById("leftActionContainer");
    const rightAction = document.getElementById("rightActionContainer");
    
    content.innerHTML = "";
    leftAction.innerHTML = "";
    rightAction.innerHTML = "";
    selectedImageIndices = [];
    let multiBar = document.getElementById("multiDeleteBar");
    if(multiBar) multiBar.style.display = "none";

    let backToAboutBtn = `<a href="about-us.html" class="btn-left-corner">⬅ পিছনে</a>`;
    let isAdultLeader = (currentUserRole === "adult_leader");

    // Root View
    if (currentPath.length === 0) {
        leftAction.innerHTML = backToAboutBtn;

        if (isAdultLeader) {
            rightAction.innerHTML = `<button class="btn-right-corner" onclick="addFolder()">+ ফোল্ডার তৈরি</button>`;
        }

        galleryData.folders.forEach((folder, fIndex) => {
            content.innerHTML += createCard("📁", folder.name, `goToFolder(${fIndex})`, isAdultLeader, fIndex, null, null);
        });
        if(galleryData.folders.length === 0) content.innerHTML = `<p style="color: #94a3b8; grid-column: 1/-1; text-align:center;">কোনো ফোল্ডার নেই।</p>`;
    } 
    // Folder View
    else if (currentPath.length === 1) {
        let fIndex = currentPath[0];
        let folder = galleryData.folders[fIndex];
        
        leftAction.innerHTML = `
            <div class="breadcrumb-box" onclick="goBack()">
                <span>⬅</span> <span>${folder.name}</span>
            </div>
        `;
        
        if (isAdultLeader) {
            rightAction.innerHTML = `<button class="btn-right-corner" onclick="addSubFolder(${fIndex})">+ সাব-ফোল্ডার তৈরি</button>`;
        }

        folder.subfolders = folder.subfolders || [];
        folder.subfolders.forEach((sub, sIndex) => {
            content.innerHTML += createCard("📂", sub.name, `goToSubFolder(${fIndex}, ${sIndex})`, isAdultLeader, fIndex, sIndex, null);
        });
        if(folder.subfolders.length === 0) content.innerHTML = `<p style="color: #94a3b8; grid-column: 1/-1; text-align:center;">কোনো সাব-ফোল্ডার নেই।</p>`;
    }
    // Subfolder View
    else if (currentPath.length === 2) {
        let fIndex = currentPath[0];
        let sIndex = currentPath[1];
        let sub = galleryData.folders[fIndex].subfolders[sIndex];
        
        leftAction.innerHTML = `
            <div class="breadcrumb-box" onclick="goBack()">
                <span>⬅</span> <span>${sub.name}</span>
            </div>
        `;
        
        if (isAdultLeader) {
            rightAction.innerHTML = `<button class="btn-right-corner" onclick="triggerImageUpload()">+ ছবি আপলোড</button>`;
        }

        sub.images = sub.images || [];
        sub.images.forEach((img, iIndex) => {
            content.innerHTML += createImageCard(img.url, isAdultLeader, fIndex, sIndex, iIndex);
        });
        if(sub.images.length === 0) content.innerHTML = `<p style="color: #94a3b8; grid-column: 1/-1; text-align:center;">কোনো ছবি নেই।</p>`;
    }
}

function createCard(icon, name, clickAction, showMenu, fIdx, sIdx, iIdx) {
    return `
    <div class="item-card">
        <div onclick="${clickAction}" style="cursor: pointer;">
            <div class="folder-icon">${icon}</div>
            <div class="item-name">${name}</div>
        </div>
        ${showMenu ? `
        <div class="dots-menu" onclick="toggleMenu(event, this)">⋮
            <div class="dropdown">
                <button onclick="renameItem(${fIdx}, ${sIdx}, ${iIdx})">রিনেম করুন</button>
                <button class="del" onclick="deleteItem(${fIdx}, ${sIdx}, ${iIdx})">ডিলিট করুন</button>
            </div>
        </div>` : ''}
    </div>`;
}

function createImageCard(url, showMenu, fIdx, sIdx, iIndex) {
    return `
    <div class="item-card" id="card-${iIndex}">
        ${showMenu ? `<input type="checkbox" class="img-checkbox" data-index="${iIndex}" onchange="handleCheckboxChange(event, ${iIndex})">` : ''}
        <div onclick="openViewer('${url}')" style="cursor: pointer;">
            <img src="${url}" class="item-img" alt="Photo" loading="lazy">
        </div>
        ${showMenu ? `
        <div class="dots-menu" onclick="toggleMenu(event, this)">⋮
            <div class="dropdown">
                <button class="del" onclick="deleteItem(${fIdx}, ${sIdx}, ${iIndex})">ডিলিট করুন</button>
            </div>
        </div>` : ''}
    </div>`;
}

window.goToFolder = (idx) => { currentPath = [idx]; renderView(); }
window.goToSubFolder = (fIdx, sIdx) => { currentPath = [fIdx, sIdx]; renderView(); }
window.goBack = () => { 
    if(currentPath.length > 0) currentPath.pop(); 
    renderView(); 
}

window.addFolder = async () => {
    if (currentUserRole !== "adult_leader") return alert("আপনার এই কাজ করার অনুমতি নেই!");
    let name = prompt("ফোল্ডারের নাম দিন:");
    if(name) { galleryData.folders.push({ id: genId(), name, subfolders: [] }); await saveData(); }
}

window.addSubFolder = async () => {
    if (currentUserRole !== "adult_leader") return alert("আপনার এই কাজ করার অনুমতি নেই!");
    let fIdx = currentPath[0];
    let name = prompt("সাব-ফোল্ডারের নাম দিন:");
    if(name) { galleryData.folders[fIdx].subfolders.push({ id: genId(), name, images: [] }); await saveData(); }
}

window.triggerImageUpload = () => {
    if (currentUserRole !== "adult_leader") return alert("আপনার ছবি আপলোড করার অনুমতি নেই!");
    const fileInput = document.getElementById("dynamicImageInput");
    if(fileInput) fileInput.click();
}

async function handleImageUploadToCloudinary(e) {
    if (currentUserRole !== "adult_leader") return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let fIdx = currentPath[0];
    let sIdx = currentPath[1];
    let successCount = 0;

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            showStatus(`ছবি আপলোড হচ্ছে (${i + 1}/${files.length})...`, 'info');

            let uploadResult = await uploadImageToCloudinary(file);

            if (uploadResult && uploadResult.url) {
                let optimizedUrl = uploadResult.url.replace('/upload/', '/upload/q_auto,f_auto/');

                galleryData.folders[fIdx].subfolders[sIdx].images.push({ 
                    id: genId(), 
                    url: optimizedUrl,
                    public_id: uploadResult.public_id || "" 
                });
                successCount++;
            }
        }

        await saveData();
        showStatus(`সফলভাবে ${successCount}টি ছবি আপলোড করা হয়েছে!`, 'success');
        hideStatusAfterDelay(3000);

    } catch (err) {
        console.error("Upload error:", err);
        showStatus("সার্ভার ত্রুটির কারণে আপলোড করা যায়নি।", 'error');
        hideStatusAfterDelay(4000);
    } finally {
        e.target.value = "";
    }
}

window.toggleMenu = (e, el) => {
    if (currentUserRole !== "adult_leader") return;
    e.stopPropagation();
    let dropdown = el.querySelector('.dropdown');
    let isVisible = dropdown.style.display === 'flex';
    document.querySelectorAll('.dropdown').forEach(d => d.style.display = 'none'); 
    dropdown.style.display = isVisible ? 'none' : 'flex';
}

window.renameItem = async (fIdx, sIdx, iIdx) => {
    if (currentUserRole !== "adult_leader") return;
    let newName = prompt("নতুন নাম লিখুন:");
    if(!newName) return;
    if(sIdx === null) galleryData.folders[fIdx].name = newName;
    else if(iIdx === null) galleryData.folders[fIdx].subfolders[sIdx].name = newName;
    await saveData();
}

// 🔥 ফোল্ডার, সাব-ফোল্ডার বা ছবি ডিলিট করার ফাংশন (Cloudinary Public ID সহ ফায়ারস্টোর থেকে চিরতরে ডিলিট)
window.deleteItem = async (fIdx, sIdx, iIdx) => {
    if (currentUserRole !== "adult_leader") return;
    if(!confirm("এটি চিরতরে ডিলিট করতে চান?")) return;

    if(sIdx === null) {
        // মেইন ফোল্ডার ডিলিট করা হচ্ছে (এর ভেতরের সব সাবফোল্ডার ও ছবির ইনফো ফায়ারস্টোর থেকে রিমুভ হবে)
        galleryData.folders.splice(fIdx, 1);
    } else if(iIdx === null) {
        // সাব-ফোল্ডার ডিলিট করা হচ্ছে
        galleryData.folders[fIdx].subfolders.splice(sIdx, 1);
    } else {
        // নির্দিষ্ট ছবি ডিলিট করা হচ্ছে
        let imageObj = galleryData.folders[fIdx].subfolders[sIdx].images[iIdx];
        if (imageObj && imageObj.public_id) {
            console.log("Deleted Cloudinary Public ID Reference:", imageObj.public_id);
            // দ্রষ্টব্য: ব্রাউজার থেকে সরাসরি ক্লাউডিনারি রিমুভ করতে সিক্রেট কি লাগে, 
            // তাই ফায়ারস্টোর থেকে লিংক পুরোপুরি মুছে ফেলার পাশাপাশি পাবলিক আইডি লগ রাখা হলো।
        }
        galleryData.folders[fIdx].subfolders[sIdx].images.splice(iIdx, 1);
    }
    await saveData();
    showStatus("সফলভাবে ডিলিট করা হয়েছে!", "success");
    hideStatusAfterDelay(2000);
}

window.handleCheckboxChange = (e, iIndex) => {
    if (currentUserRole !== "adult_leader") return;
    e.stopPropagation();
    
    if (e.target.checked) {
        if (!selectedImageIndices.includes(iIndex)) {
            selectedImageIndices.push(iIndex);
        }
    } else {
        selectedImageIndices = selectedImageIndices.filter(item => item !== iIndex);
    }

    let bar = document.getElementById("multiDeleteBar");
    let countText = document.getElementById("selectedCountText");
    if (selectedImageIndices.length > 0) {
        if(bar) bar.style.display = "flex";
        if(countText) countText.innerText = `${selectedImageIndices.length}টি ছবি সিলেক্ট করা হয়েছে`;
    } else {
        if(bar) bar.style.display = "none";
    }
}

window.clearSelection = () => {
    document.querySelectorAll('.img-checkbox').forEach(cb => cb.checked = false);
    selectedImageIndices = [];
    let bar = document.getElementById("multiDeleteBar");
    if(bar) bar.style.display = "none";
}

// 🔥 একাধিক ছবি একসাথে সিলেক্ট করে ডিলিট করার ফাংশন
window.deleteSelectedImages = async () => {
    if (currentUserRole !== "adult_leader") return;
    if(!confirm("সিলেক্ট করা ছবিগুলো ডিলিট করতে চান?")) return;
    
    let fIndex = currentPath[0];
    let sIndex = currentPath[1];
    let sub = galleryData.folders[fIndex].subfolders[sIndex];
    
    selectedImageIndices.sort((a, b) => b - a);
    selectedImageIndices.forEach(idx => {
        let imageObj = sub.images[idx];
        if (imageObj && imageObj.public_id) {
            console.log("Batch Deleted Public ID:", imageObj.public_id);
        }
        sub.images.splice(idx, 1);
    });
    
    await saveData();
    clearSelection();
    showStatus("সিলেক্ট করা ছবিগুলো সফলভাবে ডিলিট করা হয়েছে!", "success");
    hideStatusAfterDelay(2500);
}

window.openViewer = (url) => {
    let fullUrl = url.replace('/upload/q_auto,f_auto/', '/upload/q_100/');
    document.getElementById("viewerImg").src = fullUrl;
    document.getElementById("imageViewer").style.display = "flex";
}

window.closeViewer = () => document.getElementById("imageViewer").style.display = "none";

window.downloadImage = () => {
    let url = document.getElementById("viewerImg").src;
    let downloadUrl = url.replace('/upload/q_auto,f_auto/', '/upload/q_100/').replace('/upload/q_100/', '/upload/fl_attachment/');
    
    fetch(downloadUrl)
    .then(resp => resp.blob())
    .then(blob => {
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "scout_image_" + Date.now() + ".jpg";
        a.click();
    })
    .catch(() => {
        window.open(downloadUrl, '_blank'); 
    });
}

document.onclick = () => document.querySelectorAll('.dropdown').forEach(d => d.style.display = 'none');
