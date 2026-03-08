// ============================================================
// home.js - Homepage logic
// ============================================================

let airports = [];
let chartSlotCount = 0;

// ── Init ──────────────────────────────────────────────────────

async function initHome() {
  // Init auth
  const user = await Auth.init();
  updateAuthUI(user);

  // Load airports
  try {
    airports = await Submissions.getAirports();
    populateAirportDropdown();
    updateStats();
  } catch (e) {
    console.error('Failed to load airports:', e);
    // Fallback to static airport list
    airports = getStaticAirports();
    populateAirportDropdown();
  }

  // Search input
  const input = document.getElementById('search-input');
  input.addEventListener('input', handleSearch);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) {
      document.getElementById('search-results').style.display = 'none';
    }
    if (!e.target.closest('.user-avatar-wrap') && !e.target.closest('.user-menu')) {
      document.getElementById('user-menu').style.display = 'none';
    }
  });

  // Submit modal button
  document.getElementById('open-submit-modal')?.addEventListener('click', openSubmitModal);

  // Show update modal from version.js if needed
}

// ── Auth UI ───────────────────────────────────────────────────

function updateAuthUI(user) {
  const guestEl = document.getElementById('auth-guest');
  const userEl = document.getElementById('auth-user');
  const reviewerLink = document.getElementById('reviewer-link');

  if (user) {
    guestEl.style.display = 'none';
    userEl.style.display = 'flex';
    document.getElementById('user-avatar').src = user.avatar || '';
    document.getElementById('user-name').textContent = user.username;
    document.getElementById('inbox-btn').style.display = 'flex';

    if (Auth.isReviewer()) {
      reviewerLink.style.display = 'flex';
      document.getElementById('inbox-post-wrap').style.display = 'block';
    }

    loadInbox(user);
  } else {
    guestEl.style.display = 'flex';
    userEl.style.display = 'none';
    document.getElementById('inbox-btn').style.display = 'none';
  }
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// ── Search ────────────────────────────────────────────────────

function handleSearch() {
  const term = document.getElementById('search-input').value.trim().toUpperCase();
  const resultsEl = document.getElementById('search-results');

  if (term.length < 1) {
    resultsEl.style.display = 'none';
    return;
  }

  const matches = airports.filter(a =>
    a.code.includes(term) || a.name.toUpperCase().includes(term)
  ).slice(0, 8);

  if (matches.length === 0) {
    resultsEl.innerHTML = '<div class="search-no-results">No airports found</div>';
  } else {
    resultsEl.innerHTML = matches.map(a => `
      <div class="search-result-item" onclick="selectAirport('${a.code}')">
        <span class="result-code">${a.code}</span>
        <span class="result-name">${a.name}</span>
      </div>
    `).join('');
  }
  resultsEl.style.display = 'block';
}

function selectAirport(code) {
  document.getElementById('search-input').value = code;
  document.getElementById('search-results').style.display = 'none';
  goToChartViewer(code);
}

function doSearch() {
  const val = document.getElementById('search-input').value.trim().toUpperCase();
  if (!val) return;
  const match = airports.find(a => a.code === val);
  if (match) {
    goToChartViewer(val);
  } else {
    // Try partial match
    const partial = airports.find(a => a.code.startsWith(val));
    if (partial) {
      goToChartViewer(partial.code);
    } else {
      showToast('No airport found for: ' + val, 'error');
    }
  }
}

function goToChartViewer(airportCode) {
  window.location.href = `viewer.html?airport=${airportCode}`;
}

// ── Stats ─────────────────────────────────────────────────────

async function updateStats() {
  document.getElementById('stat-airports').textContent = airports.length;

  try {
    const { count: chartCount } = await window.supabase
      .from('charts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    document.getElementById('stat-charts').textContent = chartCount ?? '–';

    const { count: contributorCount } = await window.supabase
      .from('chart_submissions')
      .select('discord_id', { count: 'exact', head: true })
      .eq('status', 'approved');

    document.getElementById('stat-contributors').textContent = contributorCount ?? '–';
  } catch {
    // Keep dashes if counts fail
  }
}

// ── Airport dropdown for submit modal ────────────────────────

function populateAirportDropdown() {
  const select = document.getElementById('submit-airport');
  airports.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.code;
    opt.textContent = `${a.code} – ${a.name}`;
    select.appendChild(opt);
  });
}

// ── Submit Modal ──────────────────────────────────────────────

