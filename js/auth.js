/**
 * Authentication Module
 * ======================
 * Handles user authentication using Supabase Auth.
 * 
 * Features:
 * - Email/Password registration
 * - Email/Password login
 * - Logout
 * - Session management
 * - Auth state change listeners
 */

const AuthModule = (function() {
    
    const supabase = window.SupabaseClient.client;

    // DOM Elements (will be initialized when DOM is ready)
    let elements = {};

    /**
     * Initialize the auth module
     */
    function init() {
        // Check if Supabase is configured
        if (!window.SupabaseClient.isConfigured()) {
            showError('Supabase is not configured. Please update supabaseClient.js with your credentials.');
            return;
        }

        // Cache DOM elements
        cacheElements();

        // Set up event listeners
        setupEventListeners();

        // Check for existing session
        checkSession();

        // Listen for auth state changes
        supabase.auth.onAuthStateChange(handleAuthStateChange);
    }

    /**
     * Cache DOM elements for reuse
     */
    function cacheElements() {
        elements = {
            // Forms
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            
            // Inputs
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            registerEmail: document.getElementById('register-email'),
            registerPassword: document.getElementById('register-password'),
            registerConfirmPassword: document.getElementById('register-confirm-password'),
            
            // Buttons
            loginBtn: document.getElementById('login-btn'),
            registerBtn: document.getElementById('register-btn'),
            showRegisterBtn: document.getElementById('show-register'),
            showLoginBtn: document.getElementById('show-login'),
            
            // Containers
            loginContainer: document.getElementById('login-container'),
            registerContainer: document.getElementById('register-container'),
            
            // Messages
            loginError: document.getElementById('login-error'),
            registerError: document.getElementById('register-error'),
            loginSuccess: document.getElementById('login-success'),
            registerSuccess: document.getElementById('register-success')
        };
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Form submissions
        if (elements.loginForm) {
            elements.loginForm.addEventListener('submit', handleLogin);
        }
        
        if (elements.registerForm) {
            elements.registerForm.addEventListener('submit', handleRegister);
        }

        // Toggle between login and register
        if (elements.showRegisterBtn) {
            elements.showRegisterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showRegisterForm();
            });
        }

        if (elements.showLoginBtn) {
            elements.showLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showLoginForm();
            });
        }

        // Password strength indicator for registration
        if (elements.registerPassword) {
            elements.registerPassword.addEventListener('input', updatePasswordStrength);
        }
    }

    /**
     * Check for existing session
     */
    async function checkSession() {
        try {
            const session = await window.SupabaseClient.getCurrentSession();
            
            if (session) {
                // User is logged in, redirect to vault
                redirectToVault();
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    /**
     * Handle auth state changes
     */
    function handleAuthStateChange(event, session) {
        if (event === 'SIGNED_IN' && session) {
            redirectToVault();
        } else if (event === 'SIGNED_OUT') {
            redirectToLogin();
        }
    }

    /**
     * Handle login form submission
     */
    async function handleLogin(e) {
        e.preventDefault();
        
        const email = elements.loginEmail.value.trim();
        const password = elements.loginPassword.value;

        // Validation
        if (!email || !password) {
            showError('Please fill in all fields', 'login');
            return;
        }

        // Show loading state
        setButtonLoading(elements.loginBtn, true);
        clearMessages();

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            showSuccess('Login successful! Redirecting...', 'login');
            
            // Redirect will happen via onAuthStateChange

        } catch (error) {
            console.error('Login error:', error);
            showError(getErrorMessage(error), 'login');
        } finally {
            setButtonLoading(elements.loginBtn, false);
        }
    }

    /**
     * Handle registration form submission
     */
    async function handleRegister(e) {
        e.preventDefault();
        
        const email = elements.registerEmail.value.trim();
        const password = elements.registerPassword.value;
        const confirmPassword = elements.registerConfirmPassword.value;

        // Validation
        if (!email || !password || !confirmPassword) {
            showError('Please fill in all fields', 'register');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match', 'register');
            return;
        }

        if (password.length < 8) {
            showError('Password must be at least 8 characters long', 'register');
            return;
        }

        // Show loading state
        setButtonLoading(elements.registerBtn, true);
        clearMessages();

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) throw error;

            // Check if email confirmation is required
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                showError('An account with this email already exists', 'register');
            } else if (data.session) {
                // Auto-confirmed, redirect to vault
                showSuccess('Registration successful! Redirecting...', 'register');
            } else {
                // Email confirmation required
                showSuccess('Registration successful! Please check your email to confirm your account.', 'register');
                // Clear form
                elements.registerForm.reset();
            }

        } catch (error) {
            console.error('Registration error:', error);
            showError(getErrorMessage(error), 'register');
        } finally {
            setButtonLoading(elements.registerBtn, false);
        }
    }

    /**
     * Logout the current user
     */
    async function logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            // Clear any stored master password
            sessionStorage.removeItem('vaultUnlocked');
            
            redirectToLogin();
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    /**
     * Update password strength indicator
     */
    function updatePasswordStrength() {
        const password = elements.registerPassword.value;
        const strength = window.CryptoModule.calculateStrength(password);
        
        const strengthBar = document.getElementById('password-strength-bar');
        const strengthText = document.getElementById('password-strength-text');
        
        if (strengthBar && strengthText) {
            strengthBar.style.width = strength.score + '%';
            strengthBar.style.backgroundColor = strength.color;
            strengthText.textContent = strength.label;
            strengthText.style.color = strength.color;
        }
    }

    /**
     * Show register form, hide login form
     */
    function showRegisterForm() {
        if (elements.loginContainer) {
            elements.loginContainer.classList.add('hidden');
        }
        if (elements.registerContainer) {
            elements.registerContainer.classList.remove('hidden');
        }
        clearMessages();
    }

    /**
     * Show login form, hide register form
     */
    function showLoginForm() {
        if (elements.registerContainer) {
            elements.registerContainer.classList.add('hidden');
        }
        if (elements.loginContainer) {
            elements.loginContainer.classList.remove('hidden');
        }
        clearMessages();
    }

    /**
     * Show error message
     */
    function showError(message, type = 'login') {
        const errorElement = type === 'login' ? elements.loginError : elements.registerError;
        const successElement = type === 'login' ? elements.loginSuccess : elements.registerSuccess;
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
        if (successElement) {
            successElement.classList.add('hidden');
        }
    }

    /**
     * Show success message
     */
    function showSuccess(message, type = 'login') {
        const successElement = type === 'login' ? elements.loginSuccess : elements.registerSuccess;
        const errorElement = type === 'login' ? elements.loginError : elements.registerError;
        
        if (successElement) {
            successElement.textContent = message;
            successElement.classList.remove('hidden');
        }
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    /**
     * Clear all messages
     */
    function clearMessages() {
        [elements.loginError, elements.registerError, 
         elements.loginSuccess, elements.registerSuccess].forEach(el => {
            if (el) el.classList.add('hidden');
        });
    }

    /**
     * Set button loading state
     */
    function setButtonLoading(button, loading) {
        if (!button) return;
        
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="spinner"></span> Loading...';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }

    /**
     * Get user-friendly error message
     */
    function getErrorMessage(error) {
        const errorMessages = {
            'Invalid login credentials': 'Invalid email or password',
            'Email not confirmed': 'Please confirm your email before logging in',
            'User already registered': 'An account with this email already exists',
            'Password should be at least 6 characters': 'Password must be at least 6 characters',
            'Unable to validate email address: invalid format': 'Please enter a valid email address'
        };

        return errorMessages[error.message] || error.message || 'An error occurred. Please try again.';
    }

    /**
     * Redirect to vault page
     */
    function redirectToVault() {
        window.location.href = 'vault.html';
    }

    /**
     * Redirect to login page
     */
    function redirectToLogin() {
        window.location.href = 'index.html';
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        logout,
        checkSession,
        getCurrentUser: window.SupabaseClient.getCurrentUser
    };

})();

// Export for use in other modules
window.AuthModule = AuthModule;
