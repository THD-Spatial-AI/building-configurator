// Unified session panel — slides in/out from the right edge.
// Dark background separates it visually from the white configurator UI.
// Step types:
//   'todo'     → completion card with Yes/No + optional reason
//   'question' → open-ended textarea
//   'yesno'    → binary Yes/No + optional follow-up if No
// Submission types:
//   'session'  → step responses on Next/Finish (session-data label, aggregated later)
//   'issue'    → explicit UI bug report (user-feedback label, actionable immediately)

import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList, ChevronRight, ChevronLeft,
  CheckCircle2, Bug, Monitor, ImagePlus, Trash2, Send,
  MessageSquare, HelpCircle,
} from 'lucide-react';
import { TESTING_TASKS } from '@/app/config/testingTasks';
import type { StepType, TaskStep } from '@/app/config/testingTasks';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepState {
  status:   'pending' | 'done' | 'couldnt_finish';
  comment:  string;
  response: string;
  answer:   'yes' | 'no' | null;
  rating:   number | null;
}

interface ScreenshotData {
  name:     string;
  data:     string;
  mimeType: string;
  preview:  string;
}

type PanelView = 'task' | 'report' | 'report_done';

export interface SessionPanelProps {
  taskIndex:         number;
  collapsed:         boolean;
  onToggleCollapsed: () => void;
  onNextTask:        () => void;
  onPrevTask:        () => void;
  view:              string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initStepStates(count: number): StepState[] {
  return Array.from({ length: count }, () => ({
    status: 'pending', comment: '', response: '', answer: null, rating: null,
  }));
}

function deriveRating(states: StepState[], types: StepType[]): number {
  // Prefer average of explicit rating steps when available
  const ratingVals = types
    .map((t, i) => t === 'rating' ? states[i].rating : null)
    .filter((v): v is number => v !== null);
  if (ratingVals.length > 0) {
    const avg = ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length;
    // Map 1–5 (easy) to GitHub issue severity 1–5 (bad): invert so 5=easy → rating 1
    return Math.round(6 - avg);
  }
  const todos = types.map((t, i) => t === 'todo' ? states[i] : null).filter(Boolean) as StepState[];
  if (todos.length === 0) return 3;
  const done  = todos.filter(s => s.status === 'done').length;
  const ratio = done / todos.length;
  if (ratio >= 1)   return 1;
  if (ratio >= 0.6) return 2;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.2) return 4;
  return 5;
}

async function captureScreen(): Promise<string> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    const cleanup = () => { stream.getTracks().forEach(t => t.stop()); video.srcObject = null; };
    const track = stream.getVideoTracks()[0];
    track?.addEventListener('ended', () => { cleanup(); reject(new DOMException('ended', 'AbortError')); }, { once: true });
    video.onloadedmetadata = () => video.play();
    video.onplaying = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      cleanup();
      resolve(canvas.toDataURL('image/png'));
    };
    video.onerror = (e) => { cleanup(); reject(e); };
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StepTypeIcon({ type }: { type: StepType }) {
  if (type === 'question') return <MessageSquare className="size-3.5 text-slate-400 shrink-0 mt-0.5" />;
  if (type === 'yesno')    return <HelpCircle    className="size-3.5 text-slate-400 shrink-0 mt-0.5" />;
  return null;
}

const RATING_COLORS = [
  { idle: 'border-red-800/60    bg-red-950/50    text-red-400',    active: 'border-red-500    bg-red-500    text-white' },
  { idle: 'border-orange-800/60 bg-orange-950/50 text-orange-400', active: 'border-orange-500 bg-orange-500 text-white' },
  { idle: 'border-amber-700/60  bg-amber-950/50  text-amber-400',  active: 'border-amber-400  bg-amber-400  text-white' },
  { idle: 'border-lime-800/60   bg-lime-950/50   text-lime-400',   active: 'border-lime-500   bg-lime-500   text-white' },
  { idle: 'border-green-800/60  bg-green-950/50  text-green-400',  active: 'border-green-500  bg-green-500  text-white' },
];