function openSubmitModal() {
  if (!Auth.getUser()) {
    showToast('Please log in with Discord first', 'error');
    return;
  }
  document.getElementById('submit-modal').style.display = 'flex';
  // Reset to step 1
  goToStep1();
  chartSlotCount = 0;
  document.getElementById('chart-slots').innerHTML = '';
  document.getElementById('submit-airport').value = '';
  document.getElementById('submit-author').value = '';
}

function closeSubmitModal() {
  document.getElementById('submit-modal').style.display = 'none';
}

function goToStep1() {
  setStep(1);
}

function goToStep2() {
  const airport = document.getElementById('submit-airport').value;
  const author = document.getElementById('submit-author').value.trim();

  if (!airport) { showToast('Please select an airport', 'error'); return; }
  if (!author) { showToast('Please enter your author name', 'error'); return; }

  const airportObj = airports.find(a => a.code === airport);
  document.getElementById('step2-airport-label').textContent = `${airport} – ${airportObj?.name || ''}`;
  document.getElementById('step2-author-label').textContent = `by ${author}`;

  // Add first slot if empty
  if (chartSlotCount === 0) addChartSlot();

  setStep(2);
}

function setStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`step-${i}`).style.display = i === n ? 'block' : 'none';
    const prog = document.getElementById(`prog-${i}`);
    prog.classList.remove('active', 'done');
    if (i < n) prog.classList.add('done');
    if (i === n) prog.classList.add('active');
  });
}

// ── Chart Slots ───────────────────────────────────────────────

function addChartSlot() {
  chartSlotCount++;
  const n = chartSlotCount;
  const slot = document.createElement('div');
  slot.className = 'chart-slot';
  slot.id = `slot-${n}`;
  slot.innerHTML = `
    <div class="chart-slot-header">
      <span class="slot-number">Chart #${n}</span>
      <button class="slot-remove" onclick="removeSlot(${n})" title="Remove">
        <i class="fas fa-trash"></i>
      </button>
    </div>
    <div class="slot-fields">
      <div class="slot-field full">
        <label>Chart Name</label>
        <input type="text" id="slot-${n}-name" placeholder="e.g. ILS or LOC RWY 08">
      </div>
      <div class="slot-field">
        <label>Tag</label>
        <select id="slot-${n}-tag">
          <option value="">Select tag...</option>
          <option value="GEN">GEN – General</option>
          <option value="GND">GND – Ground</option>
          <option value="SID">SID – Departure</option>
          <option value="STAR">STAR – Arrival</option>
          <option value="APP">APP – Approach</option>
        </select>
      </div>
      <div class="slot-field">
        <label>Image File</label>
        <label class="slot-file-label" id="slot-${n}-file-label" for="slot-${n}-file">
          <i class="fas fa-upload"></i>
          <span>Choose image...</span>
        </label>
        <input type="file" id="slot-${n}-file" class="slot-file-input"
               accept="image/jpeg,image/png,image/webp"
               onchange="handleFileSelect(${n}, this)">
      </div>
    </div>
  `;
  document.getElementById('chart-slots').appendChild(slot);
}

function removeSlot(n) {
  document.getElementById(`slot-${n}`)?.remove();
}

function handleFileSelect(n, input) {
  const file = input.files[0];
  const label = document.getElementById(`slot-${n}-file-label`);
  if (file) {
    label.innerHTML = `<i class="fas fa-check"></i> <span>${file.name}</span>`;
    label.classList.add('has-file');
  }
}

// ── Submit Chart Pack ─────────────────────────────────────────

