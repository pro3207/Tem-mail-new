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

let emails = [];
let selectedEmails = [];
let timeLeft = 600;

// Storage keys
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
        console.log("🔄 Starting email generation...");
        
        // Show loading state
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        // Generate random username
        const username = Array.from(crypto.getRandomValues(new Uint8Array(6)))
            .map((b) => b.toString(36).padStart(2, "0")).join("");
        
        console.log("📧 Generated username:", username);
        
        // Get available domains - FIXED API CALL
        console.log("🌐 Fetching domains...");
        const domainRes = await fetch("https://api.mail.tm/domains");
        
        if (!domainRes.ok) {
            throw new Error(`Domain fetch failed: ${domainRes.status}`);
        }
        
        const domainData = await domainRes.json();
        console.log("📦 Domain response:", domainData);
        
        // Extract domain from response - FIXED: Properly access the domain
        const domains = domainData["hydra:member"];
        if (!domains || domains.length === 0) {
            throw new Error("No domains available from API");
        }
        
        const domain = domains[0].domain;
        console.log("✅ Selected domain:", domain);
        
        const email = `${username}@${domain}`;
        const password = `${Math.random().toString(36).substring(2, 10)}*Temp`;

        console.log("🔐 Creating account...");
        // Create account - FIXED: Proper JSON structure
        const accountRes = await fetch("https://api.mail.tm/accounts", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ 
                address: email, 
                password: password 
            }),
        });

        console.log("📨 Account creation response:", accountRes.status);
        
        if (!accountRes.ok) {
            const errorText = await accountRes.text();
            throw new Error(`Account creation failed: ${accountRes.status} - ${errorText}`);
        }

        const accountData = await accountRes.json();
        console.log("✅ Account created:", accountData);

        // Get authentication token - FIXED: Proper JSON structure
        console.log("🔑 Getting authentication token...");
        const tokenRes = await fetch("https://api.mail.tm/token", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ 
                address: email, 
                password: password 
            }),
        });
        
        console.log("🔑 Token response:", tokenRes.status);
        
        if (!tokenRes.ok) {
            const errorText = await tokenRes.text();
            throw new Error(`Token fetch failed: ${tokenRes.status} - ${errorText}`);
        }
        
        const tokenData = await tokenRes.json();
        console.log("✅ Token received");

        // Update state
        currentAccount = email;
        currentToken = tokenData.token;
        
        // Store in localStorage
        const startTime = Date.now();
        localStorage.setItem(TIMER_KEY, startTime.toString());
        localStorage.setItem(EMAIL_KEY, email);
        localStorage.setItem(TOKEN_KEY, tokenData.token);
        
        console.log("💾 Data stored in localStorage");
        
        // Update UI
        generatedEmail.textContent = email;
        timeLeft = 600;
        
        // Start timer and fetch inbox
        startTimer();
        await fetchInbox();
        
        showNotification("✅ Temporary email created successfully!");
        
    } catch (error) {
        console.error("❌ Error creating account:", error);
        showNotification(`❌ Failed to create temporary email: ${error.message}`);
        
        // Reset button state on error
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-plus"></i> Generate New Address';
    }
}

// ⏱️ Start expiration countdown - FIXED TIMER
function startTimer() {
    console.log("⏰ Starting timer...");
    
    // Clear any existing timer
    if (expirationTimer) {
        clearInterval(expirationTimer);
    }

    const storedTime = localStorage.getItem(TIMER_KEY);
    const startTime = storedTime ? parseInt(storedTime, 10) : Date.now();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    timeLeft = Math.max(600 - elapsed, 0);

    console.log("⏱️ Time left:", timeLeft, "seconds");

    // Update display immediately
    updateTimerDisplay();

    // Start countdown
    expirationTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            handleExpiration();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const min = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const sec = String(timeLeft % 60).padStart(2, "0");
    
    if (timerElement) {
        timerElement.innerHTML = `<i class="fas fa-hourglass-start"></i> Expires in: ${min}:${sec}`;
        
        // Change color when time is running out
        if (timeLeft < 60) {
            timerElement.style.color = "var(--danger)";
        } else if (timeLeft < 180) {
            timerElement.style.color = "var(--warning)";
        } else {
            timerElement.style.color = "var(--secondary)";
        }
    }
}

