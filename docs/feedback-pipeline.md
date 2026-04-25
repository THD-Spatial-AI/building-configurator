# Feedback Pipeline

End-to-end system for collecting, storing, and triaging user feedback — from an in-app interaction to a structured card on the organisation project board, with no manual steps.

---

## How it works

There are **two entry points** and they produce **two different issue types**. Both go through the same Vercel API layer, but are handled differently downstream.

```mermaid
flowchart TD
    A(["User"])

    A --> B["Session Panel\n(task-based)"]
    A --> C["Report an Issue\n(quick form)"]

    B --> D["POST /api/feedback\nfeedbackType: 'session'"]
    C --> E["POST /api/feedback\nfeedbackType: 'issue'"]

    subgraph Vercel ["Vercel — serverless API"]
        D --> F["Upload screenshots\nVercel Blob"]
        E --> F
        F --> G["GitHub Issues API"]
    end

    G --> H["[Session] issue"]
    G --> I["[Feedback] issue"]

    subgraph Actions ["GitHub Actions"]
        H --> J["add-to-org-project.yml\n-> Project board"]
        I --> K["refine-feedback.yml\n-> gpt-4o rewrite\n-> [Issue] on board\n-> close original"]
    end
```

---

## Entry points

| | Session Panel | Report an Issue |
|---|---|---|
| **Component** | `SessionPanel.tsx` | `FeedbackWidget.tsx` |
| **Trigger** | Sidebar tab (right edge) | Floating button (bottom-right) |
| **Mode** | Guided task walkthrough | Free-form 4-step form |
| **Issue type** | `[Session]` | `[Feedback]` |
| **AI refinement** | No — raw data preserved | Yes — rewritten by gpt-4o |
| **Project board** | `add-to-org-project.yml` | `refine-feedback.yml` |

---

## Entry point 1 — Session Panel (task-based)

Each testing session is structured around a named task. The user works through a series of steps, answers inline questions, and submits at the end. Every session produces one `[Session]` GitHub issue.

### Task flow

```mermaid
flowchart LR
    T["TestingTask\n(from testingTasks.ts)"]
    T --> S["SessionPanel renders steps"]

    S --> ST1["todo\nDid / Couldn't finish"]
    S --> ST2["rating\n1–5 scale"]
    S --> ST3["yesno\nYes / No"]
    S --> ST4["question\nOpen text"]

    ST1 & ST2 & ST3 & ST4 --> R["User submits session"]
    R --> SC["Rating derived\n(explicit rating steps\nor todo completion ratio)"]
    SC --> API["POST /api/feedback\nfeedbackType: 'session'"]
```

### Step types

| Type | UI | Captured data |
|---|---|---|
| `todo` | Checkbox — Done / Couldn't finish | `status: 'done' \| 'couldnt_finish'` |
| `rating` | 1–5 emoji scale | `rating: number` |
| `yesno` | Yes / No buttons | `answer: 'yes' \| 'no'` |
| `question` | Free-text area | `response: string` |

### Session rating derivation

The overall session rating is derived automatically — users do not set it manually.

```
If explicit rating steps exist -> average of those ratings (inverted: 5=easy -> low severity)
Otherwise -> todo completion ratio -> mapped to 1–5 severity scale
```

This is sent as `rating` in the payload and becomes the difficulty label on the GitHub issue.

---

## Entry point 2 — Report an Issue (quick form)

A lightweight 4-step form for ad-hoc issue reports, independent of any task session.

```mermaid
flowchart LR
    S1["Step 1\nWhat were you\ntrying to do?"] -->
    S2["Step 2\nWhat happened vs\nwhat you expected?"] -->
    S3["Step 3\nDifficulty rating\n Positive -> Negative"] -->
    S4["Step 4\nScreenshots\n(capture or upload)"] -->
    SUB["POST /api/feedback\nfeedbackType: 'issue'"]
```

The widget captures `view` (current screen, e.g. `Configure`) and `url` from the app automatically — no manual tagging needed.

---

## Vercel API layer

**File:** `api/feedback.ts` — serverless function, same domain as the app (no CORS)

```mermaid
sequenceDiagram
    participant App
    participant API as Vercel API /api/feedback
    participant Blob as Vercel Blob
    participant GH as GitHub Issues

    App->>API: POST JSON payload
    loop each screenshot
        API->>Blob: Upload image (base64 -> PNG)
        Blob-->>API: Public CDN URL
    end
    API->>GH: Create issue with embedded image URLs
    GH-->>API: Issue URL
    API-->>App: 200 OK
```

### Issue formats

| Field | `[Session]` issue | `[Feedback]` issue |
|---|---|---|
| **Title** | `[Session] <task title>` | `[Feedback] <user goal>` |
| **Body** | Task info + step-by-step results table | Goal, result, rating, screenshots |
| **Labels** | `session-data`, task-id | `user-feedback`, `ux`, difficulty label |

