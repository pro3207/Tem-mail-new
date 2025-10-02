// 🌐 State variables
let currentAccount = null;
let currentToken = null;
let expirationTimer = null;

// DOM elements
const generatedEmail = document.getElementById("generated-email");
const generateBtn = document.getElementById("generate-btn");
const refreshBtn = document.getElementById("refresh-btn");
const emailList = document.getElementById("email-list");
const unreadCount = document.getElementById("unread-count");
const emailDetail = document.getElementById("email-detail");
const backToInbox = document.getElementById("back-to-inbox");
const deleteBtn = document.getElementById("delete-btn");
const timerElement = document.getElementById("timer");
const copyBtn = document.getElementById("copy-btn");
const searchInput = document.getElementById("search-input");

let emails = [];
let selectedEmails = [];
let timeLeft = 600;
const TIMER_KEY = "tempmail_timer";
const EMAIL_KEY = "tempmail_email";
const TOKEN_KEY = "tempmail_token";
const LIMIT_KEY = "tempmail_limit";
const LIMIT_WINDOW = 30 * 60 * 1000; // 30 minutes
const MAX_EMAILS = 3;

// 🎨 Theme Management
function initTheme() {
    const themeToggle = document.getElementById("theme-toggle");
    const themeIcon = themeToggle.querySelector("i");
    const savedTheme = localStorage.getItem("theme") || "dark";
    
    document.body.classList.toggle("light-theme", savedTheme === "light");
    themeIcon.className = savedTheme === "light" ? "fas fa-sun" : "fas fa-moon";
    
    themeToggle.addEventListener("click", () => {
        const isLight = document.body.classList.toggle("light-theme");
        localStorage.setItem("theme", isLight ? "light" : "dark");
        themeIcon.className = isLight ? "fas fa-sun" : "fas fa-moon";
    });
}

// 📨 Create account + fetch token
async function createTempAccount() {
    try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        const username = Array.from(crypto.getRandomValues(new Uint8Array(6)))
            .map((b) => b.toString(36).padStart(2, "0")).join("");
        
        // Get available domains
        const domainRes = await fetch("https://api.mail.tm/domains");
        if (!domainRes.ok) throw new Error("Failed to fetch domains");
        
        const domains = await domainRes.json();
        const domain = domains["hydra:member"][0]?.domain;
        
        if (!domain) throw new Error("No domains available");
        
        const email = `${username}@${domain}`;
        const password = `${Math.random().toString(36).substring(2, 10)}*Temp`;

        // Create account
        const accountRes = await fetch("https://api.mail.tm/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: email, password }),
        });

        if (!accountRes.ok) {
            throw new Error("Failed to create account");
        }

        // Get authentication token
        const tokenRes = await fetch("https://api.mail.tm/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: email, password }),
        });
        
        if (!tokenRes.ok) {
            throw new Error("Failed to get authentication token");
        }
        
        const tokenData = await tokenRes.json();

        // Update state
        currentAccount = email;
        currentToken = tokenData.token;
        
        // Store in localStorage
        const startTime = Date.now();
        localStorage.setItem(TIMER_KEY, startTime.toString());
        localStorage.setItem(EMAIL_KEY, email);
        localStorage.setItem(TOKEN_KEY, tokenData.token);
        
        // Update UI
        generatedEmail.textContent = email;
        timeLeft = 600;
        startTimer();
        fetchInbox();
        
        showNotification("✅ Temporary email created successfully!");
        
    } catch (error) {
        console.error("Error creating account:", error);
        showNotification("❌ Failed to create temporary email. Please try again.");
        
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-plus"></i> Generate New Address';
    }
}

// ⏱️ Start expiration countdown
function startTimer() {
    clearInterval(expirationTimer);

    const storedTime = localStorage.getItem(TIMER_KEY);
    const startTime = storedTime ? parseInt(storedTime, 10) : Date.now();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timeLeft = Math.max(600 - elapsed, 0);

    updateTimerDisplay();

    expirationTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft < 0) {
            clearInterval(expirationTimer);
            handleExpiration();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const min = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const sec = String(timeLeft % 60).padStart(2, "0");
    timerElement.innerHTML = `<i class="fas fa-hourglass-start"></i> Expires in: ${min}:${sec}`;
}

