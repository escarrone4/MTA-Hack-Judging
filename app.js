// app.js — scoring logic and UI (cohort 2, team names added)
const businessCriteria = [
  { key: 'alignment', title: 'Alignment to Assigned Use Case', weight: 20 },
  { key: 'design', title: 'Copilot Design & Orchestration', weight: 30 },
  { key: 'actions', title: 'Actions & Automation', weight: 25 },
  { key: 'creativity', title: 'Agent Creativity & Branding', weight: 15 },
  { key: 'demo', title: 'Demo Quality & Adoption Readiness', weight: 10 }
];

const developerCriteria = [
  { key: 'problem', title: 'Transit Problem Validity', weight: 20 },
  { key: 'architecture', title: 'Agent Architecture & Functionality', weight: 30 },
  { key: 'azure', title: 'Azure AI / Technology Integration', weight: 25 },
  { key: 'innovation', title: 'Innovation & Creativity', weight: 15 },
  { key: 'demo', title: 'Demo & Real-World Readiness', weight: 10 }
];

// Cohort 2 — team names (team names only, no participant names)
const teams = {
  business: [
    { id: 'security', name: 'Security Team' },
    { id: 'compensation', name: 'Compensation Team' },
    { id: 'selfservice', name: 'Employee Self Service Team' },
    { id: 'learning', name: 'Learning and Development Team' },
    { id: 'infra', name: 'Infrastructure & Operations' },
    { id: 'capital', name: 'Capital Projects & Construction' },
    { id: 'legal', name: 'Legal' }
  ],
  developer: [
    { id: 'prompt', name: 'Prompt Conductors' },
    { id: 'gitpush', name: 'Git Push Express' },
    { id: 'foundry', name: 'Foundry Junction' },
    { id: 'agentic', name: 'Agentic Transit Authority' },
    { id: 'signal', name: 'Signal Boosters' },
    { id: 'azurerail', name: 'Azure Rail Builders' },
    { id: 'copilotcc', name: 'Copilot Command Center' },
    { id: 'code', name: 'Code Conductors' }
  ]
};

// elements
const trackSelect = document.getElementById('trackSelect');
const teamSelect = document.getElementById('teamSelect');
const criteriaContainer = document.getElementById('criteriaContainer');
const calcBtn = document.getElementById('calcBtn');
const downloadBtn = document.getElementById('downloadBtn');
const totalScoreEl = document.getElementById('totalScore');
const resetBtn = document.getElementById('resetBtn');
const judgeNameEl = document.getElementById('judgeName');
const judgeEmailEl = document.getElementById('judgeEmail');
const submitBtn = document.getElementById('submitBtn');

function populateTeams(){
  const t = trackSelect.value;
  teamSelect.innerHTML = '';
  teams[t].forEach(team => {
    const opt = document.createElement('option');
    opt.value = team.id;
    opt.textContent = team.name;
    teamSelect.appendChild(opt);
  });
}

function buildCriteria(){
  const t = trackSelect.value;
  const list = t === 'business' ? businessCriteria : developerCriteria;
  criteriaContainer.innerHTML = '';
  list.forEach(c => {
    const div = document.createElement('div');
    div.className = 'criterion';
    div.innerHTML = `
      <h3>${c.title}</h3>
      <div class="meta">Weight: ${c.weight}%</div>
      <div class="controls">
        <label>Score (1-5):
          <select data-key="${c.key}" data-weight="${c.weight}" class="scoreSelect">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3" selected>3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>
      </div>
      <div style="margin-top:8px">
        <label>Judge notes (optional):</label>
        <textarea data-key-notes="${c.key}" placeholder="Add short notes for judges or organizers"></textarea>
      </div>
    `;
    criteriaContainer.appendChild(div);
  });
}

function calculateScore(){
  const selects = document.querySelectorAll('.scoreSelect');
  let total = 0;
  selects.forEach(s => {
    const score = Number(s.value);
    const weight = Number(s.dataset.weight);
    // contribution: (score / 5) * weight
    const contrib = (score / 5) * weight;
    total += contrib;
  });
  // round to 2 decimals
  total = Math.round(total * 100) / 100;
  totalScoreEl.textContent = total.toString();
  return total;
}

