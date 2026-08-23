import { firedb } from './firebase-config.js';
import { doc, getDoc, collection, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loggedInUser = localStorage.getItem("loggedInUser");
let isAdultLeader = false;
let allScouts = [];
let meetingDates = []; 
let currentLoggedInUserData = null;

async function initAttendancePage() {
    if (!loggedInUser) {
        window.location.href = "login.html";
        return;
    }

    try {
        const userRef = doc(firedb, "users", loggedInUser);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            currentLoggedInUserData = userSnap.data();
            currentLoggedInUserData.uid = userSnap.id;

            const userRole = currentLoggedInUserData.role ? currentLoggedInUserData.role.toLowerCase().trim() : "";
            isAdultLeader = (userRole === "adult leader" || userRole === "adult_leader");

            // সাধারণ স্কাউট অথবা অ্যাডাল্ট লিডার উভয়েই দেখতে পাবে, অন্য কেউ নয়
            const isScoutMember = !userRole.includes("leader") && !userRole.includes("adult");

            if (!isAdultLeader && !isScoutMember) {
                document.getElementById('unauthorizedDiv').style.display = 'block';
                return;
            }

            document.getElementById('mainAppContainer').style.display = 'flex';

            if (isAdultLeader) {
                document.getElementById('toggleSchedulePanelBtn').style.display = 'flex';
                document.getElementById('filterBoxContainer').style.display = 'flex';
            } else {
                // সাধারণ স্কাউটের জন্য ফিল্টার বক্স ও সিডিউল বাটন হাইড থাকবে
                document.getElementById('toggleSchedulePanelBtn').style.display = 'none';
                document.getElementById('filterBoxContainer').style.display = 'none';
            }

            await loadMeetingDatesAndScouts();
        } else {
            window.location.href = "login.html";
        }
    } catch (err) {
        console.error("অথোরাইজেশন চেক করতে সমস্যা:", err);
    }
}

window.toggleMeetingControlPanel = function() {
    if (!isAdultLeader) return;
    const panel = document.getElementById('leaderMeetingControl');
    const arrow = document.getElementById('toggleArrowIcon');
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        arrow.innerText = '▼';
    } else {
        panel.style.display = 'block';
        arrow.innerText = '▲';
    }
}

window.addRecurringMeetingSchedule = async function() {
    if (!isAdultLeader) return;
    const daySelect = document.getElementById('meetingDaySelect').value;
    const startDate = document.getElementById('meetingStartDate').value;
    const endDate = document.getElementById('meetingEndDate').value;

    if (daySelect === "" || !startDate) {
        alert("দয়া করে বার এবং শুরুর তারিখ সিলেক্ট করুন!");
        return;
    }

    try {
        const configRef = doc(firedb, "system_config", "meeting_schedule");
        
        let rawSchedules = [{
            dayOfWeek: daySelect,
            startDate: startDate,
            endDate: endDate ? endDate : null
        }];

        await setDoc(configRef, { schedules: rawSchedules }, { merge: false });

        alert("নতুন সিডিউল সফলভাবে সংরক্ষণ করা হয়েছে এবং পূর্বের সিডিউল রিসেট করা হয়েছে!");
        document.getElementById('leaderMeetingControl').style.display = 'none';
        document.getElementById('toggleArrowIcon').innerText = '▼';

        await loadMeetingDatesAndScouts();

    } catch (err) {
        console.error("সিডিউল সংরক্ষণ করতে সমস্যা:", err);
        alert("সিডিউল সংরক্ষণ ব্যর্থ হয়েছে!");
    }
};

