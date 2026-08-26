import { firedb } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadImageToCloudinary } from './cloudinary-config.js'; // ক্লাউডিনারি কনফিগারেশন ইমপোর্ট করা হলো

const docRef = doc(firedb, "siteData", "aboutUsPageNew");

// শুধু role === "adult_leader" চেক করার সঠিক লজিক
async function checkIsAdultLeader() {
    try {
        let loggedInUser = localStorage.getItem("loggedInUser") || localStorage.getItem("username") || localStorage.getItem("scoutUser");
        
        if (localStorage.getItem("role") === "adult_leader") {
            return true;
        }

        if (loggedInUser) {
            let userDoc = await getDoc(doc(firedb, "users", loggedInUser));
            if (userDoc.exists()) {
                let userData = userDoc.data();
                if (userData.role === "adult_leader") {
                    return true;
                }
            }
        }
    } catch (e) {
        console.log("Role check error:", e);
    }
    return false;
}

document.addEventListener("DOMContentLoaded", async () => {
    let isLeader = await checkIsAdultLeader();
    
    if (isLeader) {
        let addSliderBtn = document.getElementById("btnAddSlider");
        let editAboutBtn = document.getElementById("btnEditAbout");
        let editFeedBtn = document.getElementById("btnEditGalleryFeed");

        if (addSliderBtn) addSliderBtn.style.display = "block";
        if (editAboutBtn) editAboutBtn.style.display = "inline-block";
        if (editFeedBtn) editFeedBtn.style.display = "inline-block";
    }

    loadPageData();
    injectCloudinaryUploadUI(); // স্লাইডার ও ফিডের জন্য ডাইনামিক আপলোড বাটন ও ইনপুট যুক্ত করা

    // Modal Triggers
    const addSliderBtn = document.getElementById("btnAddSlider");
    const editAboutBtn = document.getElementById("btnEditAbout");
    const editFeedBtn = document.getElementById("btnEditGalleryFeed");

    if (addSliderBtn) addSliderBtn.onclick = () => document.getElementById("modalSlider").style.display = "flex";
    if (editAboutBtn) editAboutBtn.onclick = openAboutModal;
    if (editFeedBtn) editFeedBtn.onclick = openFeedModal;

    // Save Handlers
    document.getElementById("saveSliderBtn").onclick = saveSlider;
    document.getElementById("saveAboutBtn").onclick = saveAbout;
    document.getElementById("saveFeedBtn").onclick = saveFeed;
});

