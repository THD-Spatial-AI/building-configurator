// Vercel serverless function — receives feedback from the in-app widget,
// optionally uploads a screenshot to the repo, and creates a GitHub issue.
//
// Required environment variables (set in Vercel project settings):
//   GITHUB_TOKEN  — Personal Access Token with `repo` scope
//   GITHUB_OWNER  — repository owner (e.g. "your-org")
//   GITHUB_REPO   — repository name (e.g. "building-configurator")

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ScreenshotPayload {
  name:     string;   // original filename
  data:     string;   // base64-encoded image content
  mimeType: string;   // image/png | image/jpeg | image/webp
}

interface FeedbackPayload {
  goal:         string;
  result:       string;
  rating:       number;
  view:         string;
  context:      string;
  url:          string;
  timestamp:    string;
  screenshots:  ScreenshotPayload[];
}

function ratingMeta(r: number): { label: string; ghLabel: string } {
  if (r <= 2) return { label: `${r} – Easy`,        ghLabel: 'feedback: easy'    };
  if (r === 3) return { label: '3 – Moderate',       ghLabel: 'feedback: moderate'};
  if (r === 4) return { label: '4 – Difficult',      ghLabel: 'feedback: hard'    };
               return { label: '5 – Blocked/broken', ghLabel: 'feedback: blocked' };
}

/** Uploads a base64-encoded image to feedback-screenshots/ in the repo.
 *  Returns the raw CDN URL (cdn.jsdelivr.net mirrors raw.githubusercontent.com
 *  and serves images correctly in GitHub issue markdown). */
async function uploadScreenshot(
  owner: string,
  repo:  string,
  token: string,
  shot:  ScreenshotPayload,
): Promise<string> {
  // Sanitise filename and make it unique
  const safeName = shot.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path     = `feedback-screenshots/${Date.now()}-${safeName}`;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization:        `Bearer ${token}`,
        Accept:               'application/vnd.github+json',
        'Content-Type':       'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message: `chore: add feedback screenshot ${path}`,
        content: shot.data,   // GitHub Contents API expects raw base64
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Screenshot upload failed: ${err}`);
  }

  const json = await res.json() as { content: { html_url: string; download_url: string } };
  // Use the raw download URL — renders inline in GitHub markdown
  return json.content.download_url;
}

function buildIssueBody(p: FeedbackPayload, screenshotUrls: string[]): string {
  const { label } = ratingMeta(p.rating);
  const lines = [
    '## User Feedback',
    '',
    '| Field | Value |',
    '|---|---|',
    `| **Screen** | ${p.view} |`,
    `| **Context** | ${p.context || '—'} |`,
    `| **Difficulty** | ${label} |`,
    `| **Submitted** | ${p.timestamp} |`,
    `| **URL** | ${p.url} |`,
    '',
    '---',
    '',
    '### What were you trying to do?',
    p.goal,
    '',
    '### What happened / what did you expect?',
    p.result,
  ];

  if (screenshotUrls.length > 0) {
    lines.push('', `### Screenshots (${screenshotUrls.length})`);
    screenshotUrls.forEach((url, i) => {
      lines.push('', `**Screenshot ${i + 1}**`, `![Screenshot ${i + 1}](${url})`);
    });
  }

  lines.push(
    '',
    '---',
    '*Auto-generated from the in-app feedback widget.*',
    '*A GitHub Copilot agent can use the screenshot and context above to refine this into a concrete implementation issue.*',
  );

  return lines.join('\n');
}

function buildIssueTitle(p: FeedbackPayload): string {
  const prefix  = '[Feedback] ';
  const max     = 72 - prefix.length;
  const goal    = p.goal.replace(/\n/g, ' ').trim();
  return `${prefix}${goal.length > max ? goal.slice(0, max - 1) + '…' : goal}`;
}

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

  // Upload all screenshots (non-fatal if any fail)
  const screenshotUrls: string[] = [];
  for (const shot of payload.screenshots ?? []) {
    if (!shot?.data) continue;
    try {
      screenshotUrls.push(await uploadScreenshot(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, shot));
    } catch (e) {
      console.error('Screenshot upload error:', e);
    }
  }

  const { ghLabel } = ratingMeta(payload.rating ?? 3);

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
      body: JSON.stringify({
        title:  buildIssueTitle(payload),
        body:   buildIssueBody(payload, screenshotUrls),
        labels: ['user-feedback', 'ux', ghLabel],
      }),
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