### Difficulty labels

| Rating | Label applied |
|---|---|
| 1 | `feedback: easy` |
| 2 | `feedback: easy` |
| 3 | `feedback: moderate` |
| 4 | `feedback: hard` |
| 5 | `feedback: blocked` |

### Environment variables

Set in the Vercel project dashboard — never committed to the repo.

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | PAT with Issues: read/write |
| `GITHUB_OWNER` | e.g. `THD-Spatial-AI` |
| `GITHUB_REPO` | e.g. `building-configurator` |
| `BLOB_READ_WRITE_TOKEN` | Auto-provisioned when Blob store is linked |

---

## GitHub Actions

### Workflow overview

```mermaid
flowchart TD
    NEW["New issue opened"]
    NEW --> CHECK{"Title starts with [Feedback]?"}

    CHECK -- Yes --> RF["refine-feedback.yml"]
    CHECK -- No --> AP["add-to-org-project.yml"]

    RF --> AI["GitHub Models gpt-4o\nrewrite into structured issue"]
    AI --> NI["Create [Issue] with:\n· type label (bug/enhancement/ux)\n· priority label\n· original screenshots\n· raw feedback in <details>"]
    NI --> ADD["Add [Issue] to project board\n(Projects v2 GraphQL)"]
    NI --> CLOSE["Close original [Feedback] issue\nstate: completed"]

    AP --> BOARD["Add to project board\n(actions/add-to-project)"]
```

### Workflows

| Workflow | Trigger | Handles | Output |
|---|---|---|---|
| `refine-feedback.yml` | `[Feedback]` issue opened (human only) | Issue reports | Refined `[Issue]`, project card, closes raw |
| `add-to-org-project.yml` | Any issue/PR opened (except `[Feedback]`) | Sessions, PRs, regular issues | Project card |

### `refine-feedback.yml` — AI refinement detail

The raw feedback body is sent to `gpt-4o` (via GitHub Models) with a senior UX engineer system prompt. The model returns structured JSON:

```
title     -> refined issue title (no prefix)
type      -> bug | enhancement | ux
priority  -> low | medium | high | critical
body      -> Markdown with: Summary · User Goal · Observed Behaviour ·
            Expected Behaviour · Steps to Reproduce · Affected Component ·
            Suggested Fix · Priority Rationale
```

The refined issue preserves the original screenshots and folds the raw feedback into a collapsible `<details>` block.

### Required secrets

| Secret | Scope | Used by |
|---|---|---|
| `ADD_TO_PROJECT_PAT` | `project` (org level) | Both workflows |
| `GITHUB_TOKEN` | Automatic | Provided by Actions runtime |

> `refine-feedback.yml` skips bot-created issues (actor check) to prevent trigger loops when the workflow itself creates the refined `[Issue]`.

---

## Payload reference

Both entry points post to the same endpoint. The `feedbackType` field determines downstream behaviour.

| Field | Type | Required | Notes |
|---|---|---|---|
| `feedbackType` | `'issue' \| 'session'` | Yes | Routes issue format |
| `goal` | `string` | Yes | User's stated objective |
| `result` | `string` | Yes | What happened |
| `rating` | `1–5` | Yes | Difficulty / severity |
| `view` | `string` | Yes | Current screen name |
| `url` | `string` | Yes | Page URL at submission |
| `timestamp` | `string` | Yes | ISO 8601 |
| `screenshots` | `ScreenshotPayload[]` | No | base64 + mimeType |
| `taskId` | `string` | Session only | Links to task config |
| `taskTitle` | `string` | Session only | Human-readable title |
| `subtaskResults` | `SubtaskResult[]` | Session only | Per-step responses |
| `additionalComment` | `string` | No | Free-text observation |

---

## Self-hosting without Vercel

The pipeline is built on Vercel for convenience, but the architecture is not Vercel-specific. The same pattern works on any platform:

```mermaid
flowchart LR
    UI["Frontend\n(any host)"] -->|POST /api/feedback| SRV["API server\n(Node / Python / etc.)"]
    SRV -->|store images| STORE["Any object storage\n(S3, R2, MinIO, etc.)"]
    SRV -->|create issue| GH["GitHub Issues API\n(or GitLab / Linear / Jira)"]
    GH -->|webhook| AUTO["Automation\n(GitHub Actions / CI)"]
```

| Vercel component | Self-hosted equivalent |
|---|---|
| Serverless function | Express/Fastify route on any Node server |
| Vercel Blob | AWS S3, Cloudflare R2, MinIO, or any CDN-backed storage |
| Vercel env vars | `.env` file or secret manager (Vault, Doppler, etc.) |
| GitHub Actions trigger | Any webhook consumer |

The GitHub Issues + Actions automation layer is independent of where the app is hosted — only the serverless function and blob storage need replacing.