// স্লাইডার এবং গ্যালারি ফিড মোডালে ডাইনামিক আপলোড বাটন যুক্ত করার লজিক
function injectCloudinaryUploadUI() {
    // ১. স্লাইডার মোডালে টেক্সট ইনপুট লুকিয়ে ফাইল আপলোড বাটন ও স্লট সিলেক্টর যুক্ত করা
    const sliderUrlInput = document.getElementById("sliderUrl");
    if (sliderUrlInput && !document.getElementById("sliderFileBtn")) {
        sliderUrlInput.style.display = "none"; 
        
        const sliderWrapper = document.createElement("div");
        sliderWrapper.style.margin = "8px 0";
        sliderWrapper.innerHTML = `
            <input type="file" id="hiddenSliderFileInput" accept="image/*" style="display: none;">
            <select id="sliderIndexSelect" style="width: 100%; padding: 8px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #1e293b; background: #0f172a; color: #fff; font-size: 12px; outline: none;">
                <option value="0">স্লাইডার স্লট ১ (Slider 1)</option>
                <option value="1">স্লাইডার স্লট ২ (Slider 2)</option>
                <option value="2">স্লাইডার স্লট ৩ (Slider 3)</option>
                <option value="3">স্লাইডার স্লট ৪ (Slider 4)</option>
                <option value="4">স্লাইডার স্লট ৫ (Slider 5)</option>
                <option value="5">স্লাইডার স্লট ৬ (Slider 6)</option>
                <option value="6">স্লাইডার স্লট ৭ (Slider 7)</option>
                <option value="7">স্লাইডার স্লট ৮ (Slider 8)</option>
                <option value="8">স্লাইডার স্লট ৯ (Slider 9)</option>
                <option value="9">স্লাইডার স্লট ১০ (Slider 10)</option>
            </select>
            <button type="button" id="sliderFileBtn" style="background: #0284c7; color: #fff; border: none; padding: 10px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; font-weight: bold; width: 100%;">📁 স্লাইডারের ছবি সিলেক্ট করুন</button>
            <p id="sliderUploadStatus" style="font-size: 11px; color: #38bdf8; margin-top: 6px; text-align: center;"></p>
        `;
        sliderUrlInput.parentNode.insertBefore(sliderWrapper, sliderUrlInput);

        document.getElementById("sliderFileBtn").addEventListener("click", () => {
            document.getElementById("hiddenSliderFileInput").click();
        });

        document.getElementById("hiddenSliderFileInput").addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const selectedSlot = document.getElementById("sliderIndexSelect").value;
            const statusText = document.getElementById("sliderUploadStatus");
            statusText.innerText = "ছবি আপলোড হচ্ছে, অপেক্ষা করুন...";

            try {
                let result = await uploadImageToCloudinary(file);
                
                if (result && result.url) {
                    let optimizedUrl = result.url.replace('/upload/', '/upload/q_auto,f_auto/');
                    sliderUrlInput.value = optimizedUrl; 
                    sliderUrlInput.dataset.slotIndex = selectedSlot; 
                    statusText.innerText = "✅ ছবি সফলভাবে আপলোড হয়েছে! এখন সেভ করুন।";
                } else {
                    statusText.innerText = "❌ আপলোড ব্যর্থ হয়েছে!";
                }
            } catch (err) {
                statusText.innerText = "❌ ত্রুটি ঘটেছে!";
            }
        });
    }

    // ২. গ্যালারি ফিড মোডালের জন্য (feedImg1, feedImg2, feedImg3) আপলোড বাটন যুক্ত করা
    ['feedImg1', 'feedImg2', 'feedImg3'].forEach((id, index) => {
        const inputElem = document.getElementById(id);
        const slotNum = index + 1; 
        if (inputElem && !document.getElementById(id + "_btn")) {
            inputElem.style.display = "none";

            const wrap = document.createElement("div");
            wrap.style.margin = "5px 0 10px 0";
            wrap.innerHTML = `
                <input type="file" id="${id}_file" accept="image/*" style="display: none;">
                <button type="button" id="${id}_btn" style="background: #0284c7; color: #fff; border: none; padding: 8px 10px; border-radius: 6px; font-size: 11.5px; cursor: pointer; font-weight: bold; width: 100%;">📁 গ্যালারি ফিড ছবি (${slotNum}) সিলেক্ট করুন</button>
                <span id="${id}_status" style="font-size: 10.5px; color: #38bdf8; display: block; margin-top: 3px; text-align: center;"></span>
            `;
            inputElem.parentNode.insertBefore(wrap, inputElem);

            document.getElementById(`${id}_btn`).addEventListener("click", () => {
                document.getElementById(`${id}_file`).click();
            });

            document.getElementById(`${id}_file`).addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const st = document.getElementById(`${id}_status`);
                st.innerText = "আপলোড হচ্ছে...";

                try {
                    let res = await uploadImageToCloudinary(file);
                    
                    if (res && res.url) {
                        inputElem.value = res.url.replace('/upload/', '/upload/q_auto,f_auto/');
                        st.innerText = "✅ আপলোড সম্পন্ন!";
                    } else {
                        st.innerText = "❌ ব্যর্থ!";
                    }
                } catch (err) {
                    st.innerText = "❌ ত্রুটি!";
                }
            });
        }
    });
}

