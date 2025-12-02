/**
 * Vault Module
 * =============
 * Multi-vault password manager with client-side encryption
 */

const VaultModule = (function () {
    const supabase = window.SupabaseClient.client;
    const crypto = window.CryptoModule;

    let elements = {};
    let user = null;

    let vaults = [];
    let currentVaultId = null;
    let currentVaultName = '';
    let masterPassword = null;

    let passwords = [];
    let editTargetId = null;
    let deleteTargetId = null;

    /**
     * INITIALIZATION
     */
    async function init() {
        if (!window.SupabaseClient.isConfigured()) {
            alert("Supabase is not configured. Please check js/supabaseClient.js");
            return;
        }

        user = await window.SupabaseClient.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        cacheElements();
        setupEventListeners();

        if (elements.userEmail) {
            elements.userEmail.textContent = user.email;
        }
        if (elements.userAvatar) {
            elements.userAvatar.textContent = user.email.charAt(0).toUpperCase();
        }

        await loadVaults();
        showVaultSelectionModal();
    }

    /**
     * Cache DOM elements for performance
     */
    function cacheElements() {
        elements = {
            // Modals
            vaultSelectionModal: document.getElementById('vault-selection-modal'),
            createVaultModal: document.getElementById('create-vault-modal'),
            unlockModal: document.getElementById('unlock-modal'),
            addModal: document.getElementById('add-modal'),
            deleteModal: document.getElementById('delete-modal'),

            // Vault selection
            vaultList: document.getElementById('vault-list'),
            openExistingVaultBtn: document.getElementById('open-existing-vault-btn'),
            createNewVaultBtn: document.getElementById('create-new-vault-btn'),

            // Create vault
            newVaultName: document.getElementById('new-vault-name'),
            newVaultMasterPassword: document.getElementById('new-vault-master-password'),
            newVaultConfirmPassword: document.getElementById('new-vault-confirm-password'),
            confirmCreateVaultBtn: document.getElementById('confirm-create-vault-btn'),
            cancelCreateVaultBtn: document.getElementById('cancel-create-vault-btn'),
            createVaultError: document.getElementById('create-vault-error'),
            newVaultPasswordStrengthBar: document.getElementById('new-vault-password-strength-bar'),
            newVaultPasswordStrengthText: document.getElementById('new-vault-password-strength-text'),

            // Unlock
            masterPasswordInput: document.getElementById('master-password'),
            unlockBtn: document.getElementById('unlock-btn'),
            unlockError: document.getElementById('unlock-error'),
            unlockVaultName: document.getElementById('unlock-vault-name'),
            backToVaultSelectionBtn: document.getElementById('back-to-vault-selection-btn'),

            // Vault main
            vaultContainer: document.getElementById('vault-container'),
            currentVaultName: document.getElementById('current-vault-name'),
            currentVaultSubtitle: document.getElementById('current-vault-subtitle'),
            passwordList: document.getElementById('password-list'),
            emptyState: document.getElementById('empty-state'),

            // Header buttons
            logoutBtn: document.getElementById('logout-btn'),
            lockBtn: document.getElementById('lock-btn'),
            addNewBtn: document.getElementById('add-new-btn'),
            userEmail: document.getElementById('user-email'),
            userAvatar: document.getElementById('user-avatar'),

            // Add/Edit form
            addModalTitle: document.getElementById('add-modal-title'),
            addError: document.getElementById('add-error'),
            siteNameInput: document.getElementById('site-name'),
            siteUrlInput: document.getElementById('site-url'),
            usernameInput: document.getElementById('username'),
            passwordInput: document.getElementById('password'),
            notesInput: document.getElementById('notes'),
            generatePasswordBtn: document.getElementById('generate-password-btn'),
            savePasswordBtn: document.getElementById('save-password-btn'),
            cancelAddBtn: document.getElementById('cancel-add-btn'),

            // Delete
            confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
            cancelDeleteBtn: document.getElementById('cancel-delete-btn'),

            // Search
            searchInput: document.getElementById('search-input'),

            // Toast
            toast: document.getElementById('toast')
        };
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Vault selection
        if (elements.createNewVaultBtn) {
            elements.createNewVaultBtn.addEventListener('click', showCreateVaultModal);
        }
        if (elements.openExistingVaultBtn) {
            elements.openExistingVaultBtn.addEventListener('click', handleOpenExistingVaultClick);
        }

        // Vault list click (selection)
        if (elements.vaultList) {
            elements.vaultList.addEventListener('click', handleVaultListClick);
        }

        // Create vault modal
        if (elements.confirmCreateVaultBtn) {
            elements.confirmCreateVaultBtn.addEventListener('click', handleCreateVault);
        }
        if (elements.cancelCreateVaultBtn) {
            elements.cancelCreateVaultBtn.addEventListener('click', hideCreateVaultModal);
        }
        if (elements.newVaultMasterPassword) {
            elements.newVaultMasterPassword.addEventListener('input', updateNewVaultPasswordStrength);
        }

        // Unlock
        if (elements.unlockBtn) {
            elements.unlockBtn.addEventListener('click', handleUnlock);
        }
        if (elements.masterPasswordInput) {
            elements.masterPasswordInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleUnlock();
                }
            });
        }
        if (elements.backToVaultSelectionBtn) {
            elements.backToVaultSelectionBtn.addEventListener('click', () => {
                closeUnlockModal();
                showVaultSelectionModal();
            });
        }

        // Add / Edit
        if (elements.addNewBtn) {
            elements.addNewBtn.addEventListener('click', () => openAddModal());
        }
        if (elements.generatePasswordBtn) {
            elements.generatePasswordBtn.addEventListener('click', handleGeneratePassword);
        }
        if (elements.savePasswordBtn) {
            elements.savePasswordBtn.addEventListener('click', handleSavePassword);
        }
        if (elements.cancelAddBtn) {
            elements.cancelAddBtn.addEventListener('click', closeAddModal);
        }

        // Delete
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
        }
        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }

        // Search
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearch);
        }

        // Lock & Logout
        if (elements.lockBtn) {
            elements.lockBtn.addEventListener('click', handleLock);
        }
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', handleLogout);
        }

        // Modal backdrop click to close
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    if (backdrop === elements.addModal) closeAddModal();
                    if (backdrop === elements.deleteModal) closeDeleteModal();
                    if (backdrop === elements.createVaultModal) hideCreateVaultModal();
                    // Don't close vault selection or unlock on backdrop click
                }
            });
        });
    }

    /** ----------------------------------
     *  VAULT OPERATIONS
     *  ---------------------------------- */

    async function loadVaults() {
        try {
            const { data, error } = await supabase
                .from('vaults')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;

            vaults = data || [];
            renderVaultList();
        } catch (error) {
            console.error('Load vaults error:', error);
            showToast('Failed to load vaults', 'error');
        }
    }

    function renderVaultList() {
        if (!elements.vaultList) return;

        elements.vaultList.innerHTML = '';

        if (!vaults.length) {
            const info = document.createElement('div');
            info.className = 'vault-list-empty';
            info.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <p>No vaults yet. Create your first vault to get started.</p>
            `;
            elements.vaultList.appendChild(info);
            return;
        }

        vaults.forEach(vault => {
            const item = document.createElement('div');
            item.className = 'vault-list-item';
            item.dataset.id = vault.id;

            const icon = document.createElement('div');
            icon.className = 'vault-list-icon';
            icon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
            `;

            const content = document.createElement('div');
            content.className = 'vault-list-content';

            const title = document.createElement('div');
            title.className = 'vault-list-title';
            title.textContent = vault.name;

            const subtitle = document.createElement('div');
            subtitle.className = 'vault-list-subtitle';
            const date = new Date(vault.created_at);
            subtitle.textContent = `Created ${date.toLocaleDateString()}`;

            content.appendChild(title);
            content.appendChild(subtitle);

            const check = document.createElement('div');
            check.className = 'vault-list-check';
            check.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
            `;

            item.appendChild(icon);
            item.appendChild(content);
            item.appendChild(check);

            if (vault.id === currentVaultId) {
                item.classList.add('active');
            }

            elements.vaultList.appendChild(item);
        });
    }

    function showVaultSelectionModal() {
        if (elements.vaultSelectionModal) {
            elements.vaultSelectionModal.classList.remove('hidden');
        }
        if (elements.vaultContainer) {
            elements.vaultContainer.classList.add('hidden');
        }
        masterPassword = null;
        passwords = [];
    }

    function hideVaultSelectionModal() {
        if (elements.vaultSelectionModal) {
            elements.vaultSelectionModal.classList.add('hidden');
        }
    }

    function showCreateVaultModal() {
        hideVaultSelectionModal();
        if (elements.createVaultModal) {
            elements.createVaultModal.classList.remove('hidden');
        }
        if (elements.newVaultName) {
            elements.newVaultName.value = '';
        }
        if (elements.newVaultMasterPassword) {
            elements.newVaultMasterPassword.value = '';
        }
        if (elements.newVaultConfirmPassword) {
            elements.newVaultConfirmPassword.value = '';
        }
        if (elements.createVaultError) {
            elements.createVaultError.classList.add('hidden');
        }
        updateNewVaultPasswordStrength();
    }

    function hideCreateVaultModal() {
        if (elements.createVaultModal) {
            elements.createVaultModal.classList.add('hidden');
        }
        showVaultSelectionModal();
    }

    function handleVaultListClick(e) {
        const item = e.target.closest('.vault-list-item');
        if (!item) return;

        const id = item.dataset.id;
        const vault = vaults.find(v => v.id === id);
        if (!vault) return;

        currentVaultId = vault.id;
        currentVaultName = vault.name;

        document.querySelectorAll('.vault-list-item').forEach(el => {
            el.classList.remove('active');
        });
        item.classList.add('active');
    }

    async function handleCreateVault() {
        const name = elements.newVaultName ? elements.newVaultName.value.trim() : '';
        const password = elements.newVaultMasterPassword ? elements.newVaultMasterPassword.value : '';
        const confirmPassword = elements.newVaultConfirmPassword ? elements.newVaultConfirmPassword.value : '';

        if (!name) {
            showCreateVaultError('Please enter a vault name.');
            return;
        }

        if (!password) {
            showCreateVaultError('Please enter a master password.');
            return;
        }

        if (password.length < 8) {
            showCreateVaultError('Master password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            showCreateVaultError('Passwords do not match.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('vaults')
                .insert({
                    user_id: user.id,
                    name: name
                })
                .select()
                .single();

            if (error) throw error;

            vaults.push(data);
            currentVaultId = data.id;
            currentVaultName = data.name;
            masterPassword = password;

            renderVaultList();
            hideCreateVaultModal();
            hideVaultSelectionModal();
            updateCurrentVaultInfo();

            if (elements.vaultContainer) {
                elements.vaultContainer.classList.remove('hidden');
            }

            await loadPasswords();
            showToast('Vault created successfully!');

        } catch (error) {
            console.error('Create vault error:', error);
            showCreateVaultError('Failed to create vault. Please try again.');
        }
    }

    function showCreateVaultError(message) {
        if (elements.createVaultError) {
            elements.createVaultError.textContent = message;
            elements.createVaultError.classList.remove('hidden');
        }
    }

    function updateNewVaultPasswordStrength() {
        const password = elements.newVaultMasterPassword ? elements.newVaultMasterPassword.value : '';
        const bar = elements.newVaultPasswordStrengthBar;
        const text = elements.newVaultPasswordStrengthText;

        if (!bar || !text) return;

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        const strengthLevels = {
            0: { width: '0%', label: '', color: '' },
            1: { width: '25%', label: 'Weak', color: 'var(--color-error)' },
            2: { width: '50%', label: 'Fair', color: 'var(--color-warning)' },
            3: { width: '75%', label: 'Strong', color: 'var(--color-info)' },
            4: { width: '100%', label: 'Very Strong', color: 'var(--color-success)' }
        };

        const level = strengthLevels[strength];
        bar.style.width = level.width;
        bar.style.background = level.color;
        text.textContent = level.label;
        text.style.color = level.color;
    }

    function handleOpenExistingVaultClick() {
        if (!vaults.length) {
            showToast('Please create a vault first.', 'error');
            return;
        }
        if (!currentVaultId) {
            showToast('Please select a vault from the list.', 'error');
            return;
        }

        const vault = vaults.find(v => v.id === currentVaultId);
        if (vault) {
            currentVaultName = vault.name;
        }

        hideVaultSelectionModal();
        updateCurrentVaultInfo();
        showUnlockModal();
    }

    function updateCurrentVaultInfo() {
        if (elements.currentVaultName) {
            elements.currentVaultName.textContent = currentVaultName || 'Vault';
        }
    }

    /** ----------------------------------
     *  UNLOCK (MASTER PASSWORD)
     *  ---------------------------------- */

    function showUnlockModal() {
        if (elements.unlockModal) {
            elements.unlockModal.classList.remove('hidden');
        }
        if (elements.unlockError) {
            elements.unlockError.classList.add('hidden');
            elements.unlockError.textContent = '';
        }
        if (elements.unlockVaultName) {
            elements.unlockVaultName.textContent = `Enter your master password to unlock "${currentVaultName}".`;
        }
        if (elements.masterPasswordInput) {
            elements.masterPasswordInput.value = '';
            elements.masterPasswordInput.focus();
        }
    }

    function closeUnlockModal() {
        if (elements.unlockModal) {
            elements.unlockModal.classList.add('hidden');
        }
    }

    async function handleUnlock() {
        const mp = elements.masterPasswordInput ? elements.masterPasswordInput.value : '';

        if (!mp) {
            showUnlockError('Please enter your master password.');
            return;
        }

        masterPassword = mp;

        try {
            closeUnlockModal();
            if (elements.vaultContainer) {
                elements.vaultContainer.classList.remove('hidden');
            }

            await loadPasswords();
            
            // Validate master password by trying to decrypt first password (if any)
            if (passwords.length > 0) {
                try {
                    const item = passwords[0];
                    const [ivBase64, saltBase64] = (item.iv || '').split(':');
                    await crypto.decrypt(
                        item.encrypted_password,
                        ivBase64,
                        saltBase64,
                        masterPassword
                    );
                } catch (decryptError) {
                    // Wrong master password
                    masterPassword = null;
                    if (elements.vaultContainer) {
                        elements.vaultContainer.classList.add('hidden');
                    }
                    showUnlockModal();
                    showUnlockError('Incorrect master password. Please try again.');
                    return;
                }
            }

            sessionStorage.setItem('vaultUnlocked', '1');
            showToast('Vault unlocked successfully!');
        } catch (error) {
            showUnlockError(error.message || 'Failed to unlock vault');
        }
    }

    function showUnlockError(message) {
        if (elements.unlockError) {
            elements.unlockError.textContent = message;
            elements.unlockError.classList.remove('hidden');
        }
    }

    /** ----------------------------------
     *  PASSWORD CRUD
     *  ---------------------------------- */

    async function loadPasswords() {
        if (!currentVaultId) {
            console.warn('No current vault selected');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('passwords')
                .select('*')
                .eq('vault_id', currentVaultId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            passwords = data || [];
            renderPasswords();
        } catch (error) {
            console.error('Load passwords error:', error);
            showToast('Failed to load passwords', 'error');
        }
    }

    function renderPasswords(filtered = null) {
        if (!elements.passwordList || !elements.emptyState) return;

        const list = filtered || passwords;

        if (!list.length) {
            elements.passwordList.classList.add('hidden');
            elements.emptyState.classList.remove('hidden');
            elements.passwordList.innerHTML = '';
            return;
        }

        elements.emptyState.classList.add('hidden');
        elements.passwordList.classList.remove('hidden');
        elements.passwordList.innerHTML = '';

        list.forEach(item => {
            const card = document.createElement('div');
            card.className = 'password-card';
            card.dataset.id = item.id;

            // Get first letter for icon
            const firstLetter = (item.site_name || 'P').charAt(0).toUpperCase();

            card.innerHTML = `
                <div class="password-card-header">
                    <div class="password-card-icon">${firstLetter}</div>
                    <div class="password-card-info">
                        <div class="password-card-title">${escapeHtml(item.site_name)}</div>
                        <div class="password-card-username">${escapeHtml(item.username)}</div>
                        ${item.site_url ? `<a class="password-card-url" href="${escapeHtml(item.site_url)}" target="_blank" rel="noopener">${escapeHtml(item.site_url)}</a>` : ''}
                    </div>
                </div>
                <div class="password-card-actions">
                    <button class="btn-icon" title="Copy username" data-action="copy-user">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </button>
                    <button class="btn-icon" title="Copy password" data-action="copy-pass">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    <button class="btn-icon" title="Edit" data-action="edit">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-icon-danger" title="Delete" data-action="delete">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            // Add event listeners
            card.querySelector('[data-action="copy-user"]').addEventListener('click', () => copyUsername(item.id));
            card.querySelector('[data-action="copy-pass"]').addEventListener('click', () => showPasswordAction(item.id));
            card.querySelector('[data-action="edit"]').addEventListener('click', () => editPasswordAction(item.id));
            card.querySelector('[data-action="delete"]').addEventListener('click', () => deletePasswordAction(item.id));

            elements.passwordList.appendChild(card);
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function openAddModal(item = null) {
        editTargetId = item ? item.id : null;

        if (elements.addModalTitle) {
            elements.addModalTitle.textContent = editTargetId ? 'Edit Password' : 'Add Password';
        }
        if (elements.addError) {
            elements.addError.classList.add('hidden');
            elements.addError.textContent = '';
        }

        if (item) {
            elements.siteNameInput.value = item.site_name || '';
            elements.siteUrlInput.value = item.site_url || '';
            elements.usernameInput.value = item.username || '';
            elements.notesInput.value = item.notes || '';
            elements.passwordInput.value = '';
            elements.passwordInput.placeholder = 'Leave blank to keep current password';
        } else {
            elements.siteNameInput.value = '';
            elements.siteUrlInput.value = '';
            elements.usernameInput.value = '';
            elements.notesInput.value = '';
            elements.passwordInput.value = '';
            elements.passwordInput.placeholder = '••••••••';
        }

        if (elements.addModal) {
            elements.addModal.classList.remove('hidden');
        }
    }

    function closeAddModal() {
        if (elements.addModal) {
            elements.addModal.classList.add('hidden');
        }
        editTargetId = null;
    }

    async function handleSavePassword() {
        if (!currentVaultId) {
            showAddError('Please select and unlock a vault first.');
            return;
        }

        const siteName = elements.siteNameInput.value.trim();
        const siteUrl = elements.siteUrlInput.value.trim();
        const username = elements.usernameInput.value.trim();
        const plainPassword = elements.passwordInput.value;
        const notes = elements.notesInput.value.trim();

        if (!siteName || !username) {
            showAddError('Site name and username are required.');
            return;
        }

        // For new entries, password is required
        if (!editTargetId && !plainPassword) {
            showAddError('Password is required for new entries.');
            return;
        }

        let encryptedData = null;

        try {
            if (plainPassword) {
                encryptedData = await crypto.encrypt(plainPassword, masterPassword);
            }

            let passwordData = {
                user_id: user.id,
                vault_id: currentVaultId,
                site_name: siteName,
                site_url: siteUrl || null,
                username: username,
                notes: notes || null,
                updated_at: new Date().toISOString()
            };

            if (encryptedData) {
                passwordData.encrypted_password = encryptedData.encrypted;
                passwordData.iv = encryptedData.iv + ':' + encryptedData.salt;
            }

            if (editTargetId) {
                // Update existing
                const { error } = await supabase
                    .from('passwords')
                    .update(passwordData)
                    .eq('id', editTargetId);

                if (error) throw error;
                showToast('Password updated successfully');
            } else {
                // Create new
                passwordData.created_at = new Date().toISOString();

                const { error } = await supabase
                    .from('passwords')
                    .insert([passwordData]);

                if (error) throw error;
                showToast('Password added successfully');
            }

            await loadPasswords();
            closeAddModal();
        } catch (error) {
            console.error('Save password error:', error);
            showAddError(error.message || 'Failed to save password');
        }
    }

    function showAddError(message) {
        if (elements.addError) {
            elements.addError.textContent = message;
            elements.addError.classList.remove('hidden');
        }
    }

    function handleGeneratePassword(e) {
        e.preventDefault();
        const generated = crypto.generatePassword(16);
        elements.passwordInput.value = generated;
        elements.passwordInput.type = 'text';
        setTimeout(() => {
            elements.passwordInput.type = 'password';
        }, 2000);
        showToast('Strong password generated');
    }

    function deletePasswordAction(id) {
        deleteTargetId = id;
        if (elements.deleteModal) {
            elements.deleteModal.classList.remove('hidden');
        }
    }

    function closeDeleteModal() {
        if (elements.deleteModal) {
            elements.deleteModal.classList.add('hidden');
        }
        deleteTargetId = null;
    }

    async function handleConfirmDelete() {
        if (!deleteTargetId) return;

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
            console.error('Delete password error:', error);
            showToast('Failed to delete password', 'error');
        }
    }

    async function showPasswordAction(id) {
        const item = passwords.find(p => p.id === id);
        if (!item) return;

        if (!masterPassword) {
            showToast('Please unlock the vault first.', 'error');
            return;
        }

        try {
            const [ivBase64, saltBase64] = (item.iv || '').split(':');
            const plain = await crypto.decrypt(
                item.encrypted_password,
                ivBase64,
                saltBase64,
                masterPassword
            );
            await copyToClipboard(plain);
            showToast('Password copied to clipboard');
        } catch (error) {
            console.error('Show password error:', error);
            showToast('Failed to decrypt password. Check your master password.', 'error');
        }
    }

    async function copyUsername(id) {
        const item = passwords.find(p => p.id === id);
        if (!item) return;
        await copyToClipboard(item.username);
        showToast('Username copied');
    }

    function editPasswordAction(id) {
        const item = passwords.find(p => p.id === id);
        if (!item) return;
        openAddModal(item);
    }

    /** ----------------------------------
     *  SEARCH
     *  ---------------------------------- */

    function handleSearch() {
        const query = elements.searchInput.value.toLowerCase();
        if (!query) {
            renderPasswords();
            return;
        }

        const filtered = passwords.filter(item => {
            return (
                item.site_name.toLowerCase().includes(query) ||
                (item.username || '').toLowerCase().includes(query) ||
                (item.site_url || '').toLowerCase().includes(query) ||
                (item.notes || '').toLowerCase().includes(query)
            );
        });

        renderPasswords(filtered);
    }

    /** ----------------------------------
     *  LOCK & LOGOUT
     *  ---------------------------------- */

    function handleLock() {
        masterPassword = null;
        passwords = [];
        currentVaultId = null;
        currentVaultName = '';
        if (elements.vaultContainer) {
            elements.vaultContainer.classList.add('hidden');
        }
        showVaultSelectionModal();
    }

    async function handleLogout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            sessionStorage.removeItem('vaultUnlocked');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Failed to sign out', 'error');
        }
    }

    /** ----------------------------------
     *  HELPERS
     *  ---------------------------------- */

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            console.error('Clipboard error:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    function showToast(message, type = 'success') {
        if (!elements.toast) return;

        elements.toast.textContent = message;
        elements.toast.classList.remove('toast-success', 'toast-error');

        if (type === 'error') {
            elements.toast.classList.add('toast-error');
        } else {
            elements.toast.classList.add('toast-success');
        }

        // Trigger animation
        elements.toast.classList.add('show');

        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 3000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        copyUsername,
        showPassword: showPasswordAction,
        editPassword: editPasswordAction,
        deletePassword: deletePasswordAction
    };
})();

window.VaultModule = VaultModule;
