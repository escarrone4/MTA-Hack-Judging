// netlify/functions/submit.js
// Node 18+ runtime (Netlify supports fetch globally)
const owner = 'escarrone4';
const repo = 'MTA-Hack-Judging';
const path = 'submissions/submissions.csv';
const branch = 'add-scorecard'; // commit CSV to add-scorecard branch

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

function parseCSVRow(line){
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(inQuotes){
      if(ch === '"'){
        if(line[i+1] === '"'){
          cur += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if(ch === '"'){
        inQuotes = true;
      } else if(ch === ','){
        fields.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  fields.push(cur);
  return fields;
}

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

      // DUPLICATE DETECTION: parse CSV and look for matching judge_email + team
      const lines = existing.split(/\r?\n/).filter(l => l.trim().length > 0);
      if(lines.length > 0){
        const header = lines[0];
        const headerFields = parseCSVRow(header);
        const emailIdx = headerFields.indexOf('judge_email');
        const teamIdx = headerFields.indexOf('team');
        if(emailIdx !== -1 && teamIdx !== -1){
          for(let i=1;i<lines.length;i++){
            const fields = parseCSVRow(lines[i]);
            const existingEmail = fields[emailIdx] || '';
            const existingTeam = fields[teamIdx] || '';
            if(existingEmail === payload.judge_email && existingTeam === payload.team){
              return { statusCode: 409, body: JSON.stringify({ error: 'Duplicate submission', message: 'A submission for this judge email and team already exists.' }) };
            }
          }
        }
      }

    } else if (getRes.status === 404) {
      existing = null; // will create file
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