async function loadPageData() {
    try {
        const snap = await getDoc(docRef);
        let data = snap.exists() ? snap.data() : { sliders: [], about: "", feed: [] };
        let isLeader = await checkIsAdultLeader();

        // Render Sliders
        const sliderContainer = document.getElementById("sliderContainer");
        if (data.sliders && data.sliders.length > 0) {
            let html = "";
            data.sliders.forEach((s, idx) => {
                html += `<div class="slider-item">
                            <img src="${s.url}" class="slider-img" onclick="openViewer('${s.url}')" alt="Slider" loading="lazy">
                            <div class="slider-text">
                                <h4 class="slider-title">${s.title || ''}</h4>
                                <p class="slider-desc">${s.desc || ''}</p>
                            </div>
                            ${isLeader ? `<button onclick="deleteSlider(${idx})" style="position: absolute; top: 10px; right: 10px; background: red; color: white; border: none; padding: 4px 8px; border-radius: 5px; cursor: pointer; font-size:11px;">ডিলিট</button>` : ''}
                        </div>`;
            });
            sliderContainer.innerHTML = html;
        } else {
            sliderContainer.innerHTML = `<p style="color: #94a3b8; text-align: center; width: 100%; font-size: 12px;">কোনো স্লাইডার নেই।</p>`;
        }

        // Render About
        let aboutText = data.about || "কোনো তথ্য যুক্ত করা হয়নি।";
        const aboutContainer = document.getElementById("aboutContent");
        
        aboutContainer.style.background = "transparent";
        aboutContainer.style.border = "none";
        aboutContainer.style.padding = "0px";
        aboutContainer.style.margin = "0px";
        aboutContainer.style.boxShadow = "none";
        aboutContainer.style.height = "auto";
        aboutContainer.style.maxHeight = "none";
        aboutContainer.style.overflow = "visible";

        if (aboutText.length > 180) {
            let shortText = aboutText.substring(0, 180) + "...";
            aboutContainer.innerHTML = `
                <div style="line-height: 1.7; word-break: break-word; color: #cbd5e1; font-size: 13.5px;"><span id="aboutTextSpan">${shortText}</span></div>
                <div style="text-align: right; margin-top: 10px;">
                    <span id="toggleAboutBtn" onclick="toggleAboutText()" style="color: #38bdf8; font-size: 12.5px; cursor: pointer; font-weight: bold; text-decoration: underline; display: inline-block; padding: 2px 0;">সবটুকু পড়ুন</span>
                </div>
            `;
            window.fullAboutText = aboutText;
            window.shortAboutText = shortText;
        } else {
            aboutContainer.innerHTML = `<div style="line-height: 1.7; word-break: break-word; color: #cbd5e1; font-size: 13.5px;">${aboutText}</div>`;
        }

        // Render Feed (Max 3 pictures)
        const feedContainer = document.getElementById("galleryFeedContainer");
        if (data.feed && data.feed.length > 0) {
            feedContainer.innerHTML = data.feed.slice(0, 3).map(url => `<img src="${url}" onclick="openViewer('${url}')" alt="Gallery Feed" loading="lazy">`).join('');
        } else {
            feedContainer.innerHTML = `<p style="grid-column: span 3; color: #94a3b8; text-align: center; font-size: 12px;">কোনো ছবি নেই।</p>`;
        }
    } catch (err) {
        console.error("Error loading page data:", err);
    }
}

// "সবটুকু পড়ুন" এবং "কম দেখুন" টগল ফাংশন
window.toggleAboutText = function() {
    const spanElem = document.getElementById("aboutTextSpan");
    const btnElem = document.getElementById("toggleAboutBtn");
    
    if (btnElem.innerText === "সবটুকু পড়ুন") {
        spanElem.innerText = window.fullAboutText;
        btnElem.innerText = "কম দেখুন";
    } else {
        spanElem.innerText = window.shortAboutText;
        btnElem.innerText = "সবটুকু পড়ুন";
    }
}

