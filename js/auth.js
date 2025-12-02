/**
 * Kimlik Doğrulama Modülü
 * ======================
 * Supabase kimlik doğrulama işlemleri: giriş, kayıt, çıkış ve oturum yönetimi
 */

const AuthModule = (function () {
    const supabase = window.SupabaseClient.client;
    let elements = {};

    function init() {
        if (!window.SupabaseClient.isConfigured()) {
            console.error("Supabase yapılandırılmamış.");
            alert("Supabase yapılandırılmamış. Lütfen js/supabaseClient.js dosyasını kontrol edin");
            return;
        }

        cacheElements();
        setupEventListeners();
        
        // Her zaman giriş ekranından başla - otomatik yönlendirme yok
        // checkSession(); - devre dışı bırakıldı

        supabase.auth.onAuthStateChange(handleAuthStateChange);
    }

    function cacheElements() {
        elements = {
            // Formlar
            loginForm: document.getElementById("login-form"),
            registerForm: document.getElementById("register-form"),

            // Girişler
            loginEmail: document.getElementById("login-email"),
            loginPassword: document.getElementById("login-password"),
            registerEmail: document.getElementById("register-email"),
            registerPassword: document.getElementById("register-password"),
            registerConfirmPassword: document.getElementById("register-confirm-password"),

            // Butonlar
            loginBtn: document.getElementById("login-btn"),
            registerBtn: document.getElementById("register-btn"),
            showRegisterBtn: document.getElementById("show-register"),
            showLoginBtn: document.getElementById("show-login"),

            // Konteynerlar
            loginContainer: document.getElementById("login-container"),
            registerContainer: document.getElementById("register-container"),

            // Mesajlar
            loginError: document.getElementById("login-error"),
            loginSuccess: document.getElementById("login-success"),
            registerError: document.getElementById("register-error"),
            registerSuccess: document.getElementById("register-success"),

            // Şifre gücü
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
            showError("Lütfen tüm alanları doldurun", "login");
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

            showSuccess("Giriş başarılı! Yönlendiriliyorsunuz...", "login");
            // Yönlendirme auth state change tarafından yapılacak
        } catch (err) {
            console.error("Giriş hatası:", err);
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
            showError("Lütfen tüm alanları doldurun", "register");
            return;
        }

        if (password !== confirmPassword) {
            showError("Şifreler eşleşmiyor", "register");
            return;
        }

        if (password.length < 8) {
            showError("Şifre en az 8 karakter olmalıdır", "register");
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
                    "Hesap başarıyla oluşturuldu! Yönlendiriliyorsunuz...",
                    "register"
                );
            } else {
                showSuccess(
                    "Hesap oluşturuldu! Lütfen hesabınızı doğrulamak için e-postanızı kontrol edin.",
                    "register"
                );
                elements.registerForm.reset();
                updatePasswordStrength();
            }
        } catch (err) {
            console.error("Kayıt hatası:", err);
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
            console.error("Çıkış hatası:", err);
            alert("Çıkış başarısız. Lütfen tekrar deneyin.");
        }
    }

    async function checkSession() {
        try {
            const session = await window.SupabaseClient.getCurrentSession();
            if (session) {
                redirectToVault();
            }
        } catch (err) {
            console.error("Oturum kontrol hatası:", err);
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
            button.innerHTML = '<span class="spinner"></span> Lütfen bekleyin...';
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
            1: { width: "25%", label: "Zayıf", color: "var(--color-error)" },
            2: { width: "50%", label: "Orta", color: "var(--color-warning)" },
            3: { width: "75%", label: "Güçlü", color: "var(--color-info)" },
            4: { width: "100%", label: "Çok Güçlü", color: "var(--color-success)" }
        };

        const level = strengthLevels[strength];
        bar.style.width = level.width;
        bar.style.background = level.color;
        text.textContent = level.label;
        text.style.color = level.color;
    }

    function getErrorMessage(error) {
        if (!error) return "Bilinmeyen bir hata oluştu";

        const msg = error.message || String(error);

        if (msg.toLowerCase().includes("invalid login credentials")) {
            return "Geçersiz e-posta veya şifre";
        }
        if (msg.toLowerCase().includes("email not confirmed")) {
            return "Lütfen giriş yapmadan önce e-posta adresinizi doğrulayın";
        }
        if (msg.toLowerCase().includes("user already registered")) {
            return "Bu e-posta adresiyle zaten bir hesap mevcut";
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
