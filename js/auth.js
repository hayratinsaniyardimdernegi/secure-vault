/**
 * Authentication Module
 * ======================
 * Handles Supabase authentication: login, register, logout, and session management
 */

const AuthModule = (function () {
    const supabase = window.SupabaseClient.client;
    let elements = {};

    function init() {
        if (!window.SupabaseClient.isConfigured()) {
            console.error("Supabase is not configured.");
            alert("Supabase is not configured. Please check js/supabaseClient.js");
            return;
        }

        cacheElements();
        setupEventListeners();
        checkSession();

        supabase.auth.onAuthStateChange(handleAuthStateChange);
    }

    function cacheElements() {
        elements = {
            // Forms
            loginForm: document.getElementById("login-form"),
            registerForm: document.getElementById("register-form"),

            // Inputs
            loginEmail: document.getElementById("login-email"),
            loginPassword: document.getElementById("login-password"),
            registerEmail: document.getElementById("register-email"),
            registerPassword: document.getElementById("register-password"),
            registerConfirmPassword: document.getElementById("register-confirm-password"),

            // Buttons
            loginBtn: document.getElementById("login-btn"),
            registerBtn: document.getElementById("register-btn"),
            showRegisterBtn: document.getElementById("show-register"),
            showLoginBtn: document.getElementById("show-login"),

            // Containers
            loginContainer: document.getElementById("login-container"),
            registerContainer: document.getElementById("register-container"),

            // Messages
            loginError: document.getElementById("login-error"),
            loginSuccess: document.getElementById("login-success"),
            registerError: document.getElementById("register-error"),
            registerSuccess: document.getElementById("register-success"),

            // Password strength
            passwordStrengthBar: document.getElementById("password-strength-bar"),
            passwordStrengthText: document.getElementById("password-strength-text"),
        };
    }

    function setupEventListeners() {
        if (elements.loginForm) {
            elements.loginForm.addEventListener("submit", handleLogin);
        }

        if (elements.registerForm) {
            elements.registerForm.addEventListener("submit", handleRegister);
        }

        if (elements.showRegisterBtn) {
            elements.showRegisterBtn.addEventListener("click", (e) => {
                e.preventDefault();
                showRegisterForm();
            });
        }

        if (elements.showLoginBtn) {
            elements.showLoginBtn.addEventListener("click", (e) => {
                e.preventDefault();
                showLoginForm();
            });
        }

        if (elements.registerPassword) {
            elements.registerPassword.addEventListener(
                "input",
                updatePasswordStrength
            );
        }
    }

    async function handleLogin(e) {
        e.preventDefault();

        const email = elements.loginEmail.value.trim();
        const password = elements.loginPassword.value;

        if (!email || !password) {
            showError("Please fill in all fields", "login");
            return;
        }

        setButtonLoading(elements.loginBtn, true);
        clearMessages();

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            showSuccess("Login successful! Redirecting...", "login");
            // Redirect handled by auth state change
        } catch (err) {
            console.error("Login error:", err);
            showError(getErrorMessage(err), "login");
        } finally {
            setButtonLoading(elements.loginBtn, false);
        }
    }

    async function handleRegister(e) {
        e.preventDefault();

        const email = elements.registerEmail.value.trim();
        const password = elements.registerPassword.value;
        const confirmPassword = elements.registerConfirmPassword.value;

        if (!email || !password || !confirmPassword) {
            showError("Please fill in all fields", "register");
            return;
        }

        if (password !== confirmPassword) {
            showError("Passwords do not match", "register");
            return;
        }

        if (password.length < 8) {
            showError("Password must be at least 8 characters long", "register");
            return;
        }

        setButtonLoading(elements.registerBtn, true);
        clearMessages();

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) throw error;

            if (data.session) {
                showSuccess(
                    "Account created successfully! Redirecting...",
                    "register"
                );
            } else {
                showSuccess(
                    "Account created! Please check your email to confirm your account.",
                    "register"
                );
                elements.registerForm.reset();
                updatePasswordStrength();
            }
        } catch (err) {
            console.error("Register error:", err);
            showError(getErrorMessage(err), "register");
        } finally {
            setButtonLoading(elements.registerBtn, false);
        }
    }

    async function logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            sessionStorage.removeItem("vaultUnlocked");
            redirectToLogin();
        } catch (err) {
            console.error("Logout error:", err);
            alert("Logout failed. Please try again.");
        }
    }

    async function checkSession() {
        try {
            const session = await window.SupabaseClient.getCurrentSession();
            if (session) {
                redirectToVault();
            }
        } catch (err) {
            console.error("Session check error:", err);
        }
    }

    function handleAuthStateChange(event, session) {
        if (event === "SIGNED_IN" && session) {
            redirectToVault();
        } else if (event === "SIGNED_OUT") {
            redirectToLogin();
        }
    }

    function redirectToVault() {
        const path = window.location.pathname;

        if (path.endsWith("vault.html") || path.endsWith("/vault")) {
            return;
        }

        window.location.href = "vault.html";
    }

    function redirectToLogin() {
        const path = window.location.pathname;

        if (
            path.endsWith("index.html") ||
            path === "/" ||
            path === "" ||
            path.endsWith("/index")
        ) {
            return;
        }

        window.location.href = "index.html";
    }

    function showLoginForm() {
        if (elements.loginContainer && elements.registerContainer) {
            elements.loginContainer.classList.remove("hidden");
            elements.registerContainer.classList.add("hidden");
            clearMessages();
        }
    }

    function showRegisterForm() {
        if (elements.loginContainer && elements.registerContainer) {
            elements.loginContainer.classList.add("hidden");
            elements.registerContainer.classList.remove("hidden");
            clearMessages();
        }
    }

    function showError(message, type = "login") {
        const errorEl =
            type === "login" ? elements.loginError : elements.registerError;
        const successEl =
            type === "login"
                ? elements.loginSuccess
                : elements.registerSuccess;

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove("hidden");
        }
        if (successEl) {
            successEl.classList.add("hidden");
        }
    }

    function showSuccess(message, type = "login") {
        const errorEl =
            type === "login" ? elements.loginError : elements.registerError;
        const successEl =
            type === "login"
                ? elements.loginSuccess
                : elements.registerSuccess;

        if (successEl) {
            successEl.textContent = message;
            successEl.classList.remove("hidden");
        }
        if (errorEl) {
            errorEl.classList.add("hidden");
        }
    }

    function clearMessages() {
        [
            elements.loginError,
            elements.registerError,
            elements.loginSuccess,
            elements.registerSuccess,
        ].forEach((el) => {
            if (el) {
                el.textContent = "";
                el.classList.add("hidden");
            }
        });
    }

    function setButtonLoading(button, isLoading) {
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="spinner"></span> Please wait...';
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    function updatePasswordStrength() {
        const password = elements.registerPassword
            ? elements.registerPassword.value
            : "";
        const bar = elements.passwordStrengthBar;
        const text = elements.passwordStrengthText;

        if (!bar || !text) return;

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        const strengthLevels = {
            0: { width: "0%", label: "", color: "" },
            1: { width: "25%", label: "Weak", color: "var(--color-error)" },
            2: { width: "50%", label: "Fair", color: "var(--color-warning)" },
            3: { width: "75%", label: "Strong", color: "var(--color-info)" },
            4: { width: "100%", label: "Very Strong", color: "var(--color-success)" }
        };

        const level = strengthLevels[strength];
        bar.style.width = level.width;
        bar.style.background = level.color;
        text.textContent = level.label;
        text.style.color = level.color;
    }

    function getErrorMessage(error) {
        if (!error) return "An unknown error occurred";

        const msg = error.message || String(error);

        if (msg.toLowerCase().includes("invalid login credentials")) {
            return "Invalid email or password";
        }
        if (msg.toLowerCase().includes("email not confirmed")) {
            return "Please confirm your email address before logging in";
        }
        if (msg.toLowerCase().includes("user already registered")) {
            return "An account with this email already exists";
        }

        return msg;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    return {
        logout,
        checkSession,
        getCurrentUser: window.SupabaseClient.getCurrentUser,
    };
})();

window.AuthModule = AuthModule;
