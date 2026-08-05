// netlify/functions/submit.js
// Node 18+ runtime (Netlify supports fetch globally)
const owner = 'escarrone4';
const repo = 'MTA-Hack-Judging';
const path = 'submissions/submissions.csv';
const branch = 'main'; // change to 'add-scorecard' if you prefer commits to that branch

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Basic validation
  if (!payload.judge_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.judge_email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid judge_email' }) };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured: missing GITHUB_TOKEN' }) };

  // Build CSV row (escape quotes)
  const quote = (v) => `"${String(v !== undefined && v !== null ? v : '').replace(/"/g, '""')}"`;
  const criteriaJson = JSON.stringify(payload.criteria || []);
  const row = [
    payload.judge || '',
    payload.judge_email || '',
    payload.track || '',
    payload.team || '',
    payload.timestamp || new Date().toISOString(),
    payload.total != null ? payload.total : '',
    criteriaJson
  ].map(quote).join(',');

  try {
    // 1) Try to fetch existing submissions CSV
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const getRes = await fetch(getUrl, { headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' }});
    let existing = null;
    let sha = null;

    if (getRes.status === 200) {
      const getJson = await getRes.json();
      existing = Buffer.from(getJson.content, 'base64').toString('utf8');
      sha = getJson.sha;
    } else if (getRes.status === 404) {
      // file doesn't exist yet — will create
      existing = null;
    } else {
      const text = await getRes.text();
      return { statusCode: 500, body: JSON.stringify({ error: 'GitHub read error', detail: text }) };
    }

    // 2) Prepare new content
    let newContent;
    if (!existing) {
      const header = 'judge,judge_email,track,team,timestamp,total,criteria_json';
      newContent = header + '\n' + row + '\n';
    } else {
      if (!existing.endsWith('\n')) existing += '\n';
      newContent = existing + row + '\n';
    }

    // 3) Commit (create or update)
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const commitBody = {
      message: `Add submission: ${payload.team} by ${payload.judge_email}`,
      content: b64(newContent),
      branch
    };
    if (sha) commitBody.sha = sha;

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' },
      body: JSON.stringify(commitBody)
    });
    const putJson = await putRes.json();

    if (putRes.status >= 200 && putRes.status < 300) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, commit: putJson.commit ? putJson.commit.sha : null })
      };
    } else {
      return { statusCode: 500, body: JSON.stringify({ error: 'GitHub write error', detail: putJson }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error', message: err.message }) };
  }
};
