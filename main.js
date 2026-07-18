// ===========================
// GLOBAL HELPER FUNCTIONS (Gender Pills & Password Eye Toggle)
// ===========================
window.selectGenderPill = function(pillEl, value) {
    const pills = document.querySelectorAll("#genderPills .gender-pill");
    pills.forEach(p => p.classList.remove("active"));
    pillEl.classList.add("active");
    const hiddenInput = document.getElementById("registerGender");
    if (hiddenInput) hiddenInput.value = value;
};

window.togglePasswordVisibility = function(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const icon = btnEl.querySelector("i");
    btnEl.classList.remove("animate");
    // Trigger reflow for re-animation
    void btnEl.offsetWidth;
    btnEl.classList.add("animate");

    if (input.type === "password") {
        input.type = "text";
        if (icon) {
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }
    } else {
        input.type = "password";
        if (icon) {
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    }
};

// ===========================
// NAVBAR SHADOW
// ===========================

window.addEventListener("scroll", () => {

    const navbar = document.querySelector(".navbar");

    if (!navbar) return;

    if (window.scrollY > 50) {
        navbar.style.boxShadow =
            "0 10px 30px rgba(0,0,0,.08)";
    } else {
        navbar.style.boxShadow = "none";
    }

});

// ===========================
// LOGIN FORM
// ===========================

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();

            const inputs =
                loginForm.querySelectorAll("input");

            const email =
                inputs[0].value.trim();

            const password =
                inputs[1].value;

            try {

                const response =
                    await fetch(
                        "http://localhost:5000/api/auth/login",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                email,
                                password
                            })
                        }
                    );

                const data =
                    await response.json();

                if (data.success) {

                    localStorage.setItem(
                        "user",
                        JSON.stringify(data.user)
                    );

                    window.showToast(
                        "Login Successful"
                    );

                    window.location.href =
                        "dashboard.html";

                } else {

                    window.showToast(
                        data.message ||
                        "Login Failed"
                    );

                }

            } catch (error) {

                console.error(error);

                window.showToast(
                    "Cannot connect to server"
                );

            }

        }
    );

}

// ===========================
// REGISTER FORM (Guarded & Bulletproof)
// ===========================
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Absolute first line interception

        const nameEl = document.getElementById("registerName");
        const emailEl = document.getElementById("registerEmail");
        const ageEl = document.getElementById("registerAge");
        const genderEl = document.getElementById("registerGender");
        const countryEl = document.getElementById("registerCountry");
        const passEl = document.getElementById("registerPassword");
        const confirmPassEl = document.getElementById("registerConfirmPassword");

        if (!nameEl || !emailEl || !passEl || !confirmPassEl) return;

        const full_name = nameEl.value.trim();
        const email = emailEl.value.trim();
        const age = ageEl ? ageEl.value.trim() : null;
        const gender = genderEl ? genderEl.value : null;
        const country = countryEl ? countryEl.value.trim() : null;
        const password = passEl.value;
        const confirmPassword = confirmPassEl.value;

        if (password !== confirmPassword) {
            window.showToast("Passwords do not match!");
            return;
        }

        // Gather selected topics (LeetCode bubbles)
        const selectedBubbles = document.querySelectorAll("#topicsContainer .topic-bubble.selected");
        const topics = Array.from(selectedBubbles).map(b => b.textContent.trim());

        try {
            const response = await fetch("http://localhost:5000/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name,
                    email,
                    password,
                    age,
                    gender,
                    country,
                    topics
                })
            });

            const data = await response.json();

            if (response.ok) {
                window.showToast("Registration Successful! You can now log in.");
                window.location.href = "login.html";
            } else {
                window.showToast(data.message || "Registration Failed");
            }
        } catch (error) {
            console.error("Register network error:", error);
            window.showToast("Cannot connect to server");
        }
    });
}
// ===========================
// CHECK LOGGED USER
// ===========================

function getLoggedInUser() {

    const user =
        localStorage.getItem("user");

    if (!user) return null;

    return JSON.parse(user);

}

// ===========================
// LOGOUT
// ===========================

function logout() {

    localStorage.removeItem("user");

    window.location.href =
        "login.html";

}

// ===========================
// FLOATING EFFECT
// ===========================

const floatingCards =
    document.querySelectorAll(
        ".floating-card"
    );

