import { firedb } from './firebase-config.js';
import { doc, getDoc, collection, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loggedInUser = localStorage.getItem("loggedInUser");
let isAdultLeader = false;
let allScouts = [];

async function initSubsPage() {
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
            isAdultLeader = (userRole.includes("adult") || userRole.includes("leader"));

            document.getElementById('mainAppContainer').style.display = 'flex';

            const now = new Date();
            document.getElementById('selectMonth').value = now.getMonth();
            document.getElementById('selectYear').value = now.getFullYear();

            if (!isAdultLeader) {
                // সাধারণ স্কাউট সদস্য হলে শুধু তার নিজের তথ্য দেখাবে, তবে পেমেন্ট হিস্ট্রি বোতামটি দৃশ্যমান থাকবে
                document.getElementById('pageTitleHeading').innerText = "আপনার সাপ্তাহিক চাঁদার বিবরণ";
                // document.getElementById('historyBtnLink').style.display = 'none'; // এটি বাদ দেওয়া হয়েছে যাতে সাধারণ ব্যবহারকারীও হিস্ট্রি দেখতে পায়
                document.getElementById('leaderFilterBox').style.display = 'none';
                document.getElementById('monthYearRowBox').style.display = 'none';
                
                userData.uid = loggedInUser;
                allScouts = [userData];
                applyFiltersAndRender();
                return;
            }

            await loadScoutsData();
        } else {
            window.location.href = "login.html";
        }
    } catch (err) {
        console.error("অথোরাইজেশন চেক করতে সমস্যা:", err);
    }
}

async function loadScoutsData() {
    try {
        const querySnapshot = await getDocs(collection(firedb, "users"));
        allScouts = [];
        querySnapshot.forEach((docSnap) => {
            let dataObj = docSnap.data();
            dataObj.uid = docSnap.id;
            
            let role = (dataObj.role || "").toLowerCase();
            let status = (dataObj.status || "").toLowerCase();

            if (!role.includes("leader") && !role.includes("adult") && status !== "pending") {
                allScouts.push(dataObj);
            }
        });

        applyFiltersAndRender();
    } catch (err) {
        console.error("ডেটা লোড করতে সমস্যা:", err);
    }
}

window.onMonthOrYearChange = function() {
    applyFiltersAndRender();
}

