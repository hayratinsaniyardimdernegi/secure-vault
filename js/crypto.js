/**
 * Crypto Module
 * ==============
 * Handles client-side encryption and decryption of passwords using
 * the Web Crypto API with AES-GCM encryption.
 * 
 * Security Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - PBKDF2 key derivation with 100,000 iterations
 * - Random IV for each encryption
 * - Master password never leaves the client
 * - Encrypted data stored in Supabase
 */

const CryptoModule = (function() {
    
    // Encryption parameters
    const ALGORITHM = 'AES-GCM';
    const KEY_LENGTH = 256;
    const IV_LENGTH = 12; // 96 bits for GCM
    const SALT_LENGTH = 16;
    const PBKDF2_ITERATIONS = 100000;

    /**
     * Convert string to ArrayBuffer
     * @param {string} str - String to convert
     * @returns {ArrayBuffer}
     */
    function stringToBuffer(str) {
        return new TextEncoder().encode(str);
    }

    /**
     * Convert ArrayBuffer to string
     * @param {ArrayBuffer} buffer - Buffer to convert
     * @returns {string}
     */
    function bufferToString(buffer) {
        return new TextDecoder().decode(buffer);
    }

    /**
     * Convert ArrayBuffer to Base64 string
     * @param {ArrayBuffer} buffer - Buffer to convert
     * @returns {string}
     */
    function bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     * @param {string} base64 - Base64 string to convert
     * @returns {ArrayBuffer}
     */
    function base64ToBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Generate a random IV (Initialization Vector)
     * @returns {Uint8Array}
     */
    function generateIV() {
        return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    }

    /**
     * Generate a random salt
     * @returns {Uint8Array}
     */
    function generateSalt() {
        return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    }

    /**
     * Derive an encryption key from master password using PBKDF2
     * @param {string} masterPassword - The user's master password
     * @param {Uint8Array} salt - Salt for key derivation
     * @returns {Promise<CryptoKey>}
     */
    async function deriveKey(masterPassword, salt) {
        // Import master password as a key
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            stringToBuffer(masterPassword),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive the actual encryption key
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: ALGORITHM, length: KEY_LENGTH },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt a password
     * @param {string} plaintext - The password to encrypt
     * @param {string} masterPassword - The master password for encryption
     * @returns {Promise<{encrypted: string, iv: string, salt: string}>}
     */
    async function encrypt(plaintext, masterPassword) {
        try {
            const salt = generateSalt();
            const iv = generateIV();
            const key = await deriveKey(masterPassword, salt);

            const encrypted = await crypto.subtle.encrypt(
                {
                    name: ALGORITHM,
                    iv: iv
                },
                key,
                stringToBuffer(plaintext)
            );

            return {
                encrypted: bufferToBase64(encrypted),
                iv: bufferToBase64(iv),
                salt: bufferToBase64(salt)
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt password');
        }
    }

    /**
     * Decrypt a password
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @param {string} ivBase64 - Base64 encoded IV
     * @param {string} saltBase64 - Base64 encoded salt
     * @param {string} masterPassword - The master password for decryption
     * @returns {Promise<string>}
     */
    async function decrypt(encryptedData, ivBase64, saltBase64, masterPassword) {
        try {
            const salt = new Uint8Array(base64ToBuffer(saltBase64));
            const iv = new Uint8Array(base64ToBuffer(ivBase64));
            const key = await deriveKey(masterPassword, salt);

            const decrypted = await crypto.subtle.decrypt(
                {
                    name: ALGORITHM,
                    iv: iv
                },
                key,
                base64ToBuffer(encryptedData)
            );

            return bufferToString(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt password. Check your master password.');
        }
    }

    /**
     * Hash a string using SHA-256 (for verification purposes)
     * @param {string} str - String to hash
     * @returns {Promise<string>}
     */
    async function hash(str) {
        const buffer = await crypto.subtle.digest('SHA-256', stringToBuffer(str));
        return bufferToBase64(buffer);
    }

    /**
     * Generate a secure random password
     * @param {number} length - Length of the password
     * @param {Object} options - Password options
     * @returns {string}
     */
    function generatePassword(length = 16, options = {}) {
        const {
            uppercase = true,
            lowercase = true,
            numbers = true,
            symbols = true
        } = options;

        let charset = '';
        if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
        if (numbers) charset += '0123456789';
        if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

        if (charset === '') {
            charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        }

        const randomValues = new Uint32Array(length);
        crypto.getRandomValues(randomValues);

        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset[randomValues[i] % charset.length];
        }

        return password;
    }

    /**
     * Calculate password strength
     * @param {string} password - Password to evaluate
     * @returns {{score: number, label: string, color: string}}
     */
    function calculateStrength(password) {
        let score = 0;

        if (!password) {
            return { score: 0, label: 'None', color: '#6b7280' };
        }

        // Length checks
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;

        // Character variety checks
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^a-zA-Z0-9]/.test(password)) score += 1;

        // Bonus for length
        if (password.length >= 20) score += 1;

        // Map score to label
        if (score <= 2) return { score: 25, label: 'Weak', color: '#ef4444' };
        if (score <= 4) return { score: 50, label: 'Fair', color: '#f97316' };
        if (score <= 6) return { score: 75, label: 'Good', color: '#eab308' };
        return { score: 100, label: 'Strong', color: '#22c55e' };
    }

    // Public API
    return {
        encrypt,
        decrypt,
        hash,
        generatePassword,
        calculateStrength
    };

})();

// Export for use in other modules
window.CryptoModule = CryptoModule;