function handleExpiration() {
    console.log("⏰ Timer expired");
    
    if (expirationTimer) {
        clearInterval(expirationTimer);
    }

    // Reset everything
    emails = [];
    currentAccount = null;
    currentToken = null;
    
    // Update UI
    if (emailList) {
        emailList.innerHTML = `
            <div class="no-emails">
                <i class="fas fa-clock fa-2x"></i>
                <p>Mailbox expired - Generate a new email</p>
            </div>
        `;
    }
    
    if (timerElement) {
        timerElement.innerHTML = `<i class="fas fa-clock"></i> Mailbox expired`;
        timerElement.style.color = "var(--danger)";
    }
    
    if (unreadCount) {
        unreadCount.textContent = "0";
    }
    
    showNotification("⏳ Temporary mailbox expired");

    // Clear storage
    localStorage.removeItem(TIMER_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(TOKEN_KEY);

    // Enable generate button
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.classList.remove("disabled");
        generateBtn.innerHTML = '<i class="fas fa-plus"></i> Generate New Address';
    }
}

// 📬 Fetch inbox messages - FIXED API CALL
async function fetchInbox() {
    if (!currentToken) {
        console.log("❌ No token available for fetching inbox");
        return;
    }
    
    try {
        console.log("📥 Fetching inbox...");
        const res = await fetch("https://api.mail.tm/messages", {
            headers: { 
                Authorization: `Bearer ${currentToken}`,
                "Accept": "application/json"
            },
        });
        
        console.log("📨 Inbox response status:", res.status);
        
        if (!res.ok) {
            throw new Error(`Inbox fetch failed: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("✅ Inbox data received:", data["hydra:member"]?.length || 0, "emails");
        
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
        console.error("❌ Error fetching inbox:", error);
        showNotification("❌ Failed to refresh inbox");
    }
}

// 🧹 Render email list
function renderEmailList() {
    if (!emailList) return;
    
    emailList.innerHTML = "";
    
    if (emails.length === 0) {
        emailList.innerHTML = `
            <div class="no-emails">
                <i class="fas fa-inbox fa-2x"></i>
                <p>No emails yet. Your incoming messages will appear here.</p>
            </div>
        `;
        if (unreadCount) unreadCount.textContent = "0";
        return;
    }

    let unread = 0;
    
    emails.forEach((email) => {
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
    
    if (unreadCount) unreadCount.textContent = unread.toString();

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
                if (email) {
                    showEmailDetail(email);
                }
            }
        });
    });

    // Checkbox handling
    document.querySelectorAll(".email-checkbox-input").forEach((checkbox) => {
        checkbox.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = checkbox.dataset.id;
            
            if (checkbox.checked) {
                if (!selectedEmails.includes(id)) {
                    selectedEmails.push(id);
                }
            } else {
                selectedEmails = selectedEmails.filter((i) => i !== id);
            }
            
            updateDeleteButtonState();
        });
    });
}

function updateDeleteButtonState() {
    if (deleteBtn) {
        if (selectedEmails.length > 0) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Delete (${selectedEmails.length})`;
        } else {
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
        }
    }
}

// 📥 View email detail
async function showEmailDetail(email) {
    try {
        if (!email.content && currentToken) {
            const res = await fetch(`https://api.mail.tm/messages/${email.id}`, {
                headers: { 
                    Authorization: `Bearer ${currentToken}`,
                    "Accept": "application/json"
                },
            });
            
            if (!res.ok) throw new Error("Failed to fetch email content");
            
            const data = await res.json();
            email.content = data.text || data.html || "(No content available)";
        }

        // Hide inbox, show detail
        const inboxContainer = document.querySelector(".inbox-container");
        if (inboxContainer) inboxContainer.style.display = "none";
        if (emailDetail) emailDetail.style.display = "block";
        
        // Populate email detail - FIXED: Use existing HTML structure
        document.getElementById("detail-sender").textContent = email.sender;
        document.getElementById("detail-subject").textContent = email.subject;
        document.getElementById("detail-date").textContent = email.fullDate;
        
        const emailBody = document.querySelector(".email-body");
        if (emailBody) {
            if (email.content.includes("<") && email.content.includes(">")) {
                // HTML content
                emailBody.innerHTML = email.content;
            } else {
                // Plain text content
                emailBody.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${email.content}</pre>`;
            }
        }

        // Mark as read
        if (email.unread) {
            email.unread = false;
            renderEmailList();
        }
        
    } catch (error) {
        console.error("❌ Error showing email detail:", error);
        showNotification("❌ Failed to load email content");
    }
}

// ❌ Delete selected messages
async function deleteSelectedEmails() {
    if (!selectedEmails.length || !currentToken) {
        showNotification("⚠️ No emails selected");
        return;
    }

    try {
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            deleteBtn.disabled = true;
        }

        for (let id of selectedEmails) {
            await fetch(`https://api.mail.tm/messages/${id}`, {
                method: "DELETE",
                headers: { 
                    Authorization: `Bearer ${currentToken}`,
                    "Accept": "application/json"
                },
            });
        }

        selectedEmails = [];
        await fetchInbox();
        showNotification("🗑️ Selected emails deleted");
        
    } catch (error) {
        console.error("❌ Error deleting emails:", error);
        showNotification("❌ Failed to delete emails");
    } finally {
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
            deleteBtn.disabled = true;
        }
    }
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
        
        if (copyBtn) {
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
        }
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = emailText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        
        showNotification("📋 Email copied to clipboard!");
        if (copyBtn) {
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
        }
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