function handleExpiration() {
    emails = [];
    renderEmailList();
    timerElement.innerHTML = `<i class="fas fa-clock"></i> Mailbox expired`;
    showNotification("⏳ Temporary mailbox expired");

    // Clear storage
    localStorage.removeItem(TIMER_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(TOKEN_KEY);

    // Reset state
    currentAccount = null;
    currentToken = null;

    // Enable generate button
    generateBtn.disabled = false;
    generateBtn.classList.remove("disabled");
    generateBtn.innerHTML = '<i class="fas fa-plus"></i> Generate New Address';
}

// 📬 Fetch inbox messages
async function fetchInbox() {
    if (!currentToken) return;
    
    try {
        const res = await fetch("https://api.mail.tm/messages", {
            headers: { Authorization: `Bearer ${currentToken}` },
        });
        
        if (!res.ok) throw new Error("Failed to fetch inbox");
        
        const data = await res.json();
        emails = data["hydra:member"].map((msg) => ({
            id: msg.id,
            sender: msg.from?.address || "Unknown Sender",
            subject: msg.subject || "(No Subject)",
            preview: msg.intro || "No preview available",
            time: new Date(msg.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            unread: !msg.seen,
            content: null,
            fullDate: new Date(msg.createdAt).toLocaleString()
        }));
        
        renderEmailList();
    } catch (error) {
        console.error("Error fetching inbox:", error);
        showNotification("❌ Failed to refresh inbox");
    }
}

// 📥 View email detail
async function showEmailDetail(email) {
    try {
        if (!email.content) {
            const res = await fetch(`https://api.mail.tm/messages/${email.id}`, {
                headers: { Authorization: `Bearer ${currentToken}` },
            });
            
            if (!res.ok) throw new Error("Failed to fetch email content");
            
            const data = await res.json();
            email.content = data.text || data.html || "(No content available)";
        }

        // Hide inbox, show detail
        document.querySelector(".inbox-container").style.display = "none";
        emailDetail.style.display = "block";
        
        // Populate email detail
        document.getElementById("detail-sender").textContent = email.sender;
        document.getElementById("detail-subject").textContent = email.subject;
        document.getElementById("detail-date").textContent = email.fullDate;
        
        const emailBody = document.querySelector(".email-body");
        if (email.content.includes("<") && email.content.includes(">")) {
            // HTML content
            emailBody.innerHTML = email.content;
        } else {
            // Plain text content
            emailBody.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${email.content}</pre>`;
        }

        // Mark as read
        if (email.unread) {
            email.unread = false;
            renderEmailList();
        }
        
    } catch (error) {
        console.error("Error showing email detail:", error);
        showNotification("❌ Failed to load email content");
    }
}

// 🧹 Render email list
function renderEmailList() {
    const searchTerm = searchInput.value.toLowerCase();
    
    // Filter emails based on search
    const filteredEmails = emails.filter(email => 
        email.sender.toLowerCase().includes(searchTerm) ||
        email.subject.toLowerCase().includes(searchTerm) ||
        email.preview.toLowerCase().includes(searchTerm)
    );

    emailList.innerHTML = "";
    
    if (filteredEmails.length === 0) {
        emailList.innerHTML = `
            <div class="no-emails">
                <i class="fas fa-inbox fa-2x"></i>
                <p>${emails.length === 0 ? 'No emails yet' : 'No emails match your search'}</p>
            </div>
        `;
        unreadCount.textContent = "0";
        return;
    }

    let unread = 0;
    
    filteredEmails.forEach((email) => {
        if (email.unread) unread++;
        
        const item = document.createElement("div");
        item.className = `email-item ${email.unread ? "unread" : ""}`;
        item.dataset.id = email.id;
        item.innerHTML = `
            <div class="email-checkbox">
                <input type="checkbox" class="email-checkbox-input" data-id="${email.id}">
            </div>
            <div class="email-sender">${email.sender}</div>
            <div class="email-content">
                <div class="email-subject">${email.subject}</div>
                <div class="email-preview">${email.preview}</div>
            </div>
            <div class="email-time">${email.time}</div>
        `;
        emailList.appendChild(item);
    });
    
    unreadCount.textContent = unread.toString();

    // Add event listeners
    attachEmailEventListeners();
}

function attachEmailEventListeners() {
    // Email item click
    document.querySelectorAll(".email-item").forEach((item) => {
        item.addEventListener("click", (e) => {
            if (!e.target.classList.contains("email-checkbox-input")) {
                const id = item.dataset.id;
                const email = emails.find((e) => e.id === id);
                showEmailDetail(email);
            }
        });
    });

    // Checkbox handling
    document.querySelectorAll(".email-checkbox-input").forEach((checkbox) => {
        checkbox.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = checkbox.dataset.id;
            
            if (checkbox.checked) {
                selectedEmails.push(id);
            } else {
                selectedEmails = selectedEmails.filter((i) => i !== id);
            }
            
            updateDeleteButtonState();
        });
    });
}

function updateDeleteButtonState() {
    if (selectedEmails.length > 0) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Delete (${selectedEmails.length})`;
    } else {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
    }
}

// ❌ Delete selected messages
async function deleteSelectedEmails() {
    if (!selectedEmails.length || !currentToken) {
        showNotification("⚠️ No emails selected");
        return;
    }

    try {
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        deleteBtn.disabled = true;

        for (let id of selectedEmails) {
            await fetch(`https://api.mail.tm/messages/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${currentToken}` },
            });
        }

        selectedEmails = [];
        await fetchInbox();
        showNotification("🗑️ Selected emails deleted");
        
    } catch (error) {
        console.error("Error deleting emails:", error);
        showNotification("❌ Failed to delete emails");
    } finally {
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
        deleteBtn.disabled = true;
    }
}

// 🔍 Search functionality
function initSearch() {
    let searchTimeout;
    searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            renderEmailList();
        }, 300);
    });
}

