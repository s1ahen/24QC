// ============================================================
// review.js - Review queue logic
// ============================================================

let allSubmissions = [];
let currentTab = 'pending';
let denyTargetId = null;

async function initReview() {
  const user = await Auth.init();

  if (!user || !Auth.isReviewer()) {
    document.getElementById('access-denied').style.display = 'flex';
    return;
  }

  // Show reviewer info in nav
  document.getElementById('reviewer-info').innerHTML = `
    <img src="${user.avatar || ''}" alt="avatar">
    ${user.username}
    <span style="color: var(--amber); font-size:11px; font-weight:700; text-transform:uppercase; margin-left:4px;">Reviewer</span>
  `;

  document.getElementById('review-content').style.display = 'block';
  await loadQueue();
}

async function loadQueue() {
  document.getElementById('queue-list').innerHTML =
    '<div class="loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> Loading queue...</div>';

  try {
    allSubmissions = await Submissions.getAllSubmissions();
    updatePendingCount();
    renderTab(currentTab);
  } catch (e) {
    document.getElementById('queue-list').innerHTML =
      `<div class="empty-queue"><i class="fas fa-exclamation-circle"></i><p>Failed to load: ${e.message}</p></div>`;
  }
}

function updatePendingCount() {
  const pending = allSubmissions.filter(s => s.status === 'pending').length;
  const countEl = document.getElementById('pending-count');
  if (countEl) {
    countEl.textContent = pending;
    countEl.style.display = pending > 0 ? 'inline' : 'none';
  }
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderTab(tab);
}

function renderTab(tab) {
  const filtered = allSubmissions.filter(s => s.status === tab);
  const list = document.getElementById('queue-list');

  if (filtered.length === 0) {
    const msgs = {
      pending: { icon: 'fa-check-circle', text: 'No pending submissions — queue is clear!' },
      approved: { icon: 'fa-thumbs-up', text: 'No approved submissions yet.' },
      denied: { icon: 'fa-inbox', text: 'No denied submissions.' },
    };
    const m = msgs[tab];
    list.innerHTML = `<div class="empty-queue"><i class="fas ${m.icon}"></i><p>${m.text}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(sub => buildReviewCard(sub)).join('');
}

function buildReviewCard(sub) {
  const charts = sub.charts || [];
  const submitter = sub.submitted_user;
  const date = new Date(sub.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const statusIcon = {
    pending: 'fas fa-clock',
    approved: 'fas fa-check-circle',
    denied: 'fas fa-times-circle',
  }[sub.status];

  const chartGrid = charts.map(c => `
    <div class="chart-item" onclick="previewImage('${c.public_url}')">
      <img class="chart-item-img" src="${c.public_url}" alt="${c.chart_name}"
           onerror="this.style.background='var(--dark-4)'; this.style.display='none';">
      <div class="chart-item-info">
        <span class="chart-item-tag ${c.tag}">${c.tag}</span>
        <div class="chart-item-name">${c.chart_name}</div>
      </div>
    </div>
  `).join('');

  const actionButtons = sub.status === 'pending' ? `
    <div class="card-actions">
      <button class="btn-deny" onclick="openDenyModal('${sub.id}')">
        <i class="fas fa-times"></i> Deny
      </button>
      <button class="btn-approve" onclick="doApprove('${sub.id}', this)">
        <i class="fas fa-check"></i> Approve
      </button>
    </div>` : '';

  const denialBlock = sub.status === 'denied' && sub.review_notes ? `
    <div class="denial-notes-block">
      <strong><i class="fas fa-exclamation-triangle"></i> Reviewer Notes</strong>
      ${sub.review_notes}
    </div>` : '';

  const submitterHtml = submitter ? `
    <div class="card-submitter">
      <img src="${submitter.avatar || ''}" alt="submitter">
      Submitted by ${submitter.username}
    </div>` : '';

  return `
    <div class="submission-card" id="card-${sub.id}">
      <div class="card-header">
        <div class="card-meta">
          <div class="card-airport">${sub.airport_code}</div>
          <div class="card-author">by ${sub.author_name}</div>
          ${submitterHtml}
        </div>
        <div class="card-right">
          <span class="status-badge ${sub.status}">
            <i class="${statusIcon}"></i> ${sub.status}
          </span>
          <span class="card-date">${date}</span>
        </div>
      </div>
      <div class="charts-grid">${chartGrid}</div>
      ${denialBlock}
      ${actionButtons}
    </div>
  `;
}

async function doApprove(submissionId, btn) {
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Approving...';

  try {
    await Submissions.approveSubmission(submissionId);
    showToast('Submission approved!', 'success');
    await loadQueue();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Approve';
  }
}

function openDenyModal(submissionId) {
  denyTargetId = submissionId;
  document.getElementById('deny-notes').value = '';
  document.getElementById('deny-modal').style.display = 'flex';
}

function closeDenyModal() {
  denyTargetId = null;
  document.getElementById('deny-modal').style.display = 'none';
}

async function confirmDeny() {
  const notes = document.getElementById('deny-notes').value.trim();
  if (!notes) {
    showToast('Please enter review notes before denying', 'error');
    return;
  }

  const confirmBtn = document.querySelector('.btn-deny-confirm');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Denying...';

  try {
    await Submissions.denySubmission(denyTargetId, notes);
    closeDenyModal();
    showToast('Submission denied with notes', 'success');
    await loadQueue();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i class="fas fa-times-circle"></i> Confirm Deny';
  }
}

function previewImage(url) {
  if (!url) return;
  document.getElementById('img-preview-src').src = url;
  document.getElementById('img-preview').style.display = 'flex';
}

function closeImgPreview() {
  document.getElementById('img-preview').style.display = 'none';
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', initReview);
