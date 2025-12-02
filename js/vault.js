/**
 * Vault Module
 * =============
 * Handles password vault operations including CRUD operations,
 * master password management, and UI interactions.
 * 
 * Features:
 * - Add, edit, delete passwords
 * - Client-side encryption/decryption
 * - Master password unlock mechanism
 * - Password generator
 * - Search and filter
 * - Copy to clipboard
 */

const VaultModule = (function() {
    
    const supabase = window.SupabaseClient.client;
    const crypto = window.CryptoModule;

    // State
    let masterPassword = null;
    let passwords = [];
    let editingId = null;

    // DOM Elements
    let elements = {};

    /**
     * Initialize the vault module
     */
    async function init() {
        // Check if user is authenticated
        const user = await window.SupabaseClient.getCurrentUser();
        
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Cache DOM elements
        cacheElements();

        // Set up event listeners
        setupEventListeners();

        // Display user email
        displayUserInfo(user);

        // Check if vault is already unlocked (session)
        const unlocked = sessionStorage.getItem('vaultUnlocked');
        if (unlocked) {
            // In production, you'd want a more secure approach
            showVault();
        } else {
            showUnlockModal();
        }
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        elements = {
            // Modals
            unlockModal: document.getElementById('unlock-modal'),
            addModal: document.getElementById('add-modal'),
            deleteModal: document.getElementById('delete-modal'),
            
            // Unlock form
            masterPasswordInput: document.getElementById('master-password'),
            unlockBtn: document.getElementById('unlock-btn'),
            unlockError: document.getElementById('unlock-error'),
            
            // Main vault
            vaultContainer: document.getElementById('vault-container'),
            passwordList: document.getElementById('password-list'),
            emptyState: document.getElementById('empty-state'),
            searchInput: document.getElementById('search-input'),
            
            // Add/Edit form
            addForm: document.getElementById('add-form'),
            modalTitle: document.getElementById('modal-title'),
            siteNameInput: document.getElementById('site-name'),
            siteUrlInput: document.getElementById('site-url'),
            usernameInput: document.getElementById('username'),
            passwordInput: document.getElementById('password'),
            notesInput: document.getElementById('notes'),
            generateBtn: document.getElementById('generate-btn'),
            togglePasswordBtn: document.getElementById('toggle-password'),
            saveBtn: document.getElementById('save-btn'),
            cancelBtn: document.getElementById('cancel-btn'),
            formError: document.getElementById('form-error'),
            
            // Password strength
            strengthBar: document.getElementById('new-password-strength-bar'),
            strengthText: document.getElementById('new-password-strength-text'),
            
            // Delete confirmation
            deleteConfirmBtn: document.getElementById('delete-confirm-btn'),
            deleteCancelBtn: document.getElementById('delete-cancel-btn'),
            
            // Header
            userEmail: document.getElementById('user-email'),
            logoutBtn: document.getElementById('logout-btn'),
            addNewBtn: document.getElementById('add-new-btn'),
            lockBtn: document.getElementById('lock-btn')
        };
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Unlock form
        if (elements.unlockBtn) {
            elements.unlockBtn.addEventListener('click', handleUnlock);
        }
        if (elements.masterPasswordInput) {
            elements.masterPasswordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleUnlock();
            });
        }

        // Add/Edit form
        if (elements.addForm) {
            elements.addForm.addEventListener('submit', handleSave);
        }
        if (elements.cancelBtn) {
            elements.cancelBtn.addEventListener('click', closeAddModal);
        }
        if (elements.generateBtn) {
            elements.generateBtn.addEventListener('click', generatePassword);
        }
        if (elements.togglePasswordBtn) {
            elements.togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
        }
        if (elements.passwordInput) {
            elements.passwordInput.addEventListener('input', updateNewPasswordStrength);
        }

        // Delete confirmation
        if (elements.deleteConfirmBtn) {
            elements.deleteConfirmBtn.addEventListener('click', confirmDelete);
        }
        if (elements.deleteCancelBtn) {
            elements.deleteCancelBtn.addEventListener('click', closeDeleteModal);
        }

        // Header actions
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', handleLogout);
        }
        if (elements.addNewBtn) {
            elements.addNewBtn.addEventListener('click', () => openAddModal());
        }
        if (elements.lockBtn) {
            elements.lockBtn.addEventListener('click', lockVault);
        }

        // Search
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearch);
        }

        // Close modals on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    backdrop.classList.add('hidden');
                }
            });
        });
    }

    /**
     * Display user info in header
     */
    function displayUserInfo(user) {
        if (elements.userEmail) {
            elements.userEmail.textContent = user.email;
        }
    }

    /**
     * Handle vault unlock
     */
    async function handleUnlock() {
        const password = elements.masterPasswordInput.value;

        if (!password) {
            showUnlockError('Please enter your master password');
            return;
        }

        if (password.length < 8) {
            showUnlockError('Master password must be at least 8 characters');
            return;
        }

        setButtonLoading(elements.unlockBtn, true);

        try {
            // Store master password in memory (never sent to server)
            masterPassword = password;

            // Mark vault as unlocked in session
            sessionStorage.setItem('vaultUnlocked', 'true');

            // Load passwords
            await loadPasswords();

            // Hide unlock modal, show vault
            hideUnlockModal();
            showVault();

        } catch (error) {
            console.error('Unlock error:', error);
            showUnlockError('Failed to unlock vault. Please try again.');
            masterPassword = null;
        } finally {
            setButtonLoading(elements.unlockBtn, false);
        }
    }

    /**
     * Load passwords from Supabase
     */
    async function loadPasswords() {
        try {
            const { data, error } = await supabase
                .from('passwords')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            passwords = data || [];
            renderPasswords();

        } catch (error) {
            console.error('Load passwords error:', error);
            showToast('Failed to load passwords', 'error');
        }
    }

    /**
     * Render passwords list
     */
    function renderPasswords(filteredPasswords = null) {
        const list = filteredPasswords || passwords;

        if (list.length === 0) {
            elements.passwordList.classList.add('hidden');
            elements.emptyState.classList.remove('hidden');
            return;
        }

        elements.emptyState.classList.add('hidden');
        elements.passwordList.classList.remove('hidden');

        elements.passwordList.innerHTML = list.map(item => `
            <div class="password-card" data-id="${item.id}">
                <div class="password-card-header">
                    <div class="password-card-icon">
                        ${getInitial(item.site_name)}
                    </div>
                    <div class="password-card-info">
                        <h3 class="password-card-title">${escapeHtml(item.site_name)}</h3>
                        <p class="password-card-username">${escapeHtml(item.username)}</p>
                        ${item.site_url ? `<a href="${escapeHtml(item.site_url)}" target="_blank" class="password-card-url">${escapeHtml(item.site_url)}</a>` : ''}
                    </div>
                </div>
                <div class="password-card-actions">
                    <button class="btn-icon" onclick="VaultModule.copyPassword('${item.id}')" title="Copy password">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="VaultModule.copyUsername('${item.id}')" title="Copy username">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="VaultModule.showPassword('${item.id}')" title="Show password">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="VaultModule.editPassword('${item.id}')" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-danger" onclick="VaultModule.deletePassword('${item.id}')" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Handle save (add/edit)
     */
    async function handleSave(e) {
        e.preventDefault();

        const siteName = elements.siteNameInput.value.trim();
        const siteUrl = elements.siteUrlInput.value.trim();
        const username = elements.usernameInput.value.trim();
        const password = elements.passwordInput.value;
        const notes = elements.notesInput.value.trim();

        // Validation
        if (!siteName || !username || !password) {
            showFormError('Please fill in all required fields');
            return;
        }

        setButtonLoading(elements.saveBtn, true);

        try {
            // Encrypt the password
            const encrypted = await crypto.encrypt(password, masterPassword);

            const user = await window.SupabaseClient.getCurrentUser();

            const passwordData = {
                user_id: user.id,
                site_name: siteName,
                site_url: siteUrl || null,
                username: username,
                encrypted_password: encrypted.encrypted,
                iv: encrypted.iv + ':' + encrypted.salt, // Store IV and salt together
                notes: notes || null,
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                // Update existing
                const { error } = await supabase
                    .from('passwords')
                    .update(passwordData)
                    .eq('id', editingId);

                if (error) throw error;
                showToast('Password updated successfully');
            } else {
                // Insert new
                const { error } = await supabase
                    .from('passwords')
                    .insert([passwordData]);

                if (error) throw error;
                showToast('Password added successfully');
            }

            // Reload passwords and close modal
            await loadPasswords();
            closeAddModal();

        } catch (error) {
            console.error('Save error:', error);
            showFormError('Failed to save password. Please try again.');
        } finally {
            setButtonLoading(elements.saveBtn, false);
        }
    }

    /**
     * Open add/edit modal
     */
    function openAddModal(passwordId = null) {
        editingId = passwordId;

        if (passwordId) {
            // Edit mode
            const item = passwords.find(p => p.id === passwordId);
            if (item) {
                elements.modalTitle.textContent = 'Edit Password';
                elements.siteNameInput.value = item.site_name;
                elements.siteUrlInput.value = item.site_url || '';
                elements.usernameInput.value = item.username;
                elements.passwordInput.value = ''; // Don't pre-fill password
                elements.passwordInput.placeholder = 'Enter new password or leave empty to keep current';
                elements.notesInput.value = item.notes || '';
            }
        } else {
            // Add mode
            elements.modalTitle.textContent = 'Add New Password';
            elements.addForm.reset();
            elements.passwordInput.placeholder = 'Enter password';
        }

        clearFormError();
        elements.addModal.classList.remove('hidden');
        elements.siteNameInput.focus();
    }

    /**
     * Close add modal
     */
    function closeAddModal() {
        elements.addModal.classList.add('hidden');
        elements.addForm.reset();
        editingId = null;
        clearFormError();
        resetPasswordStrength();
    }

    /**
     * Copy password to clipboard
     */
    async function copyPassword(id) {
        const item = passwords.find(p => p.id === id);
        if (!item) return;

        try {
            const [iv, salt] = item.iv.split(':');
            const decrypted = await crypto.decrypt(
                item.encrypted_password,
                iv,
                salt,
                masterPassword
            );

            await navigator.clipboard.writeText(decrypted);
            showToast('Password copied to clipboard');

            // Clear clipboard after 30 seconds
            setTimeout(async () => {
                try {
                    const currentClipboard = await navigator.clipboard.readText();
                    if (currentClipboard === decrypted) {
                        await navigator.clipboard.writeText('');
                    }
                } catch (e) {
                    // Clipboard access denied, ignore
                }
            }, 30000);

        } catch (error) {
            console.error('Decrypt error:', error);
            showToast('Failed to decrypt password. Check your master password.', 'error');
        }
    }

    /**
     * Copy username to clipboard
     */
    async function copyUsername(id) {
        const item = passwords.find(p => p.id === id);
        if (!item) return;

        try {
            await navigator.clipboard.writeText(item.username);
            showToast('Username copied to clipboard');
        } catch (error) {
            showToast('Failed to copy username', 'error');
        }
    }

    /**
     * Show password in an alert (temporary reveal)
     */
    async function showPasswordAction(id) {
        const item = passwords.find(p => p.id === id);
        if (!item) return;

        try {
            const [iv, salt] = item.iv.split(':');
            const decrypted = await crypto.decrypt(
                item.encrypted_password,
                iv,
                salt,
                masterPassword
            );

            // Show password in a temporary toast
            showToast(`Password: ${decrypted}`, 'info', 5000);

        } catch (error) {
            console.error('Decrypt error:', error);
            showToast('Failed to decrypt password', 'error');
        }
    }

    /**
     * Edit password
     */
    function editPasswordAction(id) {
        openAddModal(id);
    }

    /**
     * Delete password (show confirmation)
     */
    let deleteTargetId = null;
    function deletePasswordAction(id) {
        deleteTargetId = id;
        elements.deleteModal.classList.remove('hidden');
    }

    /**
     * Confirm delete
     */
    async function confirmDelete() {
        if (!deleteTargetId) return;

        setButtonLoading(elements.deleteConfirmBtn, true);

        try {
            const { error } = await supabase
                .from('passwords')
                .delete()
                .eq('id', deleteTargetId);

            if (error) throw error;

            showToast('Password deleted');
            await loadPasswords();
            closeDeleteModal();

        } catch (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete password', 'error');
        } finally {
            setButtonLoading(elements.deleteConfirmBtn, false);
        }
    }

    /**
     * Close delete modal
     */
    function closeDeleteModal() {
        elements.deleteModal.classList.add('hidden');
        deleteTargetId = null;
    }

    /**
     * Generate a random password
     */
    function generatePassword() {
        const password = crypto.generatePassword(20, {
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true
        });

        elements.passwordInput.value = password;
        elements.passwordInput.type = 'text';
        updateNewPasswordStrength();

        // Show the password briefly then hide
        setTimeout(() => {
            elements.passwordInput.type = 'password';
        }, 3000);
    }

    /**
     * Toggle password visibility
     */
    function togglePasswordVisibility() {
        const type = elements.passwordInput.type === 'password' ? 'text' : 'password';
        elements.passwordInput.type = type;

        // Update icon
        elements.togglePasswordBtn.innerHTML = type === 'password' 
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    }

    /**
     * Update password strength indicator
     */
    function updateNewPasswordStrength() {
        const password = elements.passwordInput.value;
        const strength = crypto.calculateStrength(password);

        if (elements.strengthBar) {
            elements.strengthBar.style.width = strength.score + '%';
            elements.strengthBar.style.backgroundColor = strength.color;
        }
        if (elements.strengthText) {
            elements.strengthText.textContent = strength.label;
            elements.strengthText.style.color = strength.color;
        }
    }

    /**
     * Reset password strength indicator
     */
    function resetPasswordStrength() {
        if (elements.strengthBar) {
            elements.strengthBar.style.width = '0%';
        }
        if (elements.strengthText) {
            elements.strengthText.textContent = '';
        }
    }

    /**
     * Handle search
     */
    function handleSearch() {
        const query = elements.searchInput.value.toLowerCase().trim();

        if (!query) {
            renderPasswords();
            return;
        }

        const filtered = passwords.filter(item => 
            item.site_name.toLowerCase().includes(query) ||
            item.username.toLowerCase().includes(query) ||
            (item.site_url && item.site_url.toLowerCase().includes(query))
        );

        renderPasswords(filtered);
    }

    /**
     * Lock vault
     */
    function lockVault() {
        masterPassword = null;
        passwords = [];
        sessionStorage.removeItem('vaultUnlocked');
        
        hideVault();
        showUnlockModal();
        
        if (elements.masterPasswordInput) {
            elements.masterPasswordInput.value = '';
        }
        if (elements.passwordList) {
            elements.passwordList.innerHTML = '';
        }
    }

    /**
     * Handle logout
     */
    async function handleLogout() {
        lockVault();
        await window.AuthModule.logout();
    }

    // UI Helper functions
    function showUnlockModal() {
        if (elements.unlockModal) {
            elements.unlockModal.classList.remove('hidden');
            elements.masterPasswordInput?.focus();
        }
    }

    function hideUnlockModal() {
        if (elements.unlockModal) {
            elements.unlockModal.classList.add('hidden');
        }
    }

    function showVault() {
        if (elements.vaultContainer) {
            elements.vaultContainer.classList.remove('hidden');
        }
    }

    function hideVault() {
        if (elements.vaultContainer) {
            elements.vaultContainer.classList.add('hidden');
        }
    }

    function showUnlockError(message) {
        if (elements.unlockError) {
            elements.unlockError.textContent = message;
            elements.unlockError.classList.remove('hidden');
        }
    }

    function showFormError(message) {
        if (elements.formError) {
            elements.formError.textContent = message;
            elements.formError.classList.remove('hidden');
        }
    }

    function clearFormError() {
        if (elements.formError) {
            elements.formError.classList.add('hidden');
        }
    }

    function setButtonLoading(button, loading) {
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.innerHTML = '<span class="spinner"></span>';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || button.textContent;
        }
    }

    function showToast(message, type = 'success', duration = 3000) {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function getInitial(name) {
        return name.charAt(0).toUpperCase();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        copyPassword,
        copyUsername,
        showPassword: showPasswordAction,
        editPassword: editPasswordAction,
        deletePassword: deletePasswordAction
    };

})();

// Export for use in other modules
window.VaultModule = VaultModule;