// 📋 Copy to clipboard
async function copyToClipboard() {
    const emailText = generatedEmail.textContent.trim();
    
    if (!emailText || emailText === "Click generate to create email") {
        showNotification("⚠️ No email address to copy");
        return;
    }

    try {
        await navigator.clipboard.writeText(emailText);
        showNotification("📋 Email copied to clipboard!");
        
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        }, 2000);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = emailText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        
        showNotification("📋 Email copied to clipboard!");
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        }, 2000);
    }
}

// 📢 Notification system
function showNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById("notification");
    if (!notification) {
        notification = document.createElement("div");
        notification.id = "notification";
        notification.className = "notification";
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.classList.add("show");
    
    setTimeout(() => {
        notification.classList.remove("show");
    }, 3000);
}

// ❓ FAQ functionality
function initFAQ() {
    document.querySelectorAll("#faq .faq-item h3").forEach((question) => {
        question.addEventListener("click", () => {
            const faqItem = question.parentElement;
            faqItem.classList.toggle("open");
        });
    });
}

// 📜 Modal Management
function initModals() {
    const modals = [
        { openId: "openPrivacy", modalId: "privacyModal", closeId: "closePrivacy" },
        { openId: "openTerms", modalId: "termsModal", closeId: "closeTerms" },
        { openId: "openContact", modalId: "contactModal", closeId: "closeContact" },
        { openId: "openApi", modalId: "apiModal", closeId: "closeApi" }
    ];

    modals.forEach(({ openId, modalId, closeId }) => {
        const openBtn = document.getElementById(openId);
        const modal = document.getElementById(modalId);
        const closeBtn = document.getElementById(closeId);

        if (!openBtn || !modal || !closeBtn) return;

        openBtn.addEventListener("click", (e) => {
            e.preventDefault();
            modal.style.display = "block";
            document.body.style.overflow = "hidden";
        });

        closeBtn.addEventListener("click", () => {
            modal.style.display = "none";
            document.body.style.overflow = "";
        });

        // Close modal when clicking outside
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
                document.body.style.overflow = "";
            }
        });
    });

    // Close modal with Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal").forEach(modal => {
                modal.style.display = "none";
                document.body.style.overflow = "";
            });
        }
    });
}

// 🔄 Check email generation limit
function checkEmailLimit() {
    const history = JSON.parse(localStorage.getItem(LIMIT_KEY) || "[]");
    const now = Date.now();
    
    // Remove entries older than 30 minutes
    const recent = history.filter(t => now - t < LIMIT_WINDOW);
    localStorage.setItem(LIMIT_KEY, JSON.stringify(recent));
    
    return recent.length;
}

// 🚀 Initialize application
function initApp() {
    const storedStart = localStorage.getItem(TIMER_KEY);
    const storedEmail = localStorage.getItem(EMAIL_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (storedStart && storedEmail && storedToken) {
        // Restore existing session
        currentAccount = storedEmail;
        currentToken = storedToken;
        generatedEmail.textContent = storedEmail;
        
        generateBtn.disabled = true;
        generateBtn.classList.add("disabled");
        generateBtn.innerHTML = '<i class="fas fa-lock"></i> Locked';
        
        startTimer();
        fetchInbox();
    } else {
        // Clear any expired data
        localStorage.removeItem(TIMER_KEY);
        localStorage.removeItem(EMAIL_KEY);
        localStorage.removeItem(TOKEN_KEY);
    }
}

// 📝 Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    // Initialize all components
    initTheme();
    initModals();
    initFAQ();
    initSearch();
    initApp();

    // Email generation
    generateBtn.addEventListener("click", () => {
        const recentCount = checkEmailLimit();
        
        if (recentCount >= MAX_EMAILS) {
            showNotification(`🚫 Limit reached: You can only create ${MAX_EMAILS} emails every 30 minutes`);
            return;
        }

        // Update limit counter
        const history = JSON.parse(localStorage.getItem(LIMIT_KEY) || "[]");
        history.push(Date.now());
        localStorage.setItem(LIMIT_KEY, JSON.stringify(history));

        createTempAccount();
    });

    // Refresh inbox
    refreshBtn.addEventListener("click", () => {
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing';
        fetchInbox().then(() => {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            showNotification("🔁 Inbox refreshed");
        }).catch(() => {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        });
    });

    // Delete emails
    deleteBtn.addEventListener("click", deleteSelectedEmails);

    // Back to inbox
    backToInbox.addEventListener("click", () => {
        emailDetail.style.display = "none";
        document.querySelector(".inbox-container").style.display = "block";
    });

    // Copy email
    copyBtn.addEventListener("click", copyToClipboard);

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && currentToken) {
        fetchInbox(); // Refresh inbox when tab becomes visible
    }
});

// Handle beforeunload
window.addEventListener("beforeunload", () => {
    if (expirationTimer) {
        clearInterval(expirationTimer);
    }
});