// 🔄 Check email generation limit
function checkEmailLimit() {
    try {
        const history = JSON.parse(localStorage.getItem(LIMIT_KEY) || "[]");
        const now = Date.now();
        
        // Remove entries older than 30 minutes
        const recent = history.filter(t => now - t < LIMIT_WINDOW);
        localStorage.setItem(LIMIT_KEY, JSON.stringify(recent));
        
        return recent.length;
    } catch (error) {
        console.error("Error checking limit:", error);
        return 0;
    }
}

// 🚀 Initialize application - FIXED INITIALIZATION
function initApp() {
    console.log("🚀 Initializing application...");
    
    try {
        const storedStart = localStorage.getItem(TIMER_KEY);
        const storedEmail = localStorage.getItem(EMAIL_KEY);
        const storedToken = localStorage.getItem(TOKEN_KEY);

        if (storedStart && storedEmail && storedToken) {
            // Restore existing session
            const startTime = parseInt(storedStart, 10);
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remainingTime = 600 - elapsed;

            if (remainingTime > 0) {
                // Valid session found
                currentAccount = storedEmail;
                currentToken = storedToken;
                generatedEmail.textContent = storedEmail;
                
                if (generateBtn) {
                    generateBtn.disabled = true;
                    generateBtn.classList.add("disabled");
                    generateBtn.innerHTML = '<i class="fas fa-lock"></i> Locked';
                }
                
                timeLeft = remainingTime;
                startTimer();
                fetchInbox();
                console.log("✅ Restored existing session");
            } else {
                // Session expired
                handleExpiration();
                console.log("❌ Session expired");
            }
        } else {
            // No session found
            console.log("ℹ️ No existing session found");
            if (generatedEmail) {
                generatedEmail.textContent = "Click generate to create email";
            }
        }
    } catch (error) {
        console.error("❌ Error initializing app:", error);
    }
}

// ❓ FAQ functionality
function i
