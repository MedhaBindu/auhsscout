import { firedb } from './firebase-config.js';
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loggedInUser = localStorage.getItem("loggedInUser");
let isAdultLeader = false;
let globalMasterRecords = [];

async function initPaymentHistoryPage() {
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
            
            // লিডার না হলে আনঅথরাইজড মেসেজ লুকিয়ে রাখা বা ফিল্টার বক্স অ্যাডজাস্ট করার প্রয়োজন হলে করতে পারেন, 
            // তবে মূল লজিক অনুযায়ী এখন ডেটা লোড করার সময় শুধু নিজের বা সবার ডেটা ফিল্টার করা হবে।
            const unauthorizedDiv = document.getElementById('unauthorizedDiv');
            if (unauthorizedDiv) unauthorizedDiv.style.display = 'none';

            await loadAllPaymentHistories();
        } else {
            window.location.href = "login.html";
        }
    } catch (err) {
        console.error("অথোরাইজেশন চেক করতে সমস্যা:", err);
    }
}

async function loadAllPaymentHistories() {
    const contentDiv = document.getElementById('paymentHistoryContent');
    contentDiv.innerHTML = "<p style='color:#94a3b8; text-align:center; padding: 20px;'>হিস্ট্রি লোড হচ্ছে...</p>";

    try {
        const querySnapshot = await getDocs(collection(firedb, "users"));
        let allScouts = [];
        
        querySnapshot.forEach((docSnap) => {
            let dataObj = docSnap.data();
            dataObj.uid = docSnap.id;
            
            // যদি সাধারণ স্কাউট হয়, তবে শুধু তার নিজের ডকুমেন্টটিই অ্যারেতে রাখব
            if (!isAdultLeader) {
                if (docSnap.id === loggedInUser) {
                    allScouts.push(dataObj);
                }
            } else {
                allScouts.push(dataObj);
            }
        });

        globalMasterRecords = [];
        let availableDatesSet = new Set();
        let availableYearsSet = new Set();

        const currentDateObj = new Date();
        const currentYearNum = currentDateObj.getFullYear();
        const currentMonthNum = currentDateObj.getMonth();
        const currentWeekNum = Math.min(Math.ceil(currentDateObj.getDate() / 7), 4);

        allScouts.forEach(scout => {
            let paymentLogs = scout.subsPaymentLogs || {};
            let scoutName = scout.nameBn || scout.nameEn || scout.fullName || scout.name || "নামহীন সদস্য";
            let rawClass = scout.className || scout.class || "উল্লেখ নেই";
            let rawRoll = scout.classRoll || "নেই";

            Object.keys(paymentLogs).forEach(dateStr => {
                availableDatesSet.add(dateStr);
                let logsArr = paymentLogs[dateStr] || [];

                logsArr.forEach(item => {
                    let weekKey, timestamp;

                    if (typeof item === 'object' && item !== null) {
                        weekKey = item.weekKey;
                        timestamp = item.timestamp || "";
                    } else {
                        weekKey = item;
                        timestamp = "";
                    }

                    if (weekKey) {
                        let parts = weekKey.split('-');
                        let y = parseInt(parts[0]);
                        let mIdx = parseInt(parts[1]) - 1;
                        let wNum = parseInt(parts[2].replace('W', ''));
                        
                        availableYearsSet.add(y);

                        const monthNamesShort = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
                        const weekNamesBn = ["১ম", "২য়", "৩য়", "৪র্থ"];
                        let weekNameBn = weekNamesBn[wNum - 1] || `${wNum}তম`;

                        let approxDay = Math.min((wNum * 7) - 3, 28);
                        let formattedDateStr = `${String(approxDay).padStart(2, '0')} ${monthNamesShort[mIdx]}`;

                        let periodText = `${weekNameBn} সপ্তাহ (${formattedDateStr})`;

                        let determinedType = "বর্তমান চাঁদা";
                        
                        if (y > currentYearNum || (y === currentYearNum && mIdx > currentMonthNum) || (y === currentYearNum && mIdx === currentMonthNum && wNum > currentWeekNum)) {
                            determinedType = "অগ্রিম চাঁদা";
                        } else if (y < currentYearNum || (y === currentYearNum && mIdx < currentMonthNum) || (y === currentYearNum && mIdx === currentMonthNum && wNum < currentWeekNum)) {
                            determinedType = "বকেয়া চাঁদা";
                        }

                        let cls = "tag-current";
                        if (determinedType === "অগ্রিম চাঁদা") cls = "tag-advance";
                        else if (determinedType === "বকেয়া চাঁদা") cls = "tag-arrear";

                        globalMasterRecords.push({
                            paymentDate: dateStr,
                            timestamp: timestamp,
                            name: scoutName,
                            className: rawClass,
                            classRoll: rawRoll,
                            weekNum: wNum,
                            periodText: periodText,
                            monthIndex: mIdx,
                            yearVal: y,
                            tagText: determinedType,
                            tagClass: cls
                        });
                    }
                });
            });
        });

        populateDropdowns(Array.from(availableDatesSet).sort().reverse(), Array.from(availableYearsSet).sort());
        renderFilteredRecords(globalMasterRecords);

    } catch (err) {
        console.error("হিস্ট্রি লোড করতে সমস্যা:", err);
        contentDiv.innerHTML = "<p style='color: #f43f5e; text-align: center; padding: 20px;'>ডেটা লোড করতে ব্যর্থ হয়েছে!</p>";
    }
}

