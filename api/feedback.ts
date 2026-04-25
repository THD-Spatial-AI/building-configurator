// Vercel serverless function — receives feedback from the in-app session panel,
// uploads screenshots to Vercel Blob storage, and creates a GitHub issue.
//
// Two feedback types (set via feedbackType field):
//   'issue'   — explicit UI bug report; labels: user-feedback, ux, difficulty, task-id
//   'session' — task completion data;   labels: session-data, task-id
//
// Required environment variables (set in Vercel project settings):
//   GITHUB_TOKEN       — PAT with Issues: read/write (or classic repo scope)
//   GITHUB_OWNER       — repository owner  (e.g. "your-org")
//   GITHUB_REPO        — repository name   (e.g. "building-configurator")
//   BLOB_READ_WRITE_TOKEN — auto-set by Vercel when a Blob store is linked

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

interface ScreenshotPayload {
  name:     string;
  data:     string;   // base64-encoded, no data-URI prefix
  mimeType: string;
}

interface SubtaskResult {
  type:      'todo' | 'question' | 'yesno' | 'rating';
  step:      string;
  // todo
  status?:   'done' | 'couldnt_finish' | 'pending';
  comment?:  string;
  // question
  response?: string;
  // yesno
  answer?:   'yes' | 'no' | null;
  // rating
  rating?:   number | null;
}

