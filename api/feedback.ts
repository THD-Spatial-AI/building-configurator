// Vercel serverless function — receives feedback from the in-app widget,
// uploads screenshots to Vercel Blob storage, and creates a GitHub issue
// with the screenshots embedded in the body.
//
// Required environment variables (set in Vercel project settings):
//   GITHUB_TOKEN       — PAT with Issues: read/write (or classic repo scope)
//   GITHUB_OWNER       — repository owner  (e.g. "your-org")
//   GITHUB_REPO        — repository name   (e.g. "building-configurator")
//   BLOB_READ_WRITE_TOKEN — auto-set by Vercel when a Blob store is linked

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

interface ScreenshotPayload {
  name:     string;   // original filename
  data:     string;   // base64-encoded image content (no data-URI prefix)
  mimeType: string;   // image/png | image/jpeg | image/webp
}

interface FeedbackPayload {
  goal:        string;
  result:      string;
  rating:      number;
  view:        string;
  context:     string;
  url:         string;
  timestamp:   string;
  screenshots: ScreenshotPayload[];
}

function ratingMeta(r: number): { label: string; ghLabel: string } {
  if (r <= 2) return { label: `${r} – Easy`,        ghLabel: 'feedback: easy'    };
  if (r === 3) return { label: '3 – Moderate',       ghLabel: 'feedback: moderate'};
  if (r === 4) return { label: '4 – Difficult',      ghLabel: 'feedback: hard'    };
               return { label: '5 – Blocked/broken', ghLabel: 'feedback: blocked' };
}

/** Uploads a base64-encoded image to Vercel Blob and returns a public CDN URL. */
async function uploadScreenshot(shot: ScreenshotPayload): Promise<string> {
  const binary   = Buffer.from(shot.data, 'base64');
  const safeName = shot.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path     = `feedback-screenshots/${Date.now()}-${safeName}`;

  const { url } = await put(path, binary, {
    access:      'public',
    contentType: shot.mimeType || 'image/png',
  });

  return url;
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
  );

  return lines.join('\n');
}

function buildIssueTitle(p: FeedbackPayload): string {
  const prefix = '[Feedback] ';
  const max    = 72 - prefix.length;
  const goal   = p.goal.replace(/\n/g, ' ').trim();
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

  // ── Upload screenshots to Vercel Blob ─────────────────────────────────────
  const screenshotUrls: string[] = [];
  for (const shot of payload.screenshots ?? []) {
    if (!shot?.data) continue;
    try {
      screenshotUrls.push(await uploadScreenshot(shot));
    } catch (e) {
      console.error('Screenshot upload error:', e);
      // Non-fatal — issue is still created without this screenshot
    }
  }

  // ── Create GitHub issue ───────────────────────────────────────────────────
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
