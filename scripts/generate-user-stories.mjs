// Fetches open session-data GitHub issues, groups them by task and testing phase,
// generates one user story per task via GitHub Models API, and creates GitHub issues.
//
// Run via: .github/workflows/generate-user-stories.yml (workflow_dispatch)
// Required env vars: GH_TOKEN, GITHUB_REPOSITORY, PHASE
// Optional env vars: SINCE (YYYY-MM-DD), UNTIL (YYYY-MM-DD)
//
// GH_TOKEN is the auto-provided GITHUB_TOKEN from Actions. It covers both the
// GitHub REST API and the GitHub Models API when the workflow declares
// `permissions: models: read`.

const REPO  = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GH_TOKEN;
const PHASE = process.env.PHASE;
const SINCE = process.env.SINCE || null;
const UNTIL = process.env.UNTIL || null;

if (!REPO || !TOKEN || !PHASE) {
  console.error('Missing required env vars: GITHUB_REPOSITORY, GH_TOKEN, PHASE');
  process.exit(1);
}

const GH_API        = `https://api.github.com/repos/${REPO}`;
const GH_MODELS_API = 'https://models.github.ai/inference/chat/completions';

// Task descriptions — update this map when tasks change between testing phases.
const TASKS = {
  'task-1': { title: 'First impressions',
               goal:  'land on the map and find a building to explore' },
  'task-2': { title: 'Understand the building overview',
               goal:  'read and interpret the energy overview for a building' },
  'task-3': { title: 'Open the configurator and change building information',
               goal:  'edit building parameters and surface properties' },
  'task-4': { title: 'Set up the roof and add solar panels',
               goal:  'configure the roof type and add a PV system to a surface' },
  'task-5': { title: 'Review the results',
               goal:  'understand what changed after configuring the building' },
};

// ─── GitHub REST helpers ──────────────────────────────────────────────────────

const GH_HEADERS = {
  'Authorization':        `Bearer ${TOKEN}`,
  'Accept':               'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type':         'application/json',
};

async function ghRequest(method, path, body) {
  const url = path.startsWith('http') ? path : `${GH_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: GH_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Fetches all pages of issues matching the given query params. */
async function fetchAllIssues(params) {
  const issues = [];
  let page = 1;
  while (true) {
    const url = new URL(`${GH_API}/issues`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');
    const res = await fetch(url.toString(), { headers: GH_HEADERS });
    if (!res.ok) throw new Error(`Fetch issues → ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    issues.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return issues;
}

async function ensureLabel(name, color, description) {
  try {
    await ghRequest('GET', `/labels/${encodeURIComponent(name)}`);
  } catch {
    await ghRequest('POST', '/labels', { name, color, description });
    console.log(`  Created label: ${name}`);
  }
}

// ─── Session data aggregation ─────────────────────────────────────────────────

/** Extracts step completions, yes/no answers, and ratings from a session issue body. */
function parseSessionBody(body) {
  const actionSteps = { done: 0, skipped: 0 };
  const yesNo   = {};
  const ratings = {};

  for (const line of (body || '').split('\n')) {
    // Action step: **☑ text** → ✅ Done | — Skipped
    if (/\*\*☑/.test(line)) {
      if (line.includes('✅ Done')) actionSteps.done++;
      else if (line.includes('Skipped')) actionSteps.skipped++;
    }

    // Yes/no question: **? text** → ✅ Yes | No | — Not answered
    const yn = line.match(/\*\*\? (.+?)\*\*\s+→\s+(.+)/);
    if (yn) {
      const q   = yn[1].trim();
      const ans = yn[2].trim();
      if (!yesNo[q]) yesNo[q] = { yes: 0, no: 0, notAnswered: 0 };
      if (ans.includes('Yes'))                                   yesNo[q].yes++;
      else if (ans.includes('No') && !ans.includes('Not answer')) yesNo[q].no++;
      else                                                        yesNo[q].notAnswered++;
    }

    // Rating: **★ text** → ⬛…⬛⬜… N/5
    const rating = line.match(/\*\*★ (.+?)\*\*\s+→.*?(\d)\/5/);
    if (rating) {
      const dim   = rating[1].trim();
      const score = parseInt(rating[2], 10);
      if (!ratings[dim]) ratings[dim] = [];
      ratings[dim].push(score);
    }
  }

  return { actionSteps, yesNo, ratings };
}