interface FeedbackPayload {
  goal:              string;
  result:            string;
  rating:            number;
  view:              string;
  context:           string;
  url:               string;
  timestamp:         string;
  screenshots:       ScreenshotPayload[];
  taskId?:           string | null;
  taskTitle?:        string | null;
  feedbackType?:     'issue' | 'session';
  subtaskResults?:   SubtaskResult[];
  additionalComment?: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function ratingMeta(r: number): { label: string; ghLabel: string } {
  if (r <= 2)  return { label: `${r} – Easy`,        ghLabel: 'feedback: easy'     };
  if (r === 3) return { label: '3 – Moderate',        ghLabel: 'feedback: moderate' };
  if (r === 4) return { label: '4 – Difficult',       ghLabel: 'feedback: hard'     };
               return { label: '5 – Blocked/broken',  ghLabel: 'feedback: blocked'  };
}

async function uploadScreenshot(shot: ScreenshotPayload): Promise<string> {
  const binary   = Buffer.from(shot.data, 'base64');
  const safeName = shot.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const { url }  = await put(`feedback-screenshots/${Date.now()}-${safeName}`, binary, {
    access:      'public',
    contentType: shot.mimeType || 'image/png',
  });
  return url;
}

// ─── Issue report (feedbackType === 'issue') ──────────────────────────────────

function buildIssueTitle(p: FeedbackPayload): string {
  const taskPart = p.taskTitle ? `[${p.taskTitle}] ` : '';
  const prefix   = `[Feedback] ${taskPart}`;
  const max      = 72 - prefix.length;
  const goal     = p.goal.replace(/\n/g, ' ').trim();
  return `${prefix}${goal.length > max ? goal.slice(0, max - 1) + '…' : goal}`;
}

function buildIssueBody(p: FeedbackPayload, screenshotUrls: string[]): string {
  const { label } = ratingMeta(p.rating);
  const lines = [
    '## User Feedback',
    '',
    '| Field | Value |',
    '|---|---|',
    ...(p.taskTitle ? [`| **Task** | ${p.taskTitle} |`] : []),
    `| **Screen** | ${p.view} |`,
    `| **Context** | ${p.context || '—'} |`,
    `| **Difficulty** | ${label} |`,
    `| **Submitted** | ${p.timestamp} |`,
    `| **URL** | ${p.url} |`,
    '',
    '---',
    '',
    '### What went wrong?',
    p.goal,
  ];

  if (screenshotUrls.length > 0) {
    lines.push('', `### Screenshots (${screenshotUrls.length})`);
    screenshotUrls.forEach((url, i) => {
      lines.push('', `**Screenshot ${i + 1}**`, `![Screenshot ${i + 1}](${url})`);
    });
  }

  lines.push('', '---', '*Reported via the in-app issue reporter.*');
  return lines.join('\n');
}

// ─── Session observation (feedbackType === 'session') ─────────────────────────

function buildSessionTitle(p: FeedbackPayload): string {
  const goal = p.goal.replace(/\n/g, ' ').trim();
  const max  = 65;
  return `[Session] ${goal.length > max ? goal.slice(0, max - 1) + '…' : goal}`;
}

function buildSessionBody(p: FeedbackPayload): string {
  const statusIcon = (s: SubtaskResult['status']) =>
    s === 'done' ? 'Done' : s === 'couldnt_finish' ? ' Could not finish' : '— Skipped';

  const ratingBar = (n: number | null | undefined) => {
    if (!n) return '—';
    return '+'.repeat(n) + '-'.repeat(5 - n) + ` ${n}/5`;
  };

  const lines = [
    '## Session Observation',
    '',
    '| Field | Value |',
    '|---|---|',
    `| **Task** | ${p.taskTitle || p.goal} |`,
    `| **Screen** | ${p.view} |`,
    `| **Submitted** | ${p.timestamp} |`,
    `| **URL** | ${p.url} |`,
  ];

  if (p.subtaskResults && p.subtaskResults.length > 0) {
    const todoSteps   = p.subtaskResults.filter(s => s.type === 'todo');
    const doneCount   = todoSteps.filter(s => s.status === 'done').length;
    lines.push('', '---', '', `### Steps (${doneCount} / ${todoSteps.length} action steps completed)`);

    for (const r of p.subtaskResults) {
      lines.push('');
      if (r.type === 'todo') {
        lines.push(`**☑ ${r.step}**  ->  ${statusIcon(r.status)}`);
        if (r.comment) lines.push(`> ${r.comment}`);
      } else if (r.type === 'yesno') {
        lines.push(`**? ${r.step}**  ->  ${r.answer === 'yes' ? 'Yes' : r.answer === 'no' ? ' No' : '— Not answered'}`);
        if (r.comment) lines.push(`> ${r.comment}`);
      } else if (r.type === 'rating') {
        lines.push(`**★ ${r.step}**  ->  ${ratingBar(r.rating)}`);
      } else if (r.type === 'question') {
        lines.push(`**% ${r.step}**`);
        if (r.response) lines.push(`> ${r.response}`);
      }
    }
  }

  if (p.additionalComment?.trim()) {
    lines.push('', '---', '', '### Additional comments', '', `> ${p.additionalComment.trim()}`);
  }

  lines.push('', '---', '*Auto-recorded from the in-app session panel.*');
  return lines.join('\n');
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    console.error('Missing GitHub env vars');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const payload = req.body as FeedbackPayload;
  if (!payload?.goal?.trim() || !payload?.result?.trim()) {
    return res.status(400).json({ error: 'goal and result are required' });
  }

  const isSession = payload.feedbackType === 'session';

  // ── Upload screenshots (issue reports only) ───────────────────────────────
  const screenshotUrls: string[] = [];
  if (!isSession) {
    for (const shot of payload.screenshots ?? []) {
      if (!shot?.data) continue;
      try {
        screenshotUrls.push(await uploadScreenshot(shot));
      } catch (e) {
        console.error('Screenshot upload error:', e);
      }
    }
  }

  // ── Build issue content ───────────────────────────────────────────────────
  const title  = isSession ? buildSessionTitle(payload)  : buildIssueTitle(payload);
  const body   = isSession ? buildSessionBody(payload)   : buildIssueBody(payload, screenshotUrls);
  const labels = isSession
    ? ['session-data', ...(payload.taskId ? [payload.taskId] : [])]
    : ['user-feedback', 'ux', ratingMeta(payload.rating ?? 3).ghLabel, ...(payload.taskId ? [payload.taskId] : [])];

  // ── Create GitHub issue ───────────────────────────────────────────────────
  const ghRes = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization:          `Bearer ${GITHUB_TOKEN}`,
        Accept:                 'application/vnd.github+json',
        'Content-Type':         'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body, labels }),
    },
  );

  if (!ghRes.ok) {
    const err = await ghRes.text();
    console.error('GitHub Issues API error:', err);
    return res.status(502).json({ error: 'Failed to create issue' });
  }

  const issue = await ghRes.json() as { number: number; html_url: string };
  return res.status(201).json({ issueNumber: issue.number, issueUrl: issue.html_url });
}
