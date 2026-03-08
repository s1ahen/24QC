// ============================================================
// submissions.js - Chart submission, review, and retrieval
// ============================================================

const Submissions = (() => {

  // Upload a single image file to Supabase Storage
  async function uploadChartImage(file, airportCode, authorName, chartName, tag) {
    const ext = file.name.split('.').pop();
    const safeName = chartName.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    const safeAuthor = authorName.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    const path = `${airportCode}/${tag}/${safeAuthor}/${safeName}.${ext}`;

    const { data, error } = await window.supabase.storage
      .from(CONFIG.STORAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) throw new Error(`Upload failed for "${chartName}": ${error.message}`);

    const { data: urlData } = window.supabase.storage
      .from(CONFIG.STORAGE_BUCKET)
      .getPublicUrl(path);

    return { storagePath: path, publicUrl: urlData.publicUrl };
  }

  // Submit a full chart pack
  async function submitChartPack(airportCode, authorName, chartSlots) {
    const user = Auth.getUser();
    if (!user) throw new Error('Must be logged in to submit charts');

    // 1. Create the submission record
    const { data: submission, error: subError } = await window.supabase
      .from('chart_submissions')
      .insert({
        submitted_by: user.id,
        discord_id: user.discord_id,
        airport_code: airportCode,
        author_name: authorName,
        status: 'pending',
      })
      .select()
      .single();

    if (subError) throw subError;

    // 2. Upload each chart image and insert chart records
    const chartRecords = [];
    for (const slot of chartSlots) {
      const { storagePath, publicUrl } = await uploadChartImage(
        slot.file, airportCode, authorName, slot.name, slot.tag
      );
      chartRecords.push({
        submission_id: submission.id,
        airport_code: airportCode,
        author_name: authorName,
        chart_name: slot.name,
        tag: slot.tag,
        storage_path: storagePath,
        public_url: publicUrl,
        status: 'pending',
      });
    }

    const { error: chartsError } = await window.supabase
      .from('charts')
      .insert(chartRecords);

    if (chartsError) throw chartsError;

    return submission;
  }

  // Get current user's submissions
  async function getMySubmissions() {
    const user = Auth.getUser();
    if (!user) return [];

    const { data, error } = await window.supabase
      .from('chart_submissions')
      .select(`
        *,
        charts (*)
      `)
      .eq('discord_id', user.discord_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get ALL pending submissions (reviewer only)
  async function getPendingSubmissions() {
    if (!Auth.isReviewer()) throw new Error('Not authorized');

    const { data, error } = await window.supabase
      .from('chart_submissions')
      .select(`
        *,
        charts (*),
        submitted_user:submitted_by (username, avatar, discord_id)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Get all submissions for review page (all statuses)
  async function getAllSubmissions() {
    if (!Auth.isReviewer()) throw new Error('Not authorized');

    const { data, error } = await window.supabase
      .from('chart_submissions')
      .select(`
        *,
        charts (*),
        submitted_user:submitted_by (username, avatar, discord_id)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Approve a submission
  async function approveSubmission(submissionId) {
    if (!Auth.isReviewer()) throw new Error('Not authorized');
    const user = Auth.getUser();

    const { error: subError } = await window.supabase
      .from('chart_submissions')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: null,
      })
      .eq('id', submissionId);

    if (subError) throw subError;

    // Approve all charts in this submission
    const { error: chartsError } = await window.supabase
      .from('charts')
      .update({ status: 'approved' })
      .eq('submission_id', submissionId);

    if (chartsError) throw chartsError;
  }

  // Deny a submission with notes
  async function denySubmission(submissionId, notes) {
    if (!Auth.isReviewer()) throw new Error('Not authorized');
    if (!notes || !notes.trim()) throw new Error('Review notes are required when denying');
    const user = Auth.getUser();

    const { error: subError } = await window.supabase
      .from('chart_submissions')
      .update({
        status: 'denied',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes.trim(),
      })
      .eq('id', submissionId);

    if (subError) throw subError;

    const { error: chartsError } = await window.supabase
      .from('charts')
      .update({ status: 'denied' })
      .eq('submission_id', submissionId);

    if (chartsError) throw chartsError;
  }

  // Load approved charts for the chart viewer (replaces old chartData object)
  async function getApprovedCharts(airportCode) {
    const { data, error } = await window.supabase
      .from('charts')
      .select('*')
      .eq('airport_code', airportCode)
      .eq('status', 'approved')
      .order('tag')
      .order('author_name')
      .order('chart_name');

    if (error) throw error;

    // Transform into the same structure as old chartData
    const result = {};
    const tags = ['GEN', 'GND', 'SID', 'STAR', 'APP'];

    tags.forEach(tag => {
      const tagCharts = (data || []).filter(c => c.tag === tag);
      if (tag === 'GEN' || tag === 'GND') {
        result[tag] = tagCharts.map(c => ({
          name: `${c.chart_name} by <b>${c.author_name}</b>`,
          pdf: c.public_url,
        }));
      } else {
        const authors = {};
        tagCharts.forEach(c => {
          if (!authors[c.author_name]) authors[c.author_name] = [];
          authors[c.author_name].push({
            name: c.chart_name,
            pdf: c.public_url,
          });
        });
        result[tag] = { authors };
      }
    });

    return result;
  }

  // Get airports list from Supabase
  async function getAirports() {
    const { data, error } = await window.supabase
      .from('airports')
      .select('code, name')
      .order('code');

    if (error) throw error;
    return data || [];
  }

  return {
    submitChartPack,
    getMySubmissions,
    getPendingSubmissions,
    getAllSubmissions,
    approveSubmission,
    denySubmission,
    getApprovedCharts,
    getAirports,
  };
})();

window.Submissions = Submissions;
