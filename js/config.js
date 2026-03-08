// ============================================================
// config.js - Central configuration
// Replace ALL placeholder values before deploying
// ============================================================

const CONFIG = {
  // --- Supabase ---
  SUPABASE_URL: 'https://xddjucvjyrouooycyege.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZGp1Y3ZqeXJvdW9veWN5ZWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjA4OTUsImV4cCI6MjA4ODUzNjg5NX0.clJw9E_0Kacp-c9ou24bd3GIB841t1SdnmiPUWSOJqM',
  // --- Discord OAuth2 ---
DISCORD_CLIENT_ID: '1363053471728668792',
DISCORD_REDIRECT_URI: 'https://s1ahen.github.io/24QC/callback.html',
  // e.g. 'https://atc24resources.github.io/24QuickCharts/callback.html'

  // --- Discord IDs allowed to review submissions ---
  // Add Discord user IDs (as strings) here
  REVIEWER_IDS: [
    // '828709371201585153',
    // '786262323517456404',
  ],

  // --- Storage ---
  STORAGE_BUCKET: 'charts',

  // --- App ---
  APP_VERSION: 'v0.2.0-beta',
};

window.CONFIG = CONFIG;