function gatherResults(){
  const t = trackSelect.value;
  const list = t === 'business' ? businessCriteria : developerCriteria;
  const teamLabel = teams[t].find(x => x.id === teamSelect.value)?.name || teamSelect.value;
  const results = {
    judge: judgeNameEl.value || '',
    judge_email: judgeEmailEl && judgeEmailEl.value ? judgeEmailEl.value : '',
    track: t,
    team: teamLabel,
    timestamp: new Date().toISOString(),
    total: calculateScore(),
    criteria: []
  };
  list.forEach(c => {
    const scoreEl = document.querySelector(`select[data-key="${c.key}"]`);
    const notesEl = document.querySelector(`textarea[data-key-notes="${c.key}"]`);
    results.criteria.push({ key: c.key, title: c.title, weight: c.weight, score: Number(scoreEl.value), notes: notesEl.value || '' });
  });
  return results;
}

function sanitizeTimestampForFilename(dt){
  return dt.replace(/:/g,'-');
}

function downloadCSV(){
  const r = gatherResults();
  // produce CSV with header rows (include judge_email)
  let lines = [];
  lines.push(["judge", "judge_email", "track", "team", "timestamp", "total" ].join(','));
  lines.push([`"${(r.judge||'').replace(/"/g,'""') }"`, `"${(r.judge_email||'').replace(/"/g,'""')}"`, r.track, `"${r.team.replace(/"/g,'""')}"`, r.timestamp, r.total].join(','));
  lines.push('');
  lines.push(['criterion','weight','score','notes'].join(','));
  r.criteria.forEach(c => {
    const notes = `"${(c.notes||'').replace(/"/g,'""')}"`;
    lines.push([`"${c.title.replace(/"/g,'""')}"`, c.weight, c.score, notes].join(','));
  });

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // sanitize timestamp for filename (replace colons)
  const ts = sanitizeTimestampForFilename((new Date()).toISOString());
  const trackLabel = r.track === 'business' ? 'track1' : 'track2';
  a.download = `judging_${trackLabel}_${r.team.replace(/\s+/g,'_')}_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function submitToGitHubIssue(){
  const email = (judgeEmailEl && judgeEmailEl.value || '').trim();
  // simple email validation
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if(!email || !emailValid){
    alert('Please enter a valid judge email before submitting.');
    if(judgeEmailEl) judgeEmailEl.focus();
    return;
  }

  const r = gatherResults();
  const title = `Judging submission — ${r.team}`;

  // Build readable issue body
  const bodyLines = [];
  bodyLines.push(`**Judge:** ${r.judge || '(not provided)'} `);
  bodyLines.push(`**Judge email:** ${r.judge_email}`);
  bodyLines.push(`**Track:** ${r.track}`);
  bodyLines.push(`**Team:** ${r.team}`);
  bodyLines.push(`**Timestamp:** ${r.timestamp}`);
  bodyLines.push(`**Total score:** ${r.total}/100`);
  bodyLines.push('');
  bodyLines.push('### Criteria');
  r.criteria.forEach(c => {
    const noteStr = c.notes ? ` — ${c.notes}` : '';
    bodyLines.push(`- **${c.title}** (${c.weight}%): ${c.score}${noteStr}`);
  });
  bodyLines.push('');
  bodyLines.push('_Submitted via MTA Hack judging scorecard_');

  const body = encodeURIComponent(bodyLines.join('\n'));
  const labels = encodeURIComponent('submission');

  // Open prefilled issue: judges must be signed into GitHub and click "Submit issue"
  const issueUrl = `https://github.com/escarrone4/MTA-Hack-Judging/issues/new?title=${encodeURIComponent(title)}&body=${body}&labels=${labels}`;
  window.open(issueUrl, '_blank');
}

function resetForm(){
  judgeNameEl.value = '';
  if(judgeEmailEl) judgeEmailEl.value = '';
  buildCriteria();
  totalScoreEl.textContent = '0';
}

// events
trackSelect.addEventListener('change', () => { populateTeams(); buildCriteria(); });
calcBtn.addEventListener('click', () => calculateScore());
downloadBtn.addEventListener('click', () => downloadCSV());
resetBtn.addEventListener('click', () => resetForm());
if(submitBtn){
  submitBtn.addEventListener('click', () => submitToGitHubIssue());
}

// init
populateTeams();
buildCriteria();