async function saveSlider() {
    let url = document.getElementById("sliderUrl").value;
    let title = document.getElementById("sliderTitle").value;
    let desc = document.getElementById("sliderDesc").value;
    let slotIndex = parseInt(document.getElementById("sliderUrl").dataset.slotIndex || "0");

    if (!url) return alert("দয়া করে প্রথমে স্লাইডারের ছবি সিলেক্ট করে আপলোড করুন!");

    let snap = await getDoc(docRef);
    let data = snap.exists() ? snap.data() : {};
    if (!data.sliders) data.sliders = [];

    // নির্দিষ্ট স্লটে ওভাররাইট (রিপ্লেস) করার লজিক
    if (slotIndex >= 0 && slotIndex < data.sliders.length) {
        data.sliders[slotIndex] = { url, title, desc };
    } else {
        // যদি স্লটটি আগের অ্যারে সাইজের বাইরে হয়, তবে নতুন স্লট হিসেবে পুশ করবে (সর্বোচ্চ ১০টি)
        if (data.sliders.length >= 10) return alert("সর্বোচ্চ ১০টি স্লাইডার যোগ করা যাবে!");
        data.sliders.push({ url, title, desc });
    }

    await setDoc(docRef, data, { merge: true });
    
    closeModals();
    document.getElementById("sliderUrl").value = ""; 
    document.getElementById("sliderTitle").value = ""; 
    document.getElementById("sliderDesc").value = "";
    document.getElementById("sliderUrl").removeAttribute("data-slot-Index");
    let st = document.getElementById("sliderUploadStatus");
    if(st) st.innerText = "";
    loadPageData();
}

window.deleteSlider = async function(idx) {
    if(!confirm("স্লাইডারটি ডিলিট করতে চান?")) return;
    let snap = await getDoc(docRef);
    let data = snap.data();
    data.sliders.splice(idx, 1);
    await setDoc(docRef, data, { merge: true });
    loadPageData();
}

async function openAboutModal() {
    let snap = await getDoc(docRef);
    document.getElementById("aboutText").value = snap.exists() ? (snap.data().about || "") : "";
    document.getElementById("modalAbout").style.display = "flex";
}

async function saveAbout() {
    let about = document.getElementById("aboutText").value;
    await setDoc(docRef, { about }, { merge: true });
    closeModals();
    loadPageData();
}

async function openFeedModal() {
    let snap = await getDoc(docRef);
    let feed = snap.exists() ? (snap.data().feed || []) : [];
    document.getElementById("feedImg1").value = feed[0] || "";
    document.getElementById("feedImg2").value = feed[1] || "";
    document.getElementById("feedImg3").value = feed[2] || "";
    document.getElementById("modalGalleryFeed").style.display = "flex";
}

async function saveFeed() {
    let urls = [
        document.getElementById("feedImg1").value,
        document.getElementById("feedImg2").value,
        document.getElementById("feedImg3").value
    ].filter(url => url.trim() !== "");
    
    if (urls.length === 0) return alert("অন্তত একটি ছবি আপলোড করুন!");

    await setDoc(docRef, { feed: urls.slice(0, 3) }, { merge: true });
    closeModals();
    loadPageData();
}

// Viewer & Download logic
window.openViewer = (url) => {
    let fullUrl = url.replace('/upload/q_auto,f_auto/', '/upload/q_100/');
    document.getElementById("viewerImg").src = fullUrl;
    document.getElementById("imageViewer").style.display = "flex";
}
window.closeViewer = () => document.getElementById("imageViewer").style.display = "none";

window.downloadImage = () => {
    let url = document.getElementById("viewerImg").src;
    let downloadUrl = url.replace('/upload/q_auto,f_auto/', '/upload/q_100/').replace('/upload/', '/upload/fl_attachment,q_100/');
    
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

// অটোমেটিক স্লাইডার স্ক্রল
document.addEventListener("DOMContentLoaded", () => {
    setInterval(() => {
        const sliderContainer = document.getElementById("sliderContainer");
        if (sliderContainer) {
            const scrollAmount = sliderContainer.clientWidth;
            if (sliderContainer.scrollLeft + sliderContainer.clientWidth >= sliderContainer.scrollWidth) {
                sliderContainer.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                sliderContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        }
    }, 3000);
});
