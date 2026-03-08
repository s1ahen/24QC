// ============================================================
// auth.js - Discord OAuth2 + Supabase user management
// ============================================================

const Auth = (() => {
  let currentUser = null;

  // Build Discord OAuth URL
  function getDiscordAuthURL() {
    const params = new URLSearchParams({
      client_id: CONFIG.DISCORD_CLIENT_ID,
      redirect_uri: CONFIG.DISCORD_REDIRECT_URI,
      response_type: 'token',
      scope: 'identify',
    });
    return `https://discord.com/api/oauth2/authorize?${params}`;
  }

  // Fetch Discord user info using access token
  async function fetchDiscordUser(accessToken) {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch Discord user');
    return res.json();
  }

  // Upsert user into Supabase
  async function upsertUser(discordUser) {
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || 0) % 5}.png`;

    const isReviewer = CONFIG.REVIEWER_IDS.includes(discordUser.id);

    const { data, error } = await window.supabase
      .from('users')
      .upsert({
        discord_id: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator || '0',
        avatar: avatarUrl,
        role: isReviewer ? 'reviewer' : 'user',
        last_login: new Date().toISOString(),
      }, { onConflict: 'discord_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Store session in localStorage
  function saveSession(accessToken, discordUser, dbUser) {
    const session = {
      accessToken,
      discordUser,
      dbUser,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    localStorage.setItem('qc_session', JSON.stringify(session));
  }

  // Load session from localStorage
  function loadSession() {
    try {
      const raw = localStorage.getItem('qc_session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        localStorage.removeItem('qc_session');
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  // Initialize auth — call on every page load
  async function init() {
    const session = loadSession();
    if (session) {
      currentUser = session.dbUser;
      currentUser.accessToken = session.accessToken;
      currentUser.discordUser = session.discordUser;
      return currentUser;
    }
    return null;
  }

  // Handle OAuth callback (called from callback.html)
  async function handleCallback() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    if (!accessToken) throw new Error('No access token in URL');

    const discordUser = await fetchDiscordUser(accessToken);
    const dbUser = await upsertUser(discordUser);
    saveSession(accessToken, discordUser, dbUser);
    return dbUser;
  }

  // Login — redirect to Discord
  function login() {
    // Save current page to return to after login
    sessionStorage.setItem('qc_return_to', window.location.href);
    window.location.href = getDiscordAuthURL();
  }

  // Logout
  function logout() {
    localStorage.removeItem('qc_session');
    currentUser = null;
    window.location.href = 'index.html';
  }

  // Get current user
  function getUser() {
    return currentUser;
  }

  // Check if user is a reviewer
  function isReviewer() {
    if (!currentUser) return false;
    return CONFIG.REVIEWER_IDS.includes(currentUser.discord_id) ||
           currentUser.role === 'reviewer' ||
           currentUser.role === 'admin';
  }

  return { init, login, logout, getUser, isReviewer, handleCallback };
})();

window.Auth = Auth;