function aggregateSessions(issues) {
  const totals = { actionSteps: { done: 0, skipped: 0 }, yesNo: {}, ratings: {} };
  for (const issue of issues) {
    const { actionSteps, yesNo, ratings } = parseSessionBody(issue.body);
    totals.actionSteps.done    += actionSteps.done;
    totals.actionSteps.skipped += actionSteps.skipped;
    for (const [q, counts] of Object.entries(yesNo)) {
      if (!totals.yesNo[q]) totals.yesNo[q] = { yes: 0, no: 0, notAnswered: 0 };
      totals.yesNo[q].yes         += counts.yes;
      totals.yesNo[q].no          += counts.no;
      totals.yesNo[q].notAnswered += counts.notAnswered;
    }
    for (const [dim, scores] of Object.entries(ratings)) {
      if (!totals.ratings[dim]) totals.ratings[dim] = [];
      totals.ratings[dim].push(...scores);
    }
  }
  return totals;
}

function formatAggregation(agg) {
  const lines = [];
  const stepTotal = agg.actionSteps.done + agg.actionSteps.skipped;
  lines.push(`**Action step completion:** ${agg.actionSteps.done} of ${stepTotal} steps completed`);

  const ynEntries = Object.entries(agg.yesNo);
  if (ynEntries.length > 0) {
    lines.push('');
    lines.push('| Question | Yes | No | Not answered |');
    lines.push('|---|---|---|---|');
    for (const [q, c] of ynEntries) {
      lines.push(`| ${q} | ${c.yes} | ${c.no} | ${c.notAnswered} |`);
    }
  }

  const ratingEntries = Object.entries(agg.ratings);
  if (ratingEntries.length > 0) {
    lines.push('');
    lines.push('| Rating dimension | Average | Range |');
    lines.push('|---|---|---|');
    for (const [dim, scores] of ratingEntries) {
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      lines.push(`| ${dim} | ${avg} / 5 | ${Math.min(...scores)}–${Math.max(...scores)} |`);
    }
  }

  return lines.join('\n');
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

async function generateUserStory(taskKey, issues) {
  const task     = TASKS[taskKey];
  const agg      = aggregateSessions(issues);
  const aggText  = formatAggregation(agg);
  const refs     = issues.map((i) => `#${i.number}`).join(', ');
  const sessions = issues.map((i) => `### Session #${i.number}\n${i.body || ''}`).join('\n\n---\n\n');

  const systemPrompt = `You are a UX analyst converting usability testing data into GitHub user stories.

Product: Building Configurator — a web app that lets homeowners configure their building's energy properties (surfaces, insulation U-values, roof type, solar PV panels) and view estimated annual energy demand (heating, electricity, hot water).

Testing scenario given to participants: "You own a house. You've been thinking about solar panels. You know roughly how big it is, when it was built, and that one side faces south."

Respond with a JSON object containing exactly two fields:
  "title": string — max 80 chars, must start with "User story:"
  "body":  string — full GitHub issue body in markdown following this exact template (replace bracketed placeholders):

## User Story
As a **[specific user type reflecting the scenario]**, I want to **[concrete, observable goal]**, so that **[tangible benefit]**.

## Acceptance Criteria
- [ ] [testable criterion addressing a gap found in the feedback]
- [ ] ...

## Evidence — [PHASE]
**Sessions:** [refs]
**Sessions analysed:** [count]

[aggregated stats table — copied from the data provided, do not invent numbers]

## Priority
**[Low / Medium / High]** — [one sentence rationale grounded in the data; use completion rates and average ratings as evidence].

Rules:
- User type must be specific (e.g. "homeowner considering solar energy", not "user")
- Acceptance criteria: 3–6 items, each testable, each addressing a real gap from the data
- Priority: High if avg rating < 2.5 or >40% steps skipped; Medium if 2.5–3.5 or some unanswered questions; Low otherwise
- Do not invent data points not present in the sessions`;

  const userMessage = `Task: "${task.title}" — user goal: ${task.goal}
Phase: ${PHASE}
Sessions (${issues.length}): ${refs}

AGGREGATED DATA:
${aggText}

RAW SESSION RECORDS:
${sessions}`;

  const res = await fetch(GH_MODELS_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:           'openai/gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature:     0.3,
    }),
  });

  if (!res.ok) throw new Error(`GitHub Models API ${res.status}: ${await res.text()}`);
  const data    = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from GitHub Models API');
  return JSON.parse(content);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nGenerating user stories`);
  console.log(`  Phase: ${PHASE}`);
  if (SINCE) console.log(`  Since: ${SINCE}`);
  if (UNTIL) console.log(`  Until: ${UNTIL}`);
  console.log(`  Repo:  ${REPO}\n`);

  // Ensure labels exist
  await ensureLabel('user-story', '0075ca', 'Derived user story from session feedback');
  await ensureLabel(PHASE,        'e4e669', `Testing phase: ${PHASE}`);

  // Fetch all open session-data issues
  process.stdout.write('Fetching session-data issues... ');
  const all = await fetchAllIssues({ labels: 'session-data', state: 'open' });
  console.log(`${all.length} found`);

  // Apply date window (client-side — GitHub since param uses updated_at not created_at)
  const sinceDate = SINCE ? new Date(SINCE) : null;
  const untilDate = UNTIL ? new Date(`${UNTIL}T23:59:59Z`) : null;
  const inWindow  = all.filter(({ created_at }) => {
    const t = new Date(created_at);
    return (!sinceDate || t >= sinceDate) && (!untilDate || t <= untilDate);
  });
  console.log(`${inWindow.length} within date window\n`);

  // Group by task label
  const groups = {};
  for (const issue of inWindow) {
    const taskLabel = issue.labels.map((l) => l.name).find((n) => /^task-\d+$/.test(n));
    if (taskLabel) {
      if (!groups[taskLabel]) groups[taskLabel] = [];
      groups[taskLabel].push(issue);
    }
  }

  const created = [];

  for (const taskKey of Object.keys(TASKS)) {
    const issues = groups[taskKey] ?? [];
    if (issues.length === 0) {
      console.log(`${taskKey}: no sessions — skipping`);
      continue;
    }

    console.log(`${taskKey}: ${issues.length} session(s)`);

    // Idempotency — close any existing user stories for this phase + task
    const existing = await fetchAllIssues({ labels: `user-story,${PHASE},${taskKey}`, state: 'open' });
    for (const old of existing) {
      await ghRequest('PATCH', `/issues/${old.number}`, { state: 'closed' });
      console.log(`  Closed existing user story #${old.number}`);
    }

    // Generate user story via LLM
    process.stdout.write('  Calling GitHub Models API... ');
    let story;
    try {
      story = await generateUserStory(taskKey, issues);
    } catch (err) {
      console.error(`\n  Error: ${err.message}`);
      continue;
    }
    console.log('done');

    // Create the new issue
    const issue = await ghRequest('POST', '/issues', {
      title:  story.title,
      body:   story.body,
      labels: ['user-story', PHASE, taskKey],
    });
    console.log(`  Created #${issue.number}: ${issue.html_url}`);
    created.push({ number: issue.number, url: issue.html_url, task: taskKey });

    // Tag session issues with the phase label
    for (const session of issues) {
      const current = session.labels.map((l) => l.name);
      if (!current.includes(PHASE)) {
        await ghRequest('PATCH', `/issues/${session.number}`, { labels: [...current, PHASE] });
      }
    }
    console.log(`  Tagged ${issues.length} session(s) with '${PHASE}'\n`);
  }

  console.log('─── Summary ───────────────────────────────');
  if (created.length === 0) {
    console.log('No user stories created.');
  } else {
    for (const { task, number, url } of created) {
      console.log(`[${task}] #${number}  ${url}`);
    }
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