function RatingButtons({ step, value, onChange }: { step: TaskStep; value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 justify-center">
        {[1, 2, 3, 4, 5].map((n) => {
          const col = RATING_COLORS[n - 1];
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(value === n ? 0 : n)}
              className={cn(
                'flex size-8 items-center justify-center rounded-lg border text-xs font-bold cursor-pointer transition-all',
                value === n ? col.active : col.idle,
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(step.lowLabel || step.highLabel) && (
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[9px] text-red-500/70">{step.lowLabel}</span>
          <span className="text-[9px] text-green-500/70">{step.highLabel}</span>
        </div>
      )}
    </div>
  );
}

// ─── Shared input/textarea style on dark ─────────────────────────────────────

const darkInput   = 'w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none';
const darkTextarea = `${darkInput} resize-none`;

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionPanel({
  taskIndex, collapsed, onToggleCollapsed, onNextTask, onPrevTask, view,
}: SessionPanelProps) {
  const allDone = taskIndex >= TESTING_TASKS.length;
  const task    = allDone ? null : TESTING_TASKS[taskIndex];

  const [panelView,    setPanelView]    = useState<PanelView>('task');
  const [stepStates,   setStepStates]   = useState<StepState[]>(task ? initStepStates(task.steps.length) : []);
  const [taskComment,  setTaskComment]  = useState('');
  const [reportText,   setReportText]   = useState('');
  const [screenshots,  setScreenshots]  = useState<ScreenshotData[]>([]);
  const [capturing,    setCapturing]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setStepStates(initStepStates(task.steps.length));
      setTaskComment('');
      setPanelView('task');
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIndex]);

  // ── Step state ────────────────────────────────────────────────────────────

  const updateStep = (i: number, patch: Partial<StepState>) =>
    setStepStates(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const toggleTodo = (i: number, status: 'done' | 'couldnt_finish') =>
    setStepStates(prev => prev.map((s, idx) =>
      idx !== i ? s : { ...s, status: s.status === status ? 'pending' : status }
    ));

  // ── Session submission ────────────────────────────────────────────────────

  const submitSession = async () => {
    if (!task) return;
    const hasInteraction = stepStates.some((s, i) => {
      const type = task.steps[i].type;
      if (type === 'todo')     return s.status !== 'pending';
      if (type === 'question') return s.response.trim() !== '';
      if (type === 'yesno')    return s.answer !== null;
      if (type === 'rating')   return s.rating !== null;
      return false;
    }) || taskComment.trim() !== '';
    if (!hasInteraction) return;

    const types          = task.steps.map(s => s.type);
    const subtaskResults = stepStates.map((s, i) => {
      const { type, text } = task.steps[i];
      if (type === 'todo')     return { type, step: text, status: s.status, ...(s.comment ? { comment: s.comment } : {}) };
      if (type === 'question') return { type, step: text, response: s.response };
      if (type === 'rating')   return { type, step: text, rating: s.rating };
      /* yesno */              return { type, step: text, answer: s.answer, ...(s.comment ? { comment: s.comment } : {}) };
    });

    const doneCount = stepStates.filter((s, i) => task.steps[i].type === 'todo' && s.status === 'done').length;
    const todoCount = task.steps.filter(s => s.type === 'todo').length;

    try {
      await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal:      `Task ${taskIndex + 1} — ${task.title}`,
          result:    todoCount > 0 ? `${doneCount} of ${todoCount} action steps completed.` : 'Observation task.',
          rating:    deriveRating(stepStates, types),
          view,      context: 'Session task completion',
          url:       window.location.href,
          timestamp: new Date().toISOString(),
          screenshots:    [],
          taskId:         task.id,
          taskTitle:      task.title,
          feedbackType:   'session',
          subtaskResults,
          ...(taskComment.trim() ? { additionalComment: taskComment.trim() } : {}),
        }),
      });
    } catch { /* non-fatal */ }
  };

  const handleNext = async () => { await submitSession(); onNextTask(); };

  // ── Screenshot capture ────────────────────────────────────────────────────

  const handleCapture = async () => {
    setError(null); setCapturing(true);
    await new Promise(r => setTimeout(r, 120));
    try {
      const preview = await captureScreen();
      setScreenshots(prev => [...prev, { name: `screenshot-${Date.now()}.png`, data: preview.split(',')[1], mimeType: 'image/png', preview }]);
    } catch { /* cancelled */ }
    finally { setCapturing(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      try {
        const preview = await readFile(file);
        setScreenshots(prev => [...prev, { name: file.name, data: preview.split(',')[1], mimeType: file.type, preview }]);
      } catch { setError('Could not read file.'); }
    }
  };

  // ── Issue submission ──────────────────────────────────────────────────────

  const submitIssue = async () => {
    if (!reportText.trim()) return;
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal:      reportText.trim(),
          result:    reportText.trim(),
          rating:    4,
          view,
          context:   task ? `Task ${taskIndex + 1} — ${task.title}` : 'Post-session',
          url:       window.location.href,
          timestamp: new Date().toISOString(),
          screenshots: screenshots.map(({ name, data, mimeType }) => ({ name, data, mimeType })),
          taskId:       task?.id    ?? null,
          taskTitle:    task?.title ?? null,
          feedbackType: 'issue',
        }),
      });
      if (!res.ok) throw new Error();
      setPanelView('report_done');
      setReportText(''); setScreenshots([]);
    } catch { setError('Could not submit. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const closeReport = () => { setPanelView('task'); setReportText(''); setScreenshots([]); setError(null); };

  // ── Layout shell ──────────────────────────────────────────────────────────
  //
  // translate-x-[320px] slides the 320px panel off-screen while the 32px
  // pull tab stays visible at the viewport right edge.

  const shell = (children: React.ReactNode, footer?: React.ReactNode) => (
    <>
      {/* ── Floating report button — always visible at bottom-right, context-aware ── */}
      <button
        type="button"
        onClick={() => { if (collapsed) onToggleCollapsed(); setPanelView('report'); }}
        title={`Report an issue (current view: ${view})`}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-orange-700/40 bg-slate-900/90 backdrop-blur-sm px-3 py-2 text-xs font-semibold text-orange-400 shadow-lg hover:bg-slate-800 hover:border-orange-600/60 cursor-pointer transition-colors"
      >
        <Bug className="size-3.5" /> Report an issue
      </button>

      {/* ── Task panel ── */}
      <div className="fixed right-0 top-4 bottom-16 z-50 flex items-stretch">
        <div className={cn(
          'flex items-stretch h-full transition-transform duration-300 ease-in-out',
          collapsed ? 'translate-x-[320px]' : 'translate-x-0',
        )}>
          {/* Pull tab */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Show tasks' : 'Hide tasks'}
            className="w-8 shrink-0 bg-slate-800 hover:bg-slate-700 border-y border-l border-slate-600 rounded-l-xl flex flex-col items-center justify-center gap-3 py-8 cursor-pointer transition-colors shadow-xl"
          >
            <ChevronLeft className={cn('size-3.5 text-slate-300 transition-transform duration-300', !collapsed && 'rotate-180')} />
            <span className="text-[13px] font-semibold text-slate-300 select-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Tasks
            </span>
          </button>

          {/* Panel */}
          <div className="w-80 bg-slate-900 border-y border-l border-slate-700 shadow-2xl flex flex-col h-full overflow-hidden">
            {children}
            {footer}
          </div>
        </div>
      </div>
    </>
  );

  // ── Panel header ──────────────────────────────────────────────────────────

  const panelHeader = (
    <div className="shrink-0 px-4 pt-4 pb-0">
      {panelView === 'report' || panelView === 'report_done' ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="size-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Report an issue</span>
          </div>
          <button type="button" onClick={closeReport}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
            <ChevronLeft className="size-3.5" /> Back to tasks
          </button>
        </div>
      ) : allDone ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-slate-400" />
          <span className="text-sm font-semibold text-white">Session complete</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="size-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Task {taskIndex + 1} of {TESTING_TASKS.length}</span>
            </div>
            <span className="text-[11px] text-slate-500">{task!.timeEstimate}</span>
          </div>
          <p className="text-base font-bold text-white leading-snug">{task!.title}</p>
          <p className="text-[12px] text-slate-400 leading-snug">{task!.description}</p>
        </div>
      )}
    </div>
  );

  // ── Report form ───────────────────────────────────────────────────────────

  const reportBody = (
    <div className={cn('flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3', capturing && 'opacity-0 pointer-events-none')}>
      {panelView === 'report_done' ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="size-9 text-green-400" />
          <p className="text-sm font-semibold text-white">Issue reported</p>
          <p className="text-xs text-slate-400 leading-snug">Thank you — this has been logged and will be reviewed.</p>
          <button type="button" onClick={closeReport}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 cursor-pointer transition-colors">
            Back to tasks
          </button>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-slate-400 leading-snug">
            Describe what went wrong or what was confusing — no technical detail needed.
          </p>
          <textarea
            autoFocus rows={5} value={reportText}
            onChange={e => setReportText(e.target.value)}
            placeholder="e.g. I couldn't find where to enter the floor area…"
            className={darkTextarea}
          />

          {screenshots.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {screenshots.map((s, i) => (
                <div key={i} className="relative group rounded-md overflow-hidden border border-slate-700 aspect-video bg-slate-800">
                  <img src={s.preview} alt={`screenshot ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setScreenshots(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Trash2 className="size-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={handleCapture} disabled={capturing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:border-slate-500 cursor-pointer transition-colors disabled:opacity-40">
              <Monitor className="size-3.5" />{capturing ? 'Select…' : 'Screenshot'}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-600 bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:border-slate-500 cursor-pointer transition-colors">
              <ImagePlus className="size-3.5" />Upload
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleFileChange} />
          </div>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <button type="button" disabled={!reportText.trim() || submitting} onClick={submitIssue}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-primary/90 cursor-pointer transition-colors">
            {submitting ? <span className="animate-pulse">Sending…</span> : <><Send className="size-3.5" /> Submit issue</>}
          </button>

          {task && <p className="text-[10px] text-slate-600 truncate">📋 {task.title} · 📍 {view}</p>}
        </>
      )}
    </div>
  );

  // ── Task body ─────────────────────────────────────────────────────────────

  const taskBody = !task ? null : (
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 flex flex-col gap-3">
      <div className="border-t border-slate-700/60" />
      <div className="flex flex-col gap-3">
        {task.steps.map((step, i) => {
          const s = stepStates[i] ?? { status: 'pending', comment: '', response: '', answer: null };

          // ── Todo card ─────────────────────────────────────────────────
          if (step.type === 'todo') {
            return (
              <div key={i} className={cn(
                'rounded-lg border p-3 flex flex-col gap-2.5 transition-colors',
                s.status === 'done'
                  ? 'border-slate-600 bg-slate-700/50'
                  : s.status === 'couldnt_finish'
                  ? 'border-slate-600 bg-slate-700/50'
                  : 'border-slate-700 bg-slate-800',
              )}>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Step {i + 1}</span>
                <p className={cn(
                  'text-[12px] leading-snug -mt-1',
                  s.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200',
                )}>
                  {step.text}
                </p>
                <p className="text-[11px] font-medium text-slate-500">Were you able to complete this?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => toggleTodo(i, 'done')}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-xs font-semibold cursor-pointer transition-colors',
                      s.status === 'done'
                        ? 'border-slate-400 bg-slate-600 text-slate-100'
                        : 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-100',
                    )}>
                    Yes, done ✓
                  </button>
                  <button type="button" onClick={() => toggleTodo(i, 'couldnt_finish')}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-xs font-semibold cursor-pointer transition-colors',
                      s.status === 'couldnt_finish'
                        ? 'border-slate-400 bg-slate-600 text-slate-100'
                        : 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-100',
                    )}>
                    No, I couldn't
                  </button>
                </div>
                {s.status === 'couldnt_finish' && (
                  <textarea rows={2} value={s.comment}
                    onChange={e => updateStep(i, { comment: e.target.value })}
                    placeholder="What went wrong, or what stopped you?"
                    className="w-full resize-none rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-slate-400 focus:outline-none"
                  />
                )}
              </div>
            );
          }

          // ── Question card ─────────────────────────────────────────────
          if (step.type === 'question') {
            return (
              <div key={i} className="rounded-lg border border-slate-700 bg-slate-800 p-3 flex flex-col gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Step {i + 1}</span>
                <div className="flex items-start gap-2 -mt-1">
                  <StepTypeIcon type="question" />
                  <p className="text-[12px] font-medium text-slate-200 leading-snug">{step.text}</p>
                </div>
                <textarea rows={3} value={s.response}
                  onChange={e => updateStep(i, { response: e.target.value })}
                  placeholder="Your answer…"
                  className={darkTextarea}
                />
              </div>
            );
          }

          // ── Yes/No card ───────────────────────────────────────────────
          if (step.type === 'yesno') {
            return (
              <div key={i} className={cn(
                'rounded-lg border p-3 flex flex-col gap-2.5 transition-colors',
                s.answer === 'yes' ? 'border-green-700 bg-green-900/30'
                : s.answer === 'no'  ? 'border-red-700 bg-red-900/30'
                :                      'border-slate-700 bg-slate-800',
              )}>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Step {i + 1}</span>
                <div className="flex items-start gap-2 -mt-1">
                  <StepTypeIcon type="yesno" />
                  <p className="text-[12px] font-medium text-slate-200 leading-snug">{step.text}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => updateStep(i, { answer: s.answer === 'yes' ? null : 'yes', comment: '' })}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-xs font-semibold cursor-pointer transition-colors',
                      s.answer === 'yes'
                        ? 'border-green-500 bg-green-600 text-white'
                        : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-green-700 hover:bg-green-900/40 hover:text-green-300',
                    )}>
                    Yes
                  </button>
                  <button type="button"
                    onClick={() => updateStep(i, { answer: s.answer === 'no' ? null : 'no' })}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-xs font-semibold cursor-pointer transition-colors',
                      s.answer === 'no'
                        ? 'border-red-500 bg-red-600 text-white'
                        : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-red-700 hover:bg-red-900/40 hover:text-red-300',
                    )}>
                    No
                  </button>
                </div>
                {s.answer === 'no' && (
                  <input type="text" value={s.comment}
                    onChange={e => updateStep(i, { comment: e.target.value })}
                    placeholder="What was confusing or missing? (optional)"
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-slate-400 focus:outline-none"
                  />
                )}
              </div>
            );
          }

          // ── Rating card ───────────────────────────────────────────────
          if (step.type === 'rating') {
            return (
              <div key={i} className={cn(
                'rounded-lg border p-3 flex flex-col gap-2.5 transition-colors',
                s.rating !== null ? 'border-slate-600 bg-slate-700/50' : 'border-slate-700 bg-slate-800',
              )}>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Step {i + 1}</span>
                <p className="text-[12px] font-medium text-slate-200 leading-snug -mt-1">{step.text}</p>
                <RatingButtons
                  step={step}
                  value={s.rating}
                  onChange={(v) => updateStep(i, { rating: v === 0 ? null : v })}
                />
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* ── Anything else? ── */}
      <div className="border-t border-slate-700/60 pt-3 flex flex-col gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Anything else?</p>
        <textarea
          rows={2}
          value={taskComment}
          onChange={e => setTaskComment(e.target.value)}
          placeholder="Optional comments or observations…"
          className="w-full resize-none rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-slate-400 focus:outline-none"
        />
      </div>

    </div>
  );

  // ── Footer ────────────────────────────────────────────────────────────────

  const taskFooter = (
    <div className="px-4 pb-4 flex flex-col gap-2 shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1">
          {TESTING_TASKS.map((t, i) => (
            <div key={t.id} className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < taskIndex ? 'bg-slate-500' : i === taskIndex ? 'bg-slate-400' : 'bg-slate-700',
            )} />
          ))}
          <span className="ml-1.5 text-[10px] text-slate-600 shrink-0">{taskIndex + 1} / {TESTING_TASKS.length}</span>
        </div>
        <div className="flex gap-1 shrink-0">
          {taskIndex > 0 && (
            <button type="button" onClick={onPrevTask} title="Previous task"
              className="flex items-center justify-center size-7 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200 cursor-pointer transition-colors">
              <ChevronLeft className="size-4" />
            </button>
          )}
          <button type="button" onClick={handleNext}
            className="flex items-center gap-1 rounded-lg bg-slate-200 hover:bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 cursor-pointer transition-colors">
            {taskIndex === TESTING_TASKS.length - 1 ? 'Finish' : 'Next'}
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Body selection ────────────────────────────────────────────────────────

  const doneBody = (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-green-500/15">
        <CheckCircle2 className="size-7 text-green-400" />
      </div>
      <div>
        <p className="text-sm font-bold text-white">All tasks complete</p>
        <p className="text-xs text-slate-400 leading-snug mt-1.5">
          Thank you — feel free to keep exploring the tool.
          Use the <span className="text-orange-400 font-semibold">Report an issue</span> button
          if you spot anything worth noting.
        </p>
      </div>
    </div>
  );

  const activeBody = (() => {
    if (panelView === 'report' || panelView === 'report_done') return reportBody;
    if (allDone) return doneBody;
    return taskBody;
  })();

  const showFooter = panelView === 'task' && !allDone;
  return shell(<>{panelHeader}{activeBody}</>, showFooter ? taskFooter : undefined);
}
