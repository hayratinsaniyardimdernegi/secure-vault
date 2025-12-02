# 🔐 SecureVault - Password Manager

A secure, client-side encrypted password manager built with vanilla JavaScript and Supabase.

![SecureVault](https://img.shields.io/badge/Encryption-AES--256--GCM-green)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow)
![Supabase](https://img.shields.io/badge/Backend-Supabase-blue)

## ✨ Features

- **🔒 Client-Side Encryption**: Your passwords are encrypted with AES-256-GCM before leaving your device
- **🔑 Master Password**: Only you can decrypt your passwords - we never see them
- **🔐 Secure Authentication**: Email/password auth powered by Supabase
- **📱 Responsive Design**: Works on desktop and mobile
- **🎲 Password Generator**: Generate strong, random passwords
- **🔍 Search**: Quickly find your passwords
- **📋 One-Click Copy**: Copy passwords and usernames to clipboard
- **🌙 Dark Theme**: Easy on the eyes

## 🚀 Quick Start

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **Settings → API** and copy your:
   - Project URL
   - anon/public key

### 2. Create Database Table

Go to **SQL Editor** in your Supabase dashboard and run this SQL:

```sql
-- Create the passwords table
CREATE TABLE passwords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  site_name TEXT NOT NULL,
  site_url TEXT,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  iv TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;

-- Users can only see their own passwords
CREATE POLICY "Users can view own passwords" ON passwords
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own passwords
CREATE POLICY "Users can insert own passwords" ON passwords
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own passwords
CREATE POLICY "Users can update own passwords" ON passwords
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own passwords
CREATE POLICY "Users can delete own passwords" ON passwords
  FOR DELETE USING (auth.uid() = user_id);
```

### 3. Configure the App

Open `js/supabaseClient.js` and replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

### 4. Run the App

Simply open `index.html` in your browser! No build step required.

For local development, you can use any static server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## 📁 Project Structure

```
password-vault-vanilla/
├── index.html          # Login / Register page
├── vault.html          # Main vault page
├── css/
│   └── style.css       # All styles (dark theme)
└── js/
    ├── supabaseClient.js  # Supabase initialization
    ├── crypto.js          # Encryption/decryption (AES-GCM)
    ├── auth.js            # Authentication logic
    └── vault.js           # Vault CRUD operations
```

## 🔐 Security Architecture

### Encryption Flow

1. User enters a **master password** (never sent to server)
2. Master password → PBKDF2 (100,000 iterations) → AES-256 key
3. Each password is encrypted with a unique IV
4. Only encrypted data + IV is stored in Supabase

### What's Stored Server-Side

| Field | Encrypted? |
|-------|------------|
| Site Name | ❌ No (for searching) |
| Site URL | ❌ No |
| Username | ❌ No |
| Password | ✅ **Yes** (AES-256-GCM) |
| Notes | ❌ No |

### Key Security Features

- **Zero-Knowledge**: Your master password never leaves your device
- **PBKDF2**: 100,000 iterations for key derivation
- **AES-256-GCM**: Authenticated encryption prevents tampering
- **Random IVs**: Each encryption uses a unique IV
- **Row Level Security**: Database policies ensure users only access their data
- **Auto-Clear Clipboard**: Copied passwords are cleared after 30 seconds

## 🎨 Customization

### Changing the Theme

Edit the CSS variables in `css/style.css`:

```css
:root {
    --color-accent: #d4af37;      /* Gold accent */
    --color-bg-primary: #0a0a0f;  /* Dark background */
    /* ... more variables */
}
```

### Adding New Fields

1. Add the field to the SQL table
2. Add input in `vault.html`
3. Update `vault.js` to handle the new field

## ⚠️ Important Notes

- **Backup Your Master Password**: If you forget it, your passwords are unrecoverable
- **Use HTTPS**: Always serve this app over HTTPS in production
- **Email Confirmation**: Configure email templates in Supabase for production

## 🐛 Troubleshooting

### "Supabase is not configured"
Make sure you've updated `js/supabaseClient.js` with your actual Supabase credentials.

### "Failed to decrypt password"
This usually means the master password is wrong. The master password must match what was used during encryption.

### Passwords not loading
Check the browser console for errors. Make sure:
1. The database table exists
2. RLS policies are set up correctly
3. You're logged in with a valid session

## 📄 License

MIT License - feel free to use this for personal or commercial projects.

---

Built with ❤️ using vanilla JavaScript and Supabase