async function loadMeetingDatesAndScouts() {
    try {
        const configRef = doc(firedb, "system_config", "meeting_schedule");
        const configSnap = await getDoc(configRef);
        
        let rawSchedules = [];
        if (configSnap.exists()) {
            rawSchedules = configSnap.data().schedules || [];
            if(configSnap.data().dates && rawSchedules.length === 0) {
                meetingDates = configSnap.data().dates || [];
            }
        }

        if (rawSchedules.length > 0) {
            meetingDates = generateDatesFromSchedules(rawSchedules);
        } else {
            meetingDates = [];
        }

        meetingDates.sort();

        const querySnapshot = await getDocs(collection(firedb, "users"));
        allScouts = [];
        querySnapshot.forEach((docSnap) => {
            let data = docSnap.data();
            data.uid = docSnap.id;
            
            let role = (data.role || "").toLowerCase();
            let status = (data.status || "").toLowerCase();

            if (!role.includes("leader") && !role.includes("adult") && status !== "pending") {
                allScouts.push(data);
            }
        });

        applyFiltersAndRender();
    } catch (err) {
        console.error("ডেটা লোড করতে সমস্যা:", err);
    }
}

function generateDatesFromSchedules(schedules) {
    let datesSet = new Set();
    
    schedules.forEach(sch => {
        let dayOfWeek = parseInt(sch.dayOfWeek); 
        let curr = new Date(sch.startDate);
        
        if (isNaN(curr.getTime())) return;

        let end;
        if (sch.endDate && sch.endDate.trim() !== "") {
            end = new Date(sch.endDate);
        } else {
            end = new Date();
            end.setFullYear(end.getFullYear() + 2); 
        }
        if (isNaN(end.getTime())) end = new Date();

        let currentDay = curr.getDay();
        let distance = (dayOfWeek + 7 - currentDay) % 7;
        curr.setDate(curr.getDate() + distance);

        while (curr <= end) {
            let dateString = curr.toISOString().split('T')[0];
            if (dateString >= sch.startDate && (!sch.endDate || dateString <= sch.endDate)) {
                datesSet.add(dateString);
            }
            curr.setDate(curr.getDate() + 7);
        }
    });

    return Array.from(datesSet).sort();
}

window.updateAttendanceStatus = async function(uid, dateStr, checkboxEl) {
    if (!isAdultLeader) {
        alert("আপনার উপস্থিতি পরিবর্তন করার অনুমতি নেই!");
        checkboxEl.checked = !checkboxEl.checked;
        return;
    }

    const isChecked = checkboxEl.checked;

    if (!isChecked) {
        alert("একবার উপস্থিতি নিশ্চিত (Present) করা হলে তা পরিবর্তন বা ডিলিট করা যাবে না!");
        checkboxEl.checked = true;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr !== todayStr) {
        alert("আপনি শুধুমাত্র আজকের নির্ধারিত মিটিংয়ের দিনেই উপস্থিতি দিতে পারবেন!");
        checkboxEl.checked = false;
        return;
    }

    try {
        const userRef = doc(firedb, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            let userData = userSnap.data();
            let attendanceRecords = userData.attendance || {}; 
            
            attendanceRecords[dateStr] = true;

            await setDoc(userRef, { attendance: attendanceRecords }, { merge: true });
            
            const scoutObj = allScouts.find(s => s.uid === uid);
            if (scoutObj) {
                scoutObj.attendance = attendanceRecords;
            }
            applyFiltersAndRender();
        }
    } catch (err) {
        console.error("উপস্থিতি আপডেট করতে সমস্যা:", err);
        alert("উপস্থিতি আপডেট ব্যর্থ হয়েছে!");
        checkboxEl.checked = false;
    }
};

