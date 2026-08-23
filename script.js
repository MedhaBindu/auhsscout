import { firedb } from './firebase-config.js';
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loggedInUser = localStorage.getItem("loggedInUser");
const isProfilePage = window.location.pathname.includes("profile.html");

document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector('.app-container') || document.body;
    
    // ১. হেডার তৈরি (যদি না থাকে)
    let appHeader = document.querySelector('.app-header');
    if (!appHeader) {
        appHeader = document.createElement('div');
        appHeader.className = 'app-header';
        
        const menuBtn = document.createElement('div');
        menuBtn.id = 'menuBtn';
        menuBtn.className = 'menu-btn';
        menuBtn.innerText = '☰';
        appHeader.appendChild(menuBtn);

        const titleEl = document.createElement('h1');
        titleEl.className = 'school-title';
        titleEl.innerText = 'আফাজ উদ্দিন উচ্চ বিদ্যালয় স্কাউট গ্রুপ';
        appHeader.appendChild(titleEl);

        if (!isProfilePage) {
            const profileBtn = document.createElement('div');
            profileBtn.id = 'profileBtn';
            profileBtn.className = 'profile-btn';
            profileBtn.innerText = '👤';
            appHeader.appendChild(profileBtn);
        } else {
            const spacer = document.createElement('div');
            appHeader.appendChild(spacer);
        }

        container.insertBefore(appHeader, container.firstChild);
    }

    // ২. ড্রপডাউন মেনু তৈরি
    let dropdownMenu = document.getElementById('dropdownMenu');
    if (!dropdownMenu) {
        dropdownMenu = document.createElement('div');
        dropdownMenu.id = 'dropdownMenu';
        dropdownMenu.className = 'dropdown-menu';
        dropdownMenu.innerHTML = `
            <a href="index.html" class="menu-item">ড্যাশবোর্ড</a>
            <a href="profile.html" class="menu-item" id="menuProfile" style="display: none;">প্রোফাইল</a>
            <a href="scout-list.html" class="menu-item" id="menuScoutList" style="display: none;">স্কাউটদের তালিকা</a>
            <a href="member-requests.html" class="menu-item" id="menuRequests" style="display: none;">সদস্য রিকোয়েস্ট</a>
            <a href="inactive.html" class="menu-item" id="menuInactive" style="display: none;">ইনঅ্যাক্টিভ সদস্য</a>
            <a href="attendance.html" class="menu-item" id="menuAttendance" style="display: none;">উপস্থিতি</a>
            <a href="weekly-subs.html" class="menu-item" id="menuWeeklySubs" style="display: none;">সাপ্তাহিক চাঁদা</a>
            <a href="about-us.html" class="menu-item" id="menuAboutUs">আমাদের সম্পর্কে</a>
            <a href="about-scout.html" class="menu-item" id="menuAboutScout">স্কাউট সম্পর্কে</a>
            <a href="login.html" class="menu-item" id="menuLoginReg">লগইন</a>
            <a href="#" class="menu-item logout-item" id="menuLogout" style="display: none;">লগআউট</a>
        `;
        container.appendChild(dropdownMenu);
    }

    const menuBtn = document.getElementById('menuBtn');
    const profileBtn = document.getElementById('profileBtn');
    const menuProfile = document.getElementById('menuProfile');
    const menuScoutList = document.getElementById('menuScoutList');
    const menuRequests = document.getElementById('menuRequests');
    const menuInactive = document.getElementById('menuInactive');
    const menuAttendance = document.getElementById('menuAttendance');
    const menuWeeklySubs = document.getElementById('menuWeeklySubs');
    const menuLoginReg = document.getElementById('menuLoginReg');
    const menuLogout = document.getElementById('menuLogout');

    // হ্যামবার্গার মেনু টগল করা
    if (menuBtn) {
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            if (dropdownMenu) dropdownMenu.classList.toggle('show');
        };
    }

    // মেনুর বাইরে ক্লিক করলে মেনু বন্ধ হয়ে যাওয়া
    window.onclick = () => {
        if (dropdownMenu && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
        }
    };

    // লগআউট হ্যান্ডলার
    if (menuLogout) {
        menuLogout.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem("loggedInUser");
            window.location.href = "index.html";
        };
    }

    // ৩. ফায়ারস্টোর থেকে ডাইনামিক কাউন্ট লোড করার ফাংশন
    async function loadDashboardCounts() {
        const totalCountEl = document.getElementById('totalCount');
        if (!totalCountEl) return; 

        try {
            const querySnapshot = await getDocs(collection(firedb, "users"));
            let total = 0;
            let active = 0;
            let scoutMale = 0;
            let scoutFemale = 0;
            let adultLeader = 0;

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                
                const status = (data.status || "").toLowerCase().trim();
                if (status === "pending") return;

                total++;

                const role = (data.role || "").toLowerCase().trim();
                const gender = (data.gender || "").toLowerCase().trim();
                
                const isActive = (status !== "inactive" && status !== "false") && (data.isActive !== false);

                if (role.includes("leader") || role.includes("adult")) {
                    adultLeader++;
                } else {
                    if (isActive) {
                        active++;
                    }

                    if ((gender === "male" || gender === "boy" || gender === "male/ছেলে") && isActive) {
                        scoutMale++;
                    }

                    if ((gender === "female" || gender === "girl" || gender === "female/মেয়ে") && isActive) {
                        scoutFemale++;
                    }
                }
            });

            document.getElementById('totalCount').innerText = total;
            document.getElementById('activeCount').innerText = active;
            document.getElementById('scoutCount').innerText = scoutMale;
            document.getElementById('girlsScoutCount').innerText = scoutFemale;
            document.getElementById('leaderCount').innerText = adultLeader;

        } catch (err) {
            console.error("ড্যাশবোর্ড ডেটা লোড করতে সমস্যা হয়েছে:", err);
        }
    }

    // ৪. অথেন্টিকেশন ও পারমিশন চেক
    async function initAuthCheck() {
        if (loggedInUser && loggedInUser !== "undefined" && loggedInUser !== "null") {
            if (menuLogout) menuLogout.style.display = 'block';
            if (menuLoginReg) menuLoginReg.style.display = 'none';

            try {
                const userRef = doc(firedb, "users", loggedInUser);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const userData = snap.data();
                    const status = (userData.status || "").toLowerCase().trim();
                    const userRole = userData.role ? userData.role.toLowerCase().trim() : "";
                    const isAdultLeader = (userRole.includes("leader") || userRole.includes("adult"));

                    const welcomeSection = document.querySelector('.welcome-section');

                    // ইনঅ্যাক্টিভ সদস্য চেক (ডেটাবেজের status ফিল্ড অনুযায়ী)
                    if (status === "inactive" && !isAdultLeader) {
                        if (welcomeSection && !document.getElementById('inactiveWarningNotice')) {
                            const noticeP = document.createElement('p');
                            noticeP.id = 'inactiveWarningNotice';
                            noticeP.style.color = '#ef4444'; // লাল রঙ
                            noticeP.style.fontSize = '13px';
                            noticeP.style.marginTop = '8px';
                            noticeP.style.fontWeight = '600';
                            noticeP.innerText = '⚠️ আপনি একজন ইনঅ্যাক্টিভ সদস্য হিসেবে চিহ্নিত হয়েছেন। অতি দ্রুত স্কাউট লিডারের সাথে যোগাযোগ করুন, নয়তো আপনাকে স্কাউট সদস্য থেকে বহিষ্কার করা হবে।';
                            welcomeSection.appendChild(noticeP);
                        }
                    }

                    // চাঁদা বকেয়া আছে কি না চেক (weeklySubs বা due ফিল্ড চেক করার লজিক)
                    let hasUnpaidDue = false;
                    if (userData.weeklySubs) {
                        for (let weekKey in userData.weeklySubs) {
                            if (userData.weeklySubs[weekKey] === false || userData.weeklySubs[weekKey] === "false" || userData.weeklySubs[weekKey] === "due") {
                                hasUnpaidDue = true;
                                break;
                            }
                        }
                    }
                    if (userData.hasDue || userData.dueAmount > 0) {
                        hasUnpaidDue = true;
                    }

                    if (hasUnpaidDue && !isAdultLeader) {
                        if (welcomeSection && !document.getElementById('dueNotice')) {
                            const dueP = document.createElement('p');
                            dueP.id = 'dueNotice';
                            dueP.style.color = '#f59e0b'; // হলুদ/কমলা রঙের সর্তকতা
                            dueP.style.fontSize = '13px';
                            dueP.style.marginTop = '6px';
                            dueP.style.fontWeight = '600';
                            dueP.innerText = '⚠️ আপনার চাঁদা বকেয়া রয়েছে। যত দ্রুত সম্ভব স্কাউট লিডারের সাথে যোগাযোগ করে চাঁদা পরিশোধ করুন।';
                            welcomeSection.appendChild(dueP);
                        }
                    }

                    // পেন্ডিং স্ট্যাটাস চেক
                    if (status === "pending" && !isAdultLeader) {
                        if (welcomeSection && !document.getElementById('pendingNotice')) {
                            const noticeP = document.createElement('p');
                            noticeP.id = 'pendingNotice';
                            noticeP.style.color = '#f59e0b';
                            noticeP.style.fontSize = '13px';
                            noticeP.style.marginTop = '6px';
                            noticeP.style.fontWeight = '600';
                            noticeP.innerText = '(আপনার আবেদন পেন্ডিং রয়েছে, এপ্রুভের জন্য অপেক্ষা করুন বা স্কাউট লিডারের সাথে যোগাযোগ করুন)';
                            welcomeSection.appendChild(noticeP);
                        }
                    }

                    if (status === "pending" && !isAdultLeader) {
                        if (menuProfile) menuProfile.style.display = 'block';
                        if (menuScoutList) menuScoutList.style.display = 'none';
                        if (menuRequests) menuRequests.style.display = 'none';
                        if (menuInactive) menuInactive.style.display = 'none';
                        // পেন্ডিং ব্যবহারকারীদের জন্য উপস্থিতি ও সাপ্তাহিক চাঁদা মেনু হাইড থাকবে
                        if (menuAttendance) menuAttendance.style.display = 'none';
                        if (menuWeeklySubs) menuWeeklySubs.style.display = 'none';
                    } else {
                        if (menuProfile) menuProfile.style.display = 'block';
                        if (menuScoutList) menuScoutList.style.display = 'block';
                        
                        // সাধারণ স্কাউট ও লিডার উভয়ের জন্যই উপস্থিতি ও সাপ্তাহিক চাঁদা মেনু দৃশ্যমান করা হলো
                        if (menuAttendance) menuAttendance.style.display = 'block';
                        if (menuWeeklySubs) menuWeeklySubs.style.display = 'block';

                        if (isAdultLeader) {
                            if (menuRequests) menuRequests.style.display = 'block';
                            if (menuInactive) menuInactive.style.display = 'block';
                        }
                    }

                    if (userData.profileImage && profileBtn && !isProfilePage) {
                        profileBtn.innerHTML = `<img src="${userData.profileImage}" alt="Profile" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                        profileBtn.style.width = "38px";
                        profileBtn.style.height = "38px";
                        profileBtn.style.padding = "0";
                        profileBtn.style.borderRadius = "50%";
                        profileBtn.style.display = "flex";
                        profileBtn.style.alignItems = "center";
                        profileBtn.style.justifyContent = "center";
                        profileBtn.style.overflow = "hidden";
                    } else if (profileBtn && !isProfilePage) {
                        profileBtn.innerHTML = "👤";
                    }
                }
            } catch (err) {
                console.error("ডেটা লোড করতে সমস্যা হয়েছে:", err);
            }

            if (profileBtn && !isProfilePage) {
                profileBtn.onclick = () => {
                    window.location.href = "profile.html";
                };
            }
        } else {
            if (profileBtn && !isProfilePage) {
                profileBtn.innerText = "লগইন";
                profileBtn.style.fontSize = "11px";
                profileBtn.style.fontWeight = "bold";
                profileBtn.style.width = "auto";
                profileBtn.style.height = "38px";
                profileBtn.style.padding = "0 10px";
                profileBtn.style.borderRadius = "8px";
                profileBtn.style.display = "flex";
                profileBtn.style.alignItems = "center";
                profileBtn.style.justifyContent = "center";
                profileBtn.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
                profileBtn.style.color = "#fff";

                profileBtn.onclick = () => {
                    window.location.href = "login.html";
                };
            }

            if (menuProfile) menuProfile.style.display = 'none';
            if (menuScoutList) menuScoutList.style.display = 'none';
            if (menuRequests) menuRequests.style.display = 'none';
            if (menuInactive) menuInactive.style.display = 'none';
            if (menuAttendance) menuAttendance.style.display = 'none';
            if (menuWeeklySubs) menuWeeklySubs.style.display = 'none';
            if (menuLogout) menuLogout.style.display = 'none';
            if (menuLoginReg) {
                menuLoginReg.style.display = 'block';
                menuLoginReg.innerText = "লগইন";
                menuLoginReg.href = "login.html";
            }
        }
    }

    initAuthCheck();
    loadDashboardCounts();
});