function populateDropdowns(dates, years) {
    const dateSelect = document.getElementById('filterDate');
    const yearSelect = document.getElementById('filterYear');

    if(!dateSelect || !yearSelect) return;

    let dateHtml = `<option value="all">সকল তারিখ</option>`;
    dates.forEach(d => {
        dateHtml += `<option value="${d}">${d}</option>`;
    });
    dateSelect.innerHTML = dateHtml;

    let yearHtml = `<option value="all">সকল বছর</option>`;
    years.forEach(y => {
        yearHtml += `<option value="${y}">${y}</option>`;
    });
    yearSelect.innerHTML = yearHtml;
}

window.applyHistoryFilters = function() {
    const selDate = document.getElementById('filterDate').value;
    const selWeek = document.getElementById('filterWeek').value;
    const selMonth = document.getElementById('filterMonth').value;
    const selYear = document.getElementById('filterYear').value;

    const filtered = globalMasterRecords.filter(item => {
        let matchDate = (selDate === 'all' || item.paymentDate === selDate);
        let matchWeek = (selWeek === 'all' || item.weekNum.toString() === selWeek);
        let matchMonth = (selMonth === 'all' || item.monthIndex.toString() === selMonth);
        let matchYear = (selYear === 'all' || item.yearVal.toString() === selYear);

        return matchDate && matchWeek && matchMonth && matchYear;
    });

    renderFilteredRecords(filtered);
}

function renderFilteredRecords(records) {
    const contentDiv = document.getElementById('paymentHistoryContent');
    if(!contentDiv) return;
    
    contentDiv.innerHTML = "";

    let totalAmount = records.length * 10;
    const totalAmountEl = document.getElementById('totalAmountText');
    const totalCountEl = document.getElementById('totalCountText');
    
    if(totalAmountEl) totalAmountEl.innerText = `${totalAmount} টাকা`;
    if(totalCountEl) totalCountEl.innerText = `${records.length} টি`;

    if (records.length === 0) {
        contentDiv.innerHTML = "<p style='color: #94a3b8; text-align: center; padding: 30px;'>এই ফিল্টারের সাথে মিলে এমন কোনো পেমেন্ট হিস্ট্রি নেই।</p>";
        return;
    }

    records.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

    let html = "";
    records.forEach(rec => {
        let timeDisplay = rec.timestamp ? ` | সময়: ${rec.timestamp}` : "";
        
        html += `
            <div class="record-card-item">
                <div class="record-info-left">
                    <span class="record-name">${rec.name}</span>
                    <span class="record-details-text" style="color: #38bdf8; font-size: 11.5px;">ক্লাস ${rec.className} রোল ${rec.classRoll}</span>
                    <span class="record-details-text">চাঁদার পিরিয়ড: ${rec.periodText}</span>
                    <span style="color: #facc15; font-size: 10.5px;">তারিখ: ${rec.paymentDate}${timeDisplay}</span>
                </div>
                <span class="record-tag ${rec.tagClass}">${rec.tagText}</span>
            </div>
        `;
    });

    contentDiv.innerHTML = html;
}

initPaymentHistoryPage();