function applyFiltersAndRender() {
    let filtered = [];

    if (isAdultLeader) {
        const searchNameVal = document.getElementById('searchName').value.toLowerCase();
        const filterClassVal = document.getElementById('filterClass').value.toLowerCase();
        const filterStatusVal = document.getElementById('filterStatus').value.toLowerCase(); 

        filtered = allScouts.filter(scout => {
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
    } else {
        // সাধারণ স্কাউট সদস্য হলে শুধু নিজের ডেটা ফিল্টার হবে এবং কোনো সার্চ বা ফিল্টার অপশন থাকবে না
        if (currentLoggedInUserData) {
            filtered = [currentLoggedInUserData];
        }
    }

    renderAttendanceList(filtered);
}

function renderAttendanceList(scouts) {
    const contentDiv = document.getElementById('attendanceListContent');
    contentDiv.innerHTML = "";

    if (scouts.length === 0) {
        contentDiv.innerHTML = "<p style='color:#94a3b8; text-align:center; padding: 20px;'>কোনো স্কাউট সদস্য পাওয়া যায়নি।</p>";
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDateObj = new Date(todayStr);
    const currentYear = todayDateObj.getFullYear();
    const currentMonth = todayDateObj.getMonth();

    let activeWindowDates = meetingDates.filter(dateStr => {
        let dObj = new Date(dateStr);
        return dObj >= new Date(currentYear, currentMonth, 1);
    });

    if (activeWindowDates.length === 0 && meetingDates.length > 0) {
        activeWindowDates = meetingDates.slice(-8);
    } else {
        activeWindowDates = activeWindowDates.slice(0, 8);
    }

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
        
        let attendanceData = scout.attendance || {};

        let weeksHTML = "";
        if (activeWindowDates.length === 0) {
            weeksHTML = `<div style="font-size:12px; color:#f43f5e; font-weight: 500; padding: 4px 0;">⚠️ এখনো উপস্থিতি শুরু করা হয়নি</div>`;
        } else {
            weeksHTML = `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px;">`;
            
            activeWindowDates.forEach(dateStr => {
                let isPresent = attendanceData[dateStr] === true;
                let isToday = (dateStr === todayStr);
                
                // সাধারণ স্কাউট হলে চেকবক্স অলরেডি disabled থাকবে যাতে ক্লিক বা এডিট করতে না পারে
                let disableAttr = (!isAdultLeader || (!isToday && !isPresent)) ? 'disabled' : '';

                weeksHTML += `
                    <div class="week-box" style="background: #0f172a; border: ${isToday ? '1px solid #22c55e' : '1px solid #334155'}; border-radius: 6px; padding: 6px; text-align: center;">
                        <div ${isAdultLeader ? `onclick="openDateWiseAttendanceModal('${dateStr}')"` : ''} style="font-size: 10px; color: ${isToday ? '#22c55e' : '#38bdf8'}; margin-bottom: 4px; font-weight: bold; ${isAdultLeader ? 'cursor: pointer; text-decoration: underline;' : ''}" title="${isAdultLeader ? 'এই তারিখের উপস্থিতি তালিকা দেখুন' : ''}">${dateStr}</div>
                        <input type="checkbox" class="attendance-checkbox" ${isPresent ? 'checked disabled' : disableAttr} 
                            onchange="updateAttendanceStatus('${scout.uid}', '${dateStr}', this)">
                    </div>
                `;
            });

            weeksHTML += `</div>`;
        }

        let row = document.createElement('div');
        row.className = 'scout-row';

        row.innerHTML = `
            <div class="scout-top-info">
                <div class="scout-info">
                    <span style="color:#94a3b8; font-size:11px; font-weight:bold;">${index + 1}.</span>
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

window.openDateWiseAttendanceModal = function(dateStr) {
    if (!isAdultLeader) return;
    let modal = document.getElementById('dateWiseModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dateWiseModal';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999;";
        modal.innerHTML = `
            <div style="background:#1e293b; width:90%; max-width:500px; max-height:80vh; border-radius:12px; padding:16px; display:flex; flex-direction:column; color:#f8fafc; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:12px;">
                    <h3 id="modalDateTitle" style="margin:0; font-size:16px; color:#38bdf8;">তারিখের উপস্থিতি তালিকা</h3>
                    <button onclick="document.getElementById('dateWiseModal').style.display='none'" style="background:none; border:none; color:#f43f5e; font-size:18px; cursor:pointer; font-weight:bold;">✕</button>
                </div>
                <div id="dateWiseListContent" style="overflow-y:auto; flex-grow:1; display:flex; flex-direction:column; gap:6px;"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('modalDateTitle').innerText = `তারিখ: ${dateStr} - উপস্থিতি তালিকা`;
    const listContainer = document.getElementById('dateWiseListContent');
    listContainer.innerHTML = "";

    if (allScouts.length === 0) {
        listContainer.innerHTML = "<p style='text-align:center; color:#94a3b8;'>কোনো স্কাউট সদস্য পাওয়া যায়নি।</p>";
        modal.style.display = 'flex';
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = (dateStr === todayStr);

    allScouts.forEach((scout, idx) => {
        let name = scout.nameBn || scout.nameEn || scout.fullName || scout.name || "নামহীন";
        let sClass = scout.className || scout.class || "নেই";
        let sRoll = scout.classRoll || "নেই";
        let attendanceData = scout.attendance || {};
        let isPresent = attendanceData[dateStr] === true;

        let itemRow = document.createElement('div');
        itemRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#0f172a; padding:8px 12px; border-radius:6px; font-size:13px; border:1px solid #334155;";
        
        itemRow.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                <span style="color:#94a3b8; font-size:11px;">${idx + 1}.</span>
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; font-weight:500;">${name}</span>
                <span style="color:#94a3b8; font-size:11px;">(ক্লাস: ${sClass} | রোল: ${sRoll})</span>
            </div>
            <input type="checkbox" ${isPresent ? 'checked disabled' : ''} 
                ${!isToday && !isPresent ? 'disabled' : ''} 
                style="width:18px; height:18px; cursor:pointer;"
                onchange="updateAttendanceStatus('${scout.uid}', '${dateStr}', this)">
        `;
        listContainer.appendChild(itemRow);
    });

    modal.style.display = 'flex';
};

window.openScoutDetailModalFromData = function(uid) {
    // সাধারণ স্কাউট সদস্য হলে শুধু নিজের uid এলাউ করবে, লিডার হলে সবারটা দেখতে পারবে
    if (!isAdultLeader && currentLoggedInUserData.uid !== uid) {
        return;
    }
    const scout = allScouts.find(s => s.uid === uid) || (currentLoggedInUserData.uid === uid ? currentLoggedInUserData : null);
    if(scout) openScoutDetailModal(scout);
}

window.openScoutDetailModal = function(scout) {
    const modal = document.getElementById('scoutDetailModal');
    if (!modal) return;

    let displayName = scout.nameBn || scout.nameEn || scout.fullName || scout.name || "নামহীন সদস্য";
    
    let nameEl = document.getElementById('modalScoutName');
    if (nameEl) {
        nameEl.innerText = displayName;
    } else {
        let titleHeader = modal.querySelector('h3');
        if (titleHeader) titleHeader.innerText = displayName;
    }

    const statsEl = document.getElementById('modalScoutStats');
    if (!statsEl) return;

    const existingMonthEl = document.getElementById('modalFilterMonth');
    const existingYearEl = document.getElementById('modalFilterYear');
    const selectedMonth = existingMonthEl ? existingMonthEl.value : "";
    const selectedYear = existingYearEl ? existingYearEl.value : "";

    let attendanceData = scout.attendance || {};
    
    let allAttendanceDates = Object.keys(attendanceData).filter(d => attendanceData[d] === true).sort();
    
    let firstJoinDate = "যোগদান করেননি";
    if (allAttendanceDates.length > 0) {
        firstJoinDate = allAttendanceDates[0];
    }

    let todayStr = new Date().toISOString().split('T')[0];
    let validMeetingDates = meetingDates.length > 0 ? meetingDates.filter(dateStr => dateStr <= todayStr) : allAttendanceDates;

    let totalWeeksAll = validMeetingDates.filter(dateStr => {
        if (firstJoinDate !== "যোগদান করেননি" && dateStr < firstJoinDate) return false;
        return true;
    }).length;

    let presentWeeksAllList = [];
    let absentWeeksAllList = [];

    validMeetingDates.forEach(dateStr => {
        if (firstJoinDate !== "যোগদান করেননি" && dateStr < firstJoinDate) return;
        if (attendanceData[dateStr] === true) {
            presentWeeksAllList.push(dateStr);
        } else {
            absentWeeksAllList.push(dateStr);
        }
    });

    let filteredMeetings = validMeetingDates.filter(dateStr => {
        if (firstJoinDate !== "যোগদান করেননি" && dateStr < firstJoinDate) return false;

        let dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return true;

        let m = dateObj.getMonth().toString();
        let y = dateObj.getFullYear().toString();

        if (selectedMonth !== "" && m !== selectedMonth) return false;
        if (selectedYear !== "" && y !== selectedYear) return false;

        return true;
    });

    let presentWeeksFiltered = [];
    let absentWeeksFiltered = [];

    filteredMeetings.forEach(dateStr => {
        if (attendanceData[dateStr] === true) {
            presentWeeksFiltered.push(dateStr);
        } else {
            absentWeeksFiltered.push(dateStr);
        }
    });

    let filterContextText = "সর্বমোট (সকল মাস ও বছর)";
    if (selectedMonth !== "" && selectedYear !== "") {
        let monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
        filterContextText = `${monthNames[parseInt(selectedMonth)]} ${selectedYear}`;
    } else if (selectedMonth !== "") {
        let monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
        filterContextText = `${monthNames[parseInt(selectedMonth)]} মাস`;
    } else if (selectedYear !== "") {
        filterContextText = `বছর: ${selectedYear}`;
    }

    statsEl.innerHTML = `
        <div style="margin-bottom: 8px;"><b>প্রথম উপস্থিতি (Join Date):</b> <span style="color: #38bdf8;">${firstJoinDate}</span></div>
        <hr style="border-color: #334155; margin: 8px 0;">
        
        <p><b>সিডিউল অনুযায়ী মোট সপ্তাহ:</b> ${totalWeeksAll}টি</p>
        <p style="color: #22c55e; cursor: pointer; text-decoration: underline;" onclick="toggleList('presentListContainer')"><b>মোট উপস্থিত সপ্তাহ (Present):</b> ${presentWeeksAllList.length}টি 🔽</p>
        <div id="presentListContainer" style="display:none; background:#0f172a; padding:6px; border-radius:6px; margin-bottom:6px; font-size:11px; color:#22c55e;">
            ${presentWeeksAllList.length > 0 ? presentWeeksAllList.join(', ') : 'কোনো ডেটা নেই'}
        </div>
        
        <p style="color: #f43f5e; cursor: pointer; text-decoration: underline;" onclick="toggleList('absentListContainer')"><b>মোট অনুপস্থিত সপ্তাহ (Absent):</b> ${absentWeeksAllList.length}টি 🔽</p>
        <div id="absentListContainer" style="display:none; background:#0f172a; padding:6px; border-radius:6px; margin-bottom:6px; font-size:11px; color:#f43f5e;">
            ${absentWeeksAllList.length > 0 ? absentWeeksAllList.join(', ') : 'কোনো অনুপস্থিতি নেই'}
        </div>

        <hr style="border-color: #334155; margin: 10px 0;">

        <!-- ফিল্টার ড্রপডাউন -->
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <select id="modalFilterMonth" onchange="filterModalData()" style="flex: 1; background: #0f172a; color: #f8fafc; border: 1px solid #334155; padding: 6px; border-radius: 6px; font-size: 12px;">
                <option value="">সকল মাস</option>
                <option value="0" ${selectedMonth === "0" ? "selected" : ""}>জানুয়ারি</option>
                <option value="1" ${selectedMonth === "1" ? "selected" : ""}>ফেব্রুয়ারি</option>
                <option value="2" ${selectedMonth === "2" ? "selected" : ""}>মার্চ</option>
                <option value="3" ${selectedMonth === "3" ? "selected" : ""}>এপ্রিল</option>
                <option value="4" ${selectedMonth === "4" ? "selected" : ""}>মে</option>
                <option value="5" ${selectedMonth === "5" ? "selected" : ""}>জুন</option>
                <option value="6" ${selectedMonth === "6" ? "selected" : ""}>জুলাই</option>
                <option value="7" ${selectedMonth === "7" ? "selected" : ""}>আগস্ট</option>
                <option value="8" ${selectedMonth === "8" ? "selected" : ""}>সেপ্টেম্বর</option>
                <option value="9" ${selectedMonth === "9" ? "selected" : ""}>অক্টোবর</option>
                <option value="10" ${selectedMonth === "10" ? "selected" : ""}>নভেম্বর</option>
                <option value="11" ${selectedMonth === "11" ? "selected" : ""}>ডিসেম্বর</option>
            </select>
            <select id="modalFilterYear" onchange="filterModalData()" style="flex: 1; background: #0f172a; color: #f8fafc; border: 1px solid #334155; padding: 6px; border-radius: 6px; font-size: 12px;">
                <option value="">সকল বছর</option>
                <option value="2024" ${selectedYear === "2024" ? "selected" : ""}>2024</option>
                <option value="2025" ${selectedYear === "2025" ? "selected" : ""}>2025</option>
                <option value="2026" ${selectedYear === "2026" ? "selected" : ""}>2026</option>
                <option value="2027" ${selectedYear === "2027" ? "selected" : ""}>2027</option>
            </select>
        </div>

        <!-- ফিল্টারকৃত সময়ের বক্স -->
        <div style="background: #0f172a; border: 1px solid #334155; padding: 8px 10px; border-radius: 6px;">
            <div style="font-size: 11px; color: #38bdf8; margin-bottom: 4px; font-weight: bold;">🎯 ফিল্টারকৃত সময়: ${filterContextText}</div>
            
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span style="color: #22c55e; cursor: pointer; text-decoration: underline;" onclick="toggleList('presentFilteredContainer')">উপস্থিত (Present): <b>${presentWeeksFiltered.length}</b> 🔽</span>
                <span style="color: #f43f5e; cursor: pointer; text-decoration: underline;" onclick="toggleList('absentFilteredContainer')">অনুপস্থিত (Absent): <b>${absentWeeksFiltered.length}</b> 🔽</span>
            </div>

            <div id="presentFilteredContainer" style="display:none; background:#1e293b; padding:6px; border-radius:6px; margin-bottom:4px; font-size:11px; color:#22c55e;">
                <b>উপস্থিত তারিখসমূহ:</b> ${presentWeeksFiltered.length > 0 ? presentWeeksFiltered.join(', ') : 'কোনো ডেটা নেই'}
            </div>

            <div id="absentFilteredContainer" style="display:none; background:#1e293b; padding:6px; border-radius:6px; margin-bottom:4px; font-size:11px; color:#f43f5e;">
                <b>অনুপস্থিত তারিখসমূহ:</b> ${absentWeeksFiltered.length > 0 ? absentWeeksFiltered.join(', ') : 'কোনো অনুপস্থিতি নেই'}
            </div>
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

window.filterModalData = function() {
    const modal = document.getElementById('scoutDetailModal');
    const uid = modal.dataset.currentScoutUid;
    if (uid) {
        const scout = allScouts.find(s => s.uid === uid) || (currentLoggedInUserData.uid === uid ? currentLoggedInUserData : null);
        if (scout) openScoutDetailModal(scout);
    }
}

window.closeDetailModal = function() {
    document.getElementById('scoutDetailModal').style.display = 'none';
};

// ইভেন্ট লিসেনারগুলো শুধু তখনই নিরাপদে যুক্ত হবে যদি এলিমেন্টগুলো উপস্থিত থাকে
const searchNameEl = document.getElementById('searchName');
if (searchNameEl) searchNameEl.addEventListener('input', applyFiltersAndRender);

const filterClassEl = document.getElementById('filterClass');
if (filterClassEl) filterClassEl.addEventListener('change', applyFiltersAndRender);

const filterStatusEl = document.getElementById('filterStatus');
if (filterStatusEl) filterStatusEl.addEventListener('change', applyFiltersAndRender);

initAttendancePage();
