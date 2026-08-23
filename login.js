import { firedb } from './firebase-config.js';
import { collection, query, where, getDocs, or } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const togglePass = document.getElementById('togglePass');
const passInput = document.getElementById('passInput');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');
const passHelpMsg = document.getElementById('passHelpMsg');
const userInput = document.getElementById('userInput');

// ইউজার ইনপুট ফিল্ডে টাইপ করার সময় স্বয়ংক্রিয়ভাবে ছোট হাতের (lowercase) ইংরেজি অক্ষরে রূপান্তর করার লজিক
if (userInput) {
    userInput.addEventListener('input', (e) => {
        let val = e.target.value;
        e.target.value = val.toLowerCase();
    });
}

// পাসওয়ার্ড Show/Hide ফাংশন
togglePass.addEventListener('click', () => {
    if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePass.innerText = '🙈';
    } else {
        passInput.type = 'password';
        togglePass.innerText = '👁️';
    }
});

loginBtn.addEventListener('click', async () => {
    const inputVal = userInput.value.trim();
    const passVal = document.getElementById('passInput').value.trim();

    // রিসেট মেসেজ
    errorMsg.innerText = "";
    passHelpMsg.style.display = "none";

    if (!inputVal || !passVal) {
        errorMsg.innerText = "দয়া করে সকল তথ্য পূরণ করুন!";
        return;
    }

    // ন্যূনতম ৬ ডিজিটের পাসওয়ার্ড চেক করার লজিক
    if (passVal.length < 6) {
        errorMsg.innerText = "সর্বনিম্ন ৬ ডিজিটের পাসওয়ার্ড দিন";
        return;
    }

    try {
        errorMsg.innerText = "যাচাই করা হচ্ছে...";
        
        const usersRef = collection(firedb, "users");
        
        // Firestore কুয়েরি (username, mobile, email সব চেক করবে)
        const q = query(usersRef, or(
            where("username", "==", inputVal),
            where("mobile", "==", inputVal),
            where("email", "==", inputVal)
        ));

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            errorMsg.innerText = "এই তথ্য সম্বলিত কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি!";
        } else {
            const userDocSnap = querySnapshot.docs[0];
            const userDoc = userDocSnap.data();
            
            if (userDoc.password === passVal) {
                // সফল লগইন - ফায়ারস্টোর ডকুমেন্টের আইডি লোকালস্টোরেজে সেভ করা হলো
                localStorage.setItem("loggedInUser", userDocSnap.id);
                
                // কোনো পপআপ বা অতিরিক্ত টেক্সট ছাড়া সরাসরি ড্যাশবোর্ডে রিডাইরেক্ট
                window.location.href = "index.html"; 
            } else {
                errorMsg.innerText = "পাসওয়ার্ড ভুল!";
                passHelpMsg.style.display = "block";
            }
        }
    } catch (error) {
        console.error("Login Error: ", error);
        errorMsg.innerText = "সার্ভারে সমস্যা হচ্ছে, আবার চেষ্টা করুন।";
    }
});