window.addEventListener(
    "mousemove",
    (e) => {

        const x =
            e.clientX /
            window.innerWidth;

        const y =
            e.clientY /
            window.innerHeight;

        floatingCards.forEach(
            (card, index) => {

                const speed =
                    (index + 1) * 10;

                card.style.transform =
                    `translate(
                        ${x * speed}px,
                        ${y * speed}px
                    )`;

            }
        );

    }
);
// =====================
// DASHBOARD USER (Safe Verification)
// =====================

function updateUserNavbarDisplay(user) {
    if (!user) return;
    const username = document.getElementById("username");
    if (username) username.textContent = user.full_name || "Developer";
    const welcomeEl = document.getElementById("welcomeUserName");
    if (welcomeEl) welcomeEl.textContent = user.full_name || "Developer";

    const avatarEl = document.querySelector(".avatar");
    if (avatarEl) {
        if (user.profile_picture) {
            avatarEl.innerHTML = `<img src="${user.profile_picture}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else if (user.full_name) {
            avatarEl.innerHTML = "";
            avatarEl.textContent = user.full_name[0].toUpperCase();
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const username = document.getElementById("username");
    if (username) {
        const user = getLoggedInUser();
        if (!user) {
            console.warn("No active user session found in localStorage.");
        } else {
            updateUserNavbarDisplay(user);
            fetch(`http://localhost:5000/api/auth/profile/${user.id}`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data && data.success && data.user) {
                        localStorage.setItem("user", JSON.stringify(data.user));
                        updateUserNavbarDisplay(data.user);
                    }
                })
                .catch(err => console.warn("Failed to sync fresh profile data on navbar:", err));
        }
    }
});

// Toggle Profile Dropdown Menu
function toggleProfileMenu(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById("profileDropdown");
    if (dropdown) {
        dropdown.classList.toggle("show");
    }
}

// Close dropdown if clicking outside
window.addEventListener("click", () => {
    const dropdown = document.getElementById("profileDropdown");
    if (dropdown && dropdown.classList.contains("show")) {
        dropdown.classList.remove("show");
    }
});

// Quick Avatar Upload directly from Dashboard dropdown
const quickAvatarInput = document.getElementById("quickAvatarInput");
if (quickAvatarInput) {
    quickAvatarInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            window.showToast("Please select an image smaller than 5 MB.");
            return;
        }

        const user = getLoggedInUser();
        if (!user || !user.id) {
            window.showToast("Please log in first to update your profile photo.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(evt) {
            const base64Img = evt.target.result;
            try {
                const response = await fetch(`http://localhost:5000/api/auth/profile/${user.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        full_name: user.full_name,
                        age: user.age || null,
                        country: user.country || null,
                        github_username: user.github_username || null,
                        gender: user.gender || null,
                        topics: user.topics || [],
                        profile_picture: base64Img
                    })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    localStorage.setItem("user", JSON.stringify(data.user));
                    const avatarEl = document.querySelector(".avatar");
                    if (avatarEl) {
                        avatarEl.innerHTML = `<img src="${base64Img}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                    }
                    window.showToast("Avatar updated cleanly across your AlgoMentor database!");
                } else {
                    window.showToast(data.message || "Failed to save profile picture");
                }
            } catch (err) {
                console.error("Quick avatar upload error:", err);
                window.showToast("Network error updating profile photo");
            }
        };
        reader.readAsDataURL(file);
    });
}
// =====================
// PROBLEM DRAWER
// =====================

const drawer =
    document.getElementById(
        "problemDrawer"
    );

const openBtn =
    document.getElementById(
        "problemBtn"
    );

const closeBtn =
    document.getElementById(
        "closeDrawer"
    );

if (openBtn) {
    openBtn.onclick = () =>
        drawer.classList.add("open");
}

if (closeBtn) {
    closeBtn.onclick = () =>
        drawer.classList.remove("open");
}