window.updateSubsStatus = async function(uid, weekKey, checkboxEl) {
    if (!isAdultLeader) {
        alert("আপনার চাঁদার স্ট্যাটাস পরিবর্তনের অনুমতি নেই!");
        if(checkboxEl) checkboxEl.checked = !checkboxEl.checked;
        return;
    }

    const isChecked = checkboxEl.checked;

    if (!isChecked) {
        alert("একবার চাঁদা পরিশোধ নিশ্চিত করা হলে তা পরিবর্তন বা আনডো (Undo) করা যাবে না!");
        checkboxEl.checked = true;
        return;
    }

    try {
        const userRef = doc(firedb, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            let userData = userSnap.data();
            let subsRecords = userData.weeklySubs || {}; 
            let paymentLogs = userData.subsPaymentLogs || {};

            const scoutObj = allScouts.find(s => s.uid === uid);
            const scoutName = scoutObj ? (scoutObj.nameBn || scoutObj.nameEn || scoutObj.fullName || scoutObj.name || "নামহীন সদস্য") : "সদস্য";

            const nowTime = new Date();
            const todayStr = nowTime.toISOString().split('T')[0];
            const timeStr = nowTime.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            let parts = weekKey.split('-');
            let y = parseInt(parts[0]);
            let mIdx = parseInt(parts[1]) - 1;
            let wNum = parseInt(parts[2].replace('W', ''));
            
            const monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
            let weekLabel = `সপ্তাহ ${wNum} (${monthNames[mIdx]} ${y})`;

            let attendanceData = scoutObj.attendance || {};
            let allAttDates = Object.keys(attendanceData).filter(d => attendanceData[d] === true).sort();
            let firstJoinDate = allAttDates.length > 0 ? allAttDates[0] : "";

            let typeTag = "বর্তমান চাঁদা";
            let currentY = nowTime.getFullYear();
            let currentM = nowTime.getMonth();
            let currentW = Math.min(Math.ceil(nowTime.getDate() / 7), 4);

            if (y > currentY || (y === currentY && mIdx > currentM) || (y === currentY && mIdx === currentM && wNum > currentW)) {
                typeTag = "ভবিষ্যৎ (অগ্রিম) চাঁদা";
            } else if (firstJoinDate && weekKey < `${firstJoinDate.substring(0,7)}-W1`) {
                typeTag = "বকেয়া চাঁদা";
            }

            subsRecords[weekKey] = true;
            
            if (!paymentLogs[todayStr]) {
                paymentLogs[todayStr] = [];
            }
            
            let existingLogIndex = paymentLogs[todayStr].findIndex(log => typeof log === 'object' && log.weekKey === weekKey);
            let logDetail = {
                weekKey: weekKey,
                weekLabel: weekLabel,
                type: typeTag,
                timestamp: timeStr,
                scoutName: scoutName
            };

            if (existingLogIndex > -1) {
                paymentLogs[todayStr][existingLogIndex] = logDetail;
            } else {
                paymentLogs[todayStr].push(logDetail);
            }

            await setDoc(userRef, { 
                weeklySubs: subsRecords,
                subsPaymentLogs: paymentLogs 
            }, { merge: true });
            
            if (scoutObj) {
                scoutObj.weeklySubs = subsRecords;
                scoutObj.subsPaymentLogs = paymentLogs;
            }
            applyFiltersAndRender();
            
            const modal = document.getElementById('scoutDetailModal');
            if (modal && modal.style.display === 'flex' && modal.dataset.currentScoutUid === uid) {
                openScoutDetailModal(scoutObj);
            }
        }
    } catch (err) {
        console.error("চাঁদার হিসাব আপডেট করতে সমস্যা:", err);
        alert("আপডেট ব্যর্থ হয়েছে!");
        checkboxEl.checked = false;
    }
};

function applyFiltersAndRender() {
    if (!isAdultLeader) {
        renderSubsList(allScouts);
        return;
    }

    const searchNameVal = document.getElementById('searchName').value.toLowerCase();
    const filterClassVal = document.getElementById('filterClass').value.toLowerCase();
    const filterStatusVal = document.getElementById('filterStatus').value.toLowerCase(); 

    const filtered = allScouts.filter(scout => {
        const name = (scout.nameBn || scout.nameEn || scout.fullName || scout.name || "").toLowerCase();
        const sClass = (scout.className || scout.class || "").toLowerCase();
        const status = (scout.status || "active").toLowerCase();

        let matchesStatus = true;
        if (filterStatusVal === "active" || filterStatusVal === "অ্যাক্টিভ") {
            matchesStatus = (status === "active" || status === "true" || status === "অ্যাক্টিভ");
        } else if (filterStatusVal === "inactive" || filterStatusVal === "ইনঅ্যাক্টিভ") {
            matchesStatus = (status === "inactive" || status === "false" || status === "ইনঅ্যাক্টিভ");
        }

        let matchesClass = filterClassVal === "" || sClass.includes(filterClassVal);
        let matchesName = name.includes(searchNameVal);

        return matchesName && matchesClass && matchesStatus;
    });

    renderSubsList(filtered);
}

