/**
 * Supabase Client Configuration
 * ==============================
 * Initialize and export the Supabase client for use across the application.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://supabase.com and create a new project
 * 2. In your Supabase dashboard, go to Settings > API
 * 3. Copy your Project URL and anon/public key
 * 4. Replace the placeholders below with your actual values
 * 
 * DATABASE SETUP:
 * Run this SQL in your Supabase SQL Editor:
 * 
 * CREATE TABLE passwords (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
 *   site_name TEXT NOT NULL,
 *   site_url TEXT,
 *   username TEXT NOT NULL,
 *   encrypted_password TEXT NOT NULL,
 *   iv TEXT NOT NULL,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Enable Row Level Security
 * ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
 * 
 * -- Create policy: Users can only see their own passwords
 * CREATE POLICY "Users can view own passwords" ON passwords
 *   FOR SELECT USING (auth.uid() = user_id);
 * 
 * -- Create policy: Users can insert their own passwords
 * CREATE POLICY "Users can insert own passwords" ON passwords
 *   FOR INSERT WITH CHECK (auth.uid() = user_id);
 * 
 * -- Create policy: Users can update their own passwords
 * CREATE POLICY "Users can update own passwords" ON passwords
 *   FOR UPDATE USING (auth.uid() = user_id);
 * 
 * -- Create policy: Users can delete their own passwords
 * CREATE POLICY "Users can delete own passwords" ON passwords
 *   FOR DELETE USING (auth.uid() = user_id);
 */

// ============================================
// ⚠️  REPLACE THESE WITH YOUR SUPABASE CREDENTIALS
// ============================================
const SUPABASE_URL = 'https://owyhsbdeuzwoeelnubvd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWhzYmRldXp3b2VlbG51YnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTM3MTQsImV4cCI6MjA4MDE4OTcxNH0.hQv2XBISkXMEeIs2tuYPW_T7JaSlh-1EB1H7-uW4398';
// ============================================

// Import Supabase from CDN (loaded in HTML)
const { createClient } = supabase;

// Create and export the Supabase client
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Check if Supabase is properly configured
 * @returns {boolean} True if configured, false otherwise
 */
function isSupabaseConfigured() {
    return !SUPABASE_URL.includes('YOUR_PROJECT_ID') && 
           !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');
}

/**
 * Get the current authenticated user
 * @returns {Promise<Object|null>} The current user or null
 */
async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

/**
 * Get the current session
 * @returns {Promise<Object|null>} The current session or null
 */
async function getCurrentSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

// Export for use in other modules
window.SupabaseClient = {
    client: supabaseClient,
    isConfigured: isSupabaseConfigured,
    getCurrentUser,
    getCurrentSession
};