// ==========================================
// LIVE DASHBOARD TELEMETRY & GAMIFICATION ENGINE
// ==========================================
async function initLiveDashboard() {
    const solvedCountEl = document.getElementById("dashSolvedCount");
    if (!solvedCountEl) return; // We are not on dashboard.html

    const user = getLoggedInUser();
    const userId = user ? user.id : 1; // Default fallback ID if testing locally

    // ========================================================
    // 1. KPI CARDS & GAMIFIED LEVEL/XP & CHART & RESUME BANNER
    // ========================================================
    fetch(`http://localhost:5000/api/analytics/user/${userId}`)
        .then(r => r.ok ? r.json() : null)
        .then(analyticsData => {
            if (!analyticsData || !analyticsData.success) {
                solvedCountEl.innerText = "0";
                return;
            }

            const kpis = analyticsData.kpis || {};
            const solved = kpis.solved || { Easy: 0, Medium: 0, Hard: 0, Total: 0 };
            const total = kpis.totalProblems || { Total: 1642 };

            // Update Solved Card
            solvedCountEl.innerText = solved.Total || 0;
            const subtextEl = document.getElementById("dashSolvedSubtext");
            if (subtextEl) subtextEl.innerText = `Solved / ${total.Total || 1642} Problems`;

            // Calculate XP and Level (+20 Easy, +50 Medium, +100 Hard)
            const easySolved = parseInt(solved.Easy) || 0;
            const medSolved = parseInt(solved.Medium) || 0;
            const hardSolved = parseInt(solved.Hard) || 0;
            const totalXP = (easySolved * 20) + (medSolved * 50) + (hardSolved * 100);

            const xpPerLevel = 500;
            const level = Math.floor(totalXP / xpPerLevel) + 1;
            const xpInCurrentLevel = totalXP % xpPerLevel;
            const xpPercentage = Math.min(Math.round((xpInCurrentLevel / xpPerLevel) * 100), 100);

            const levelTitles = {
                1: "Novice Coder",
                2: "Apprentice Dev",
                3: "Algorithm Knight",
                4: "System Master",
                5: "Grandmaster 👑"
            };
            const title = levelTitles[level] || `Level ${level} Elite`;

            const levelTitleEl = document.getElementById("dashLevelTitle");
            const xpTextEl = document.getElementById("dashXpText");
            const xpBarEl = document.getElementById("dashXpBar");
            if (levelTitleEl) levelTitleEl.innerText = `Level ${level} - ${title.split(" ")[0]}`;
            if (xpTextEl) xpTextEl.innerText = `${xpInCurrentLevel} / ${xpPerLevel} XP to Level ${level + 1}`;
            if (xpBarEl) xpBarEl.style.width = `${xpPercentage}%`;

            // Update Accuracy & Ranking Tier (Using Verified Unique Problem Mastery Rate)
            const accEl = document.getElementById("dashAccuracy");
            const rankEl = document.getElementById("dashRanking");
            if (accEl) accEl.innerText = `${kpis.acceptanceRate || 0}%`;
            if (rankEl) {
                const acc = parseFloat(kpis.acceptanceRate || 0);
                if (acc >= 85) rankEl.innerText = "Diamond Tier 💎 - Top 8%";
                else if (acc >= 70) rankEl.innerText = "Gold Tier 🏆 - Top 20%";
                else rankEl.innerText = "Silver Tier ⚡ - Top 40%";
            }

            const compEl = document.getElementById("dashComplexityMastery");
            if (compEl) compEl.innerText = `${kpis.complexityMasteryRate || '100.0'}%`;

            // Calculate Active Coding Streak (handles UTC & Local timezone reliably)
            let currentStreak = 0;
            if (kpis && kpis.currentStreak !== undefined) {
                currentStreak = kpis.currentStreak;
            } else if (Array.isArray(analyticsData.heatmap) && analyticsData.heatmap.length > 0) {
                const dateMap = {};
                analyticsData.heatmap.forEach(h => { dateMap[h.date] = parseInt(h.count) || 0; });
                
                const nowLocal = new Date();
                const y = nowLocal.getFullYear();
                const m = String(nowLocal.getMonth() + 1).padStart(2, '0');
                const d = String(nowLocal.getDate()).padStart(2, '0');
                const localTodayStr = `${y}-${m}-${d}`;

                const yestLocal = new Date(nowLocal);
                yestLocal.setDate(yestLocal.getDate() - 1);
                const yestStr = `${yestLocal.getFullYear()}-${String(yestLocal.getMonth() + 1).padStart(2, '0')}-${String(yestLocal.getDate()).padStart(2, '0')}`;

                let checkDateObj = null;
                if (dateMap[localTodayStr] > 0) checkDateObj = new Date(nowLocal);
                else if (dateMap[yestStr] > 0) checkDateObj = new Date(yestLocal);

                if (checkDateObj) {
                    currentStreak = 0;
                    while (true) {
                        const cy = checkDateObj.getFullYear();
                        const cm = String(checkDateObj.getMonth() + 1).padStart(2, '0');
                        const cd = String(checkDateObj.getDate()).padStart(2, '0');
                        const cStr = `${cy}-${cm}-${cd}`;
                        if (dateMap[cStr] > 0) {
                            currentStreak++;
                            checkDateObj.setDate(checkDateObj.getDate() - 1);
                        } else {
                            break;
                        }
                    }
                }
            }
            const streakEl = document.getElementById("dashStreakDays");
            if (streakEl) streakEl.innerText = `${currentStreak || 0} Days`;

            // "Finish What You Started" Resume Banner
            const bannerContainer = document.getElementById("dashResumeBannerContainer");
            if (bannerContainer && analyticsData.pendingAttempted && analyticsData.pendingAttempted.length > 0) {
                const pending = analyticsData.pendingAttempted[0];
                bannerContainer.innerHTML = `
                    <div class="resume-banner animate__animated animate__fadeInDown">
                        <div class="resume-info">
                            <h3><i class="fas fa-bug" style="color: #facc15;"></i> Finish What You Started: ${pending.title}</h3>
                            <p>You left this ${pending.difficulty || 'Medium'} challenge in Progress (${pending.submission_count || 1} attempts). Jump back in and claim victory!</p>
                        </div>
                        <button class="btn btn-primary" onclick="window.location.href='workspace.html?id=${pending.problem_id}&from=dashboard.html'" style="padding: 10px 22px; font-weight: 800;">
                            Resume Debugging <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                `;
            }

            // Weekly Velocity Chart (Chart.js)
            const canvas = document.getElementById("progressChart");
            if (canvas && typeof Chart !== "undefined") {
                const ctx = canvas.getContext("2d");
                const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                const labels = [];
                const volumes = [];
                const accepted = [];
                const today = new Date();

                const dateMapSubs = {};
                const dateMapAccepted = {};
                if (Array.isArray(analyticsData.heatmap)) {
                    analyticsData.heatmap.forEach(h => {
                        dateMapSubs[h.date] = h.count;
                        dateMapAccepted[h.date] = h.solved_count || Math.round(h.count * 0.8);
                    });
                }

                for (let i = 6; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(today.getDate() - i);
                    const dStr = d.toISOString().split('T')[0];
                    labels.push(i === 0 ? "Today" : daysOfWeek[d.getDay()]);
                    volumes.push(dateMapSubs[dStr] || 0);
                    accepted.push(dateMapAccepted[dStr] || 0);
                }

                const gradientGreen = ctx.createLinearGradient(0, 0, 0, 200);
                gradientGreen.addColorStop(0, "rgba(34, 197, 94, 0.3)");
                gradientGreen.addColorStop(1, "rgba(34, 197, 94, 0.0)");

                const gradientOrange = ctx.createLinearGradient(0, 0, 0, 200);
                gradientOrange.addColorStop(0, "rgba(255, 107, 0, 0.25)");
                gradientOrange.addColorStop(1, "rgba(255, 107, 0, 0.0)");

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Accepted Solutions',
                                data: accepted,
                                borderColor: '#22c55e',
                                backgroundColor: gradientGreen,
                                fill: true,
                                tension: 0.4,
                                borderWidth: 3,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                                pointBackgroundColor: '#22c55e'
                            },
                            {
                                label: 'Total Submissions',
                                data: volumes,
                                borderColor: '#FF6B00',
                                backgroundColor: gradientOrange,
                                fill: true,
                                tension: 0.4,
                                borderDash: [5, 5],
                                borderWidth: 2,
                                pointRadius: 3,
                                pointHoverRadius: 5,
                                pointBackgroundColor: '#FF6B00'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top', labels: { boxWidth: 12, font: { weight: 'bold' } } }
                        },
                        scales: {
                            y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }
        })
        .catch(err => {
            console.error("Dashboard KPIs fetch error:", err);
            if (solvedCountEl) solvedCountEl.innerText = "0";
        });

    // ========================================================
    // 2. DYNAMIC DAILY PICK ENGINE (Non-blocking & Fast)
    // ========================================================
    const titleEl = document.getElementById("dashDailyPickTitle");
    const diffEl = document.getElementById("dashDailyPickDiff");
    const badgeEl = document.getElementById("dashDailyPickBadge");
    const btnEl = document.getElementById("dashDailyPickBtn");

    const fallbackPick = { id: 3, title: "Longest Substring Without Repeating Characters", difficulty: "Medium", category: "Strings & Sliding Window" };

    fetch(`http://localhost:5000/api/problems/summary`)
        .then(r => r.ok ? r.json() : null)
        .then(problemsData => {
            let pick = fallbackPick;
            if (problemsData && Array.isArray(problemsData) && problemsData.length > 0) {
                const today = new Date();
                const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
                const pickIndex = dayOfYear % problemsData.length;
                pick = problemsData[pickIndex] || fallbackPick;
            }

            if (titleEl) titleEl.innerText = pick.title;
            if (diffEl) {
                diffEl.innerText = pick.difficulty || "Medium";
                diffEl.className = `difficulty-badge ${(pick.difficulty || 'Medium').toLowerCase()}`;
            }
            if (badgeEl) badgeEl.innerText = `Daily Pick • ${pick.category || 'Algorithmic Challenge'}`;
            if (btnEl) btnEl.onclick = () => window.location.href = `workspace.html?id=${pick.id}&from=dashboard.html`;
        })
        .catch(err => {
            console.warn("Daily pick summary fallback used:", err);
            if (titleEl) titleEl.innerText = fallbackPick.title;
            if (diffEl) diffEl.innerText = fallbackPick.difficulty;
            if (btnEl) btnEl.onclick = () => window.location.href = `workspace.html?id=${fallbackPick.id}&from=dashboard.html`;
        });

    // ========================================================
    // 3. LIVE ACTIVITY FEED ENGINE (Non-blocking)
    // ========================================================
    const feedEl = document.getElementById("dashActivityFeed");
    if (!feedEl) return;

    fetch(`http://localhost:5000/api/submissions/user/${userId}`)
        .then(r => r.ok ? r.json() : null)
        .then(subsData => {
            if (!subsData || !subsData.success || !Array.isArray(subsData.submissions) || subsData.submissions.length === 0) {
                feedEl.innerHTML = `<div style="text-align: center; padding: 25px; color: var(--text-muted); font-weight: 600;">Clean slate! Solve your first challenge today to see your execution telemetry here.</div>`;
                return;
            }

            feedEl.innerHTML = '';
            subsData.submissions.slice(0, 6).forEach(sub => {
                const isSuccess = sub.status === 'Accepted';
                const iconClass = isSuccess ? 'fa-check' : 'fa-times';
                const statusClass = isSuccess ? 'success' : 'failed';
                
                // Time ago
                const diffMins = Math.max(1, Math.floor((new Date() - new Date(sub.submitted_at)) / 60000));
                let timeAgo = `${diffMins} mins ago`;
                if (diffMins >= 1440) timeAgo = `${Math.floor(diffMins / 1440)} days ago`;
                else if (diffMins >= 60) timeAgo = `${Math.floor(diffMins / 60)} hours ago`;

                const item = document.createElement('div');
                item.className = 'activity';
                item.style.cursor = 'pointer';
                item.onclick = () => window.location.href = `workspace.html?id=${sub.problem_id}&from=dashboard.html`;
                item.innerHTML = `
                    <div class="activity-info">
                        <div class="activity-status ${statusClass}"><i class="fas ${iconClass}"></i></div>
                        <div>
                            <span style="font-weight: 700; color: var(--text-primary); display: block;">${sub.problem_title || 'Algorithmic Execution'}</span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Language: ${sub.language || 'Code'} • Speed: ${sub.execution_time_ms ? sub.execution_time_ms + 'ms' : 'N/A'}</span>
                        </div>
                    </div>
                    <span class="activity-time">${timeAgo}</span>
                `;
                feedEl.appendChild(item);
            });
        })
        .catch(err => {
            console.warn("Telemetry feed fallback:", err);
            feedEl.innerHTML = `<div style="text-align: center; padding: 25px; color: var(--text-muted); font-weight: 600;">Clean slate! Solve your first challenge today to see your execution telemetry here.</div>`;
        });
}

// Auto-trigger when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLiveDashboard);
} else {
    initLiveDashboard();
}

// ==========================================
// INTERACTIVE RANK & XP RULES MODAL CONTROLLERS
// ==========================================
function openRulesModal() {
    const overlay = document.getElementById("rulesModalOverlay");
    if (overlay) overlay.classList.add("active");
}

function closeRulesModal() {
    const overlay = document.getElementById("rulesModalOverlay");
    if (overlay) overlay.classList.remove("active");
}
window.openRulesModal = openRulesModal;
window.closeRulesModal = closeRulesModal;

window.showToast = function(message, type = "success") {
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "toast-container";
        toastContainer.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;";
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement("div");
    toast.style.cssText = `padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 0.9rem; font-weight: 600; background: ${type === 'success' ? '#10b981' : '#ef4444'}; box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transform: translateY(10px); transition: all 0.3s ease;`;
    toast.innerText = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    }, 10);
    
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};