function renderSubsList(scouts) {
    const contentDiv = document.getElementById('subsListContent');
    contentDiv.innerHTML = "";

    if (scouts.length === 0) {
        contentDiv.innerHTML = "<p style='color:#94a3b8; text-align:center; padding: 20px;'>কোনো স্কাউট সদস্য পাওয়া যায়নি।</p>";
        return;
    }

    const selectedMonth = parseInt(document.getElementById('selectMonth').value);
    const selectedYear = parseInt(document.getElementById('selectYear').value);

    const monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const currentMonthName = monthNames[selectedMonth];

    scouts.forEach((scout, index) => {
        let avatarHTML = scout.profileImage 
            ? `<img src="${scout.profileImage}" class="scout-avatar" alt="">` 
            : `<div class="scout-avatar">👤</div>`;

        let displayName = scout.nameBn || scout.nameEn || scout.fullName || scout.name || "নামহীন সদস্য";
        let rawClass = scout.className || scout.class || "উল্লেখ নেই";
        let rawRoll = scout.classRoll || "নেই";
        
        let groupType = scout.secGroupType ? scout.secGroupType.trim() : "";
        let groupVal = scout.secGroupVal ? scout.secGroupVal.trim() : "";
        
        let line1Str = `ক্লাস: ${rawClass} | রোল: ${rawRoll}`;
        let line2Str = "";
        if (groupType && groupVal) {
            line2Str = `${groupType}: ${groupVal}`;
        } else if (groupVal) {
            line2Str = `গ্রুপ/সেকশন: ${groupVal}`;
        }
        
        let subsData = scout.weeklySubs || {};

        let weeksHTML = `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px;">`;
        
        for (let w = 1; w <= 4; w++) {
            let weekKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-W${w}`;
            let isPaid = subsData[weekKey] === true;
            
            // সাধারণ স্কাউট হলে চেক বক্স ডিজেবল থাকবে যাতে সে পরিবর্তন করতে না পারে
            let disabledAttr = (!isAdultLeader || isPaid) ? 'disabled' : '';
            
            weeksHTML += `
                <div class="week-box">
                    <div style="font-size: 10px; color: #38bdf8; margin-bottom: 4px; font-weight: bold;">সপ্তাহ ${w} (${currentMonthName})</div>
                    <input type="checkbox" class="attendance-checkbox" ${isPaid ? 'checked' : ''} ${disabledAttr} 
                        onchange="updateSubsStatus('${scout.uid}', '${weekKey}', this)">
                </div>
            `;
        }
        weeksHTML += `</div>`;

        let row = document.createElement('div');
        row.className = 'scout-row';

        row.innerHTML = `
            <div class="scout-top-info">
                <div class="scout-info">
                    <span style="color:#94a3b8; font-size:11px; font-weight:bold;">${isAdultLeader ? (index + 1) : '•'}</span>
                    ${avatarHTML}
                    <div class="scout-details">
                        <h4>${displayName}</h4>
                        <p style="color: #94a3b8; font-weight: 500;">${line1Str}</p>
                        ${line2Str ? `<p style="color: #22c55e; font-weight: 500; margin-top: 2px;">${line2Str}</p>` : ''}
                    </div>
                </div>
                <button type="button" class="details-btn" onclick="openScoutDetailModalFromData('${scout.uid}')">ডিটেইলস</button>
            </div>
            ${weeksHTML}
        `;
        contentDiv.appendChild(row);
    });
}

window.openScoutDetailModalFromData = function(uid) {
    const scout = allScouts.find(s => s.uid === uid);
    if(scout) openScoutDetailModal(scout);
}

window.openScoutDetailModal = function(scout) {
    const modal = document.getElementById('scoutDetailModal');
    if (!modal) return;

    let displayName = scout.nameBn || scout.nameEn || scout.fullName || scout.name || "নামহীন সদস্য";
    document.getElementById('modalScoutName').innerText = displayName;

    const statsEl = document.getElementById('modalScoutStats');
    if (!statsEl) return;

    let attendanceData = scout.attendance || {};
    let allAttendanceDates = Object.keys(attendanceData).filter(d => attendanceData[d] === true).sort();
    
    let firstJoinDate = "যোগদান করেননি";
    if (allAttendanceDates.length > 0) {
        firstJoinDate = allAttendanceDates[0];
    }

    let subsData = scout.weeklySubs || {};
    let monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

    let joinYear = 2026;
    let joinMonth = 0;
    let joinWeekNum = 1;

    if (firstJoinDate !== "যোগদান করেননি") {
        let parts = firstJoinDate.split('-');
        joinYear = parseInt(parts[0]);
        joinMonth = parseInt(parts[1]) - 1;
        let day = parseInt(parts[2]);
        joinWeekNum = Math.min(Math.ceil(day / 7), 4);
    }

    let now = new Date();
    let currentY = now.getFullYear();
    let currentM = now.getMonth();
    let currentW = Math.min(Math.ceil(now.getDate() / 7), 4);

    let totalExpectedWeeks = 0;
    let unpaidWeeksList = [];
    let paidWeeksList = [];

    if (firstJoinDate !== "যোগদান করেননি") {
        for (let y = joinYear; y <= currentY; y++) {
            let mStart = (y === joinYear) ? joinMonth : 0;
            let mEnd = (y === currentY) ? currentM : 11;

            for (let m = mStart; m <= mEnd; m++) {
                let wStart = (y === joinYear && m === joinMonth) ? joinWeekNum : 1;
                let wEnd = (y === currentY && m === currentM) ? currentW : 4;

                for (let w = wStart; w <= wEnd; w++) {
                    totalExpectedWeeks++;
                    let wkKey = `${y}-${String(m + 1).padStart(2, '0')}-W${w}`;
                    let label = `${monthNames[m]} ${y} - সপ্তাহ ${w}`;

                    if (subsData[wkKey] !== true) {
                        unpaidWeeksList.push({ key: wkKey, label: label });
                    }
                }
            }
        }
    }

    Object.keys(subsData).forEach(wkKey => {
        if (subsData[wkKey] === true) {
            let parts = wkKey.split('-');
            if (parts.length === 3) {
                let y = parts[0];
                let mIdx = parseInt(parts[1]) - 1;
                let w = parts[2].replace('W', '');
                let label = `${monthNames[mIdx]} ${y} - সপ্তাহ ${w}`;
                paidWeeksList.push({ key: wkKey, label: label });
            }
        }
    });

    let advanceOptionsList = [];
    let advTargetDate = new Date(currentY, currentM, 1);
    
    for (let i = 0; i < 2; i++) {
        let fYear = advTargetDate.getFullYear();
        let fMonth = advTargetDate.getMonth();

        for (let w = 1; w <= 4; w++) {
            let wkKey = `${fYear}-${String(fMonth + 1).padStart(2, '0')}-W${w}`;
            let label = `${monthNames[fMonth]} ${fYear} - সপ্তাহ ${w}`;
            let isPaid = subsData[wkKey] === true;
            advanceOptionsList.push({ key: wkKey, label: label, isPaid: isPaid });
        }
        advTargetDate.setMonth(advTargetDate.getMonth() + 1);
    }

    let paidListHtml = "";
    if (paidWeeksList.length === 0) {
        paidListHtml = "<p style='color: #94a3b8; font-size:11px;'>কোনো তথ্য নেই।</p>";
    } else {
        paidListHtml = `<ul style="margin: 0; padding-left: 15px; color: #22c55e; font-size:11px;">`;
        paidWeeksList.forEach(item => {
            paidListHtml += `<li style="margin-bottom: 2px;">${item.label} (পরিশোধিত)</li>`;
        });
        paidListHtml += `</ul>`;
    }

    let unpaidListHtml = "";
    if (unpaidWeeksList.length === 0) {
        unpaidListHtml = "<p style='color: #22c55e; font-size:11px;'>কোনো বকেয়া নেই!</p>";
    } else {
        unpaidListHtml = `<div style="display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto;">`;
        unpaidWeeksList.forEach(item => {
            let actionBtn = isAdultLeader 
                ? `<button type="button" style="background: #22c55e; color: #fff; border: none; padding: 2px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: bold;" onclick="updateSubsStatus('${scout.uid}', '${item.key}', {checked: true})">পরিশোধ করুন</button>`
                : `<span style="color: #f43f5e; font-size:10px;">বকেয়া</span>`;

            unpaidListHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                    <span style="color: #f43f5e;">${item.label}</span>
                    ${actionBtn}
                </div>
            `;
        });
        unpaidListHtml += `</div>`;
    }

    let advanceListHtml = `<div style="display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto;">`;
    advanceOptionsList.forEach(item => {
        let disabledAttr = !isAdultLeader ? 'disabled' : '';
        advanceListHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                <span style="color: #38bdf8;">${item.label}</span>
                <input type="checkbox" ${item.isPaid ? 'checked disabled' : disabledAttr} onchange="updateSubsStatus('${scout.uid}', '${item.key}', this)" style="cursor: pointer; width: 16px; height: 16px;">
            </div>
        `;
    });
    advanceListHtml += `</div>`;

    statsEl.innerHTML = `
        <div style="margin-bottom: 4px;"><b>প্রথম উপস্থিতি (Join Date):</b> <span style="color: #38bdf8;">${firstJoinDate}</span></div>
        <div style="margin-bottom: 6px;"><b>মোট সপ্তাহ:</b> <span style="color: #facc15; font-weight: bold;">${totalExpectedWeeks} টি</span></div>
        <hr style="border-color: #334155; margin: 6px 0;">
        
        <div style="margin-bottom: 4px;"><b>মোট পরিশোধিত সপ্তাহ:</b> <span style="color: #22c55e; font-weight: bold;">${paidWeeksList.length} টি</span></div>
        <div style="margin-bottom: 8px; cursor: pointer; color: #38bdf8; text-decoration: underline;" onclick="toggleList('modalPaidList')">পরিশোধিত তালিকা দেখুন 🔽</div>
        <div id="modalPaidList" style="display:none; background:#0f172a; padding:6px; border-radius:6px; margin-bottom:8px;">
            ${paidListHtml}
        </div>

        <hr style="border-color: #334155; margin: 6px 0;">
        <div style="margin-bottom: 4px;"><b>বকেয়া সপ্তাহ (করেনি):</b> <span style="color: #f43f5e; font-weight: bold;">${unpaidWeeksList.length} টি</span></div>
        <div style="margin-bottom: 8px; cursor: pointer; color: #f43f5e; text-decoration: underline;" onclick="toggleList('modalUnpaidList')">বকেয়া তালিকা ও পরিশোধ অপশন দেখুন 🔽</div>
        <div id="modalUnpaidList" style="display:none; background:#0f172a; padding:6px; border-radius:6px; margin-bottom:8px;">
            ${unpaidListHtml}
        </div>

        <hr style="border-color: #334155; margin: 6px 0;">
        <div style="margin-bottom: 4px;"><b>অগ্রিম পরিশোধ (বর্তমান ও সামনের মাস - ৮ সপ্তাহ):</b></div>
        <div style="margin-bottom: 8px; cursor: pointer; color: #38bdf8; text-decoration: underline;" onclick="toggleList('modalAdvanceList')">অগ্রিম পরিশোধ অপশন দেখুন 🔽</div>
        <div id="modalAdvanceList" style="display:none; background:#0f172a; padding:6px; border-radius:6px; margin-bottom:8px;">
            ${advanceListHtml}
        </div>
    `;

    modal.dataset.currentScoutUid = scout.uid;
    modal.style.display = 'flex';
};

window.toggleList = function(elementId) {
    const el = document.getElementById(elementId);
    if (el.style.display === 'none') {
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

window.closeDetailModal = function() {
    document.getElementById('scoutDetailModal').style.display = 'none';
};

const searchInputEl = document.getElementById('searchName');
if(searchInputEl) searchInputEl.addEventListener('input', applyFiltersAndRender);

const filterClassEl = document.getElementById('filterClass');
if(filterClassEl) filterClassEl.addEventListener('change', applyFiltersAndRender);

const filterStatusEl = document.getElementById('filterStatus');
if(filterStatusEl) filterStatusEl.addEventListener('change', applyFiltersAndRender);

initSubsPage();