async function submitChartPack() {
  const airport = document.getElementById('submit-airport').value;
  const author = document.getElementById('submit-author').value.trim();

  // Collect all slot data
  const slots = [];
  const slotEls = document.querySelectorAll('.chart-slot');

  for (const slotEl of slotEls) {
    const id = slotEl.id.replace('slot-', '');
    const name = document.getElementById(`slot-${id}-name`)?.value.trim();
    const tag = document.getElementById(`slot-${id}-tag`)?.value;
    const fileInput = document.getElementById(`slot-${id}-file`);
    const file = fileInput?.files[0];

    if (!name) { showToast(`Chart #${id}: please enter a name`, 'error'); return; }
    if (!tag) { showToast(`Chart #${id}: please select a tag`, 'error'); return; }
    if (!file) { showToast(`Chart #${id}: please upload an image`, 'error'); return; }

    slots.push({ name, tag, file });
  }

  if (slots.length === 0) {
    showToast('Add at least one chart', 'error');
    return;
  }

  // Disable submit button while uploading
  const submitBtn = document.querySelector('.btn-submit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Uploading...';

  try {
    await Submissions.submitChartPack(airport, author, slots);
    setStep(3);
  } catch (e) {
    showToast('Submission failed: ' + e.message, 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Chart Pack';
  }
}

// ── My Submissions Panel ──────────────────────────────────────

async function openMySubmissions() {
  document.getElementById('user-menu').style.display = 'none';
  document.getElementById('submissions-panel').style.display = 'block';
  document.getElementById('panel-backdrop').style.display = 'block';
  await loadMySubmissions();
}

function closeMySubmissions() {
  document.getElementById('submissions-panel').style.display = 'none';
  document.getElementById('panel-backdrop').style.display = 'none';
}

async function loadMySubmissions() {
  const list = document.getElementById('submissions-list');
  list.innerHTML = '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> Loading...</div>';

  try {
    const subs = await Submissions.getMySubmissions();

    if (!subs.length) {
      list.innerHTML = `
        <div class="no-submissions">
          <i class="fas fa-inbox" style="font-size:32px; color: var(--text-dim); display:block; margin-bottom:12px;"></i>
          No submissions yet.<br>
          Use <strong>Submit Charts</strong> to contribute!
        </div>`;
      return;
    }

    list.innerHTML = subs.map(sub => buildSubmissionCard(sub)).join('');
  } catch (e) {
    list.innerHTML = `<div class="no-submissions" style="color:var(--red);">Failed to load submissions.<br>${e.message}</div>`;
  }
}

function buildSubmissionCard(sub) {
  const charts = sub.charts || [];
  const date = new Date(sub.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const statusIcon = {
    pending: 'fas fa-clock',
    approved: 'fas fa-check-circle',
    denied: 'fas fa-times-circle',
  }[sub.status];

  const chartTags = charts.map(c =>
    `<span class="sub-chart-tag">
      <span class="tag-badge ${c.tag}">${c.tag}</span>
      ${c.chart_name}
    </span>`
  ).join('');

  const denialBlock = sub.status === 'denied' && sub.review_notes ? `
    <div class="denial-notes">
      <strong><i class="fas fa-exclamation-triangle"></i> Reviewer Notes</strong>
      ${sub.review_notes}
    </div>` : '';

  return `
    <div class="submission-card">
      <div class="submission-card-header">
        <div>
          <div class="sub-airport">${sub.airport_code}</div>
          <div class="sub-author">by ${sub.author_name}</div>
        </div>
        <span class="status-badge ${sub.status}">
          <i class="${statusIcon}"></i> ${sub.status}
        </span>
      </div>
      <div class="submission-charts">
        <div class="sub-chart-count">${charts.length} chart${charts.length !== 1 ? 's' : ''}</div>
        <div class="sub-chart-list">${chartTags}</div>
      </div>
      ${denialBlock}
      <div class="sub-date"><i class="fas fa-calendar-alt"></i> Submitted ${date}</div>
    </div>
  `;
}

// ── Utilities ─────────────────────────────────────────────────

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

function getStaticAirports() {
  // Fallback if Supabase is unreachable
  return [
    { code: 'IBAR', name: 'Barra Airport' },
    { code: 'IHEN', name: 'Henstridge Airfield' },
    { code: 'ILAR', name: 'Larnaca International Airport' },
    { code: 'IIAB', name: 'McConnell Air Force Base' },
    { code: 'IPAP', name: 'Paphos International Airport' },
    { code: 'IGRV', name: 'Grindavik Airport' },
    { code: 'IJAF', name: 'Al Najaf Airport' },
    { code: 'IZOL', name: 'Izolirani International Airport' },
    { code: 'ISCM', name: 'RAF Scampton' },
    { code: 'IDCS', name: 'Saba Airport' },
    { code: 'ITKO', name: 'Tokyo-Orenji International Airport' },
    { code: 'ILKL', name: 'Lukla Airport' },
    { code: 'IPPH', name: 'Perth International Airport' },
    { code: 'IGAR', name: 'Air Base Garry' },
    { code: 'IBLT', name: 'Boltic Airfield' },
    { code: 'IRFD', name: 'Greator Rockford International Airport' },
    { code: 'IMLR', name: 'Mellor International Airport' },
    { code: 'ITRC', name: 'Training Center' },
    { code: 'IBTH', name: 'Saint Barthélemy Airport' },
    { code: 'IUFO', name: 'UFO Base' },
    { code: 'ISAU', name: 'Sauthamptona Airport' },
    { code: 'ISKP', name: 'Skopelos Airfield' },
  ];
}

// Start
document.addEventListener('DOMContentLoaded', initHome);

// ── Inbox ─────────────────────────────────────────────────────

let inboxOpen = false;
let inboxItems = [];

function toggleInbox() {
  inboxOpen = !inboxOpen;
  document.getElementById('inbox-panel').style.display = inboxOpen ? 'flex' : 'none';
  document.getElementById('inbox-backdrop').style.display = inboxOpen ? 'block' : 'none';
}

async function loadInbox(user) {
  try {
    const { data, error } = await window.supabase
      .from('inbox_items')
      .select('*')
      .or(`for_role.eq.all,for_role.eq.${Auth.isReviewer() ? 'reviewer' : 'user'},for_user_id.eq.${user.discord_id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    inboxItems = data || [];
    renderInbox(user);
  } catch (e) {
    console.error('Inbox load failed:', e);
  }
}

function renderInbox(user) {
  const list = document.getElementById('inbox-list');
  const userId = Auth.getUser()?.discord_id || '';

  if (!inboxItems.length) {
    list.innerHTML = '<div class="inbox-empty"><i class="fas fa-inbox"></i><br>No notifications yet</div>';
    updateInboxBadge(0);
    return;
  }

  const unreadCount = inboxItems.filter(i => !i.read_by?.includes(userId)).length;
  updateInboxBadge(unreadCount);

  list.innerHTML = inboxItems.map(item => {
    const isUnread = !item.read_by?.includes(userId);
    const typeClass = item.type === 'submission' ? 'submission'
      : item.type === 'approved' ? 'approved'
        : item.type === 'denied' ? 'denied'
          : 'update';
    const unreadClass = isUnread ? `unread unread-${item.type}` : '';
    const timeStr = formatTimeAgo(item.created_at);
    return `
      <div class="inbox-item ${unreadClass}" onclick="readItem('${item.id}')">
        <div class="inbox-item-title">
          <span>${item.title}</span>
          <span class="inbox-type-badge ${typeClass}">${item.type}</span>
        </div>
        ${item.body ? `<div class="inbox-item-body">${item.body}</div>` : ''}
        <div class="inbox-item-time">${timeStr}</div>
      </div>
    `;
  }).join('');
}

function updateInboxBadge(count) {
  const badge = document.getElementById('inbox-badge');
  const btn = document.getElementById('inbox-btn');
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'block';
    btn.classList.add('has-unread');
  } else {
    badge.style.display = 'none';
    btn.classList.remove('has-unread');
  }
}

async function readItem(id) {
  const user = Auth.getUser();
  if (!user) return;
  const item = inboxItems.find(i => i.id === id);
  if (!item) return;

  // Navigate to link if present
  if (item.link) window.location.href = item.link;

  // Mark as read
  if (!item.read_by?.includes(user.discord_id)) {
    const newReadBy = [...(item.read_by || []), user.discord_id];
    await window.supabase.from('inbox_items').update({ read_by: newReadBy }).eq('id', id);
    item.read_by = newReadBy;
    renderInbox(user);
  }
}

async function markAllRead() {
  const user = Auth.getUser();
  if (!user) return;
  for (const item of inboxItems) {
    if (!item.read_by?.includes(user.discord_id)) {
      item.read_by = [...(item.read_by || []), user.discord_id];
      await window.supabase.from('inbox_items').update({ read_by: item.read_by }).eq('id', item.id);
    }
  }
  renderInbox(user);
}

async function postUpdate() {
  const title = document.getElementById('inbox-post-title').value.trim();
  const body = document.getElementById('inbox-post-body').value.trim();
  if (!title) { showToast('Please enter a title', 'error'); return; }

  const { error } = await window.supabase.from('inbox_items').insert({
    type: 'update',
    title,
    body: body || null,
    for_role: 'all',
  });

  if (error) { showToast('Failed to post update', 'error'); return; }

  document.getElementById('inbox-post-title').value = '';
  document.getElementById('inbox-post-body').value = '';
  showToast('Update posted!', 'success');

  const user = Auth.getUser();
  await loadInbox(user);
}

function formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}