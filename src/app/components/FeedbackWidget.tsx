// Floating feedback widget — always visible, context-aware.
// Submits to /api/feedback which creates a GitHub issue with optional screenshots.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  MessageSquarePlus, X, Send, CheckCircle2, ChevronRight,
  Monitor, ImagePlus, Trash2, Crop, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScreenshotData {
  name:     string;
  data:     string;   // base64, no data-URI prefix
  mimeType: string;
  preview:  string;   // data-URI for <img> preview
}

interface FeedbackWidgetProps {
  view:      string;
  context?:  string;
}

type Step = 'closed' | 'goal' | 'result' | 'rating' | 'screenshot' | 'done';

// ─── Crop overlay ─────────────────────────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }

interface CropOverlayProps {
  preview:    string;
  onConfirm:  (shot: ScreenshotData) => void;
  onCancel:   () => void;
}

function CropOverlay({ preview, onConfirm, onCancel }: CropOverlayProps) {
  const imgRef   = useRef<HTMLImageElement>(null);
  const [sel,    setSel]    = useState<Rect | null>(null);
  const [start,  setStart]  = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const toImageCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const r = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(clientX - r.left, r.width)),
      y: Math.max(0, Math.min(clientY - r.top,  r.height)),
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pt = toImageCoords(e.clientX, e.clientY);
    setStart(pt);
    setSel(null);
    setDragging(true);
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !start) return;
    const pt = toImageCoords(e.clientX, e.clientY);
    setSel({
      x: Math.min(start.x, pt.x),
      y: Math.min(start.y, pt.y),
      w: Math.abs(pt.x - start.x),
      h: Math.abs(pt.y - start.y),
    });
  }, [dragging, start, toImageCoords]);

  const onMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const cropAndConfirm = (cropRect: Rect | null) => {
    const img    = imgRef.current!;
    const canvas = document.createElement('canvas');
    const rect   = img.getBoundingClientRect();
    const scaleX = img.naturalWidth  / rect.width;
    const scaleY = img.naturalHeight / rect.height;

    if (cropRect && cropRect.w > 4 && cropRect.h > 4) {
      canvas.width  = cropRect.w * scaleX;
      canvas.height = cropRect.h * scaleY;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img,
        cropRect.x * scaleX, cropRect.y * scaleY,
        cropRect.w * scaleX, cropRect.h * scaleY,
        0, 0, canvas.width, canvas.height,
      );
    } else {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
    }

    const result = canvas.toDataURL('image/png');
    onConfirm({
      name:     `screenshot-${Date.now()}.png`,
      data:     result.split(',')[1],
      mimeType: 'image/png',
      preview:  result,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
      {/* Top bar */}
      <div className="flex items-center justify-between shrink-0 px-4 py-3 bg-slate-900 border-b border-slate-700">
        <div>
          <p className="text-sm font-semibold text-white">Select area to crop</p>
          <p className="text-[11px] text-slate-400">Click and drag on the screenshot to select a region, then click Crop</p>
        </div>
        <div className="flex items-center gap-2">
          {sel && sel.w > 4 && sel.h > 4 && (
            <button
              type="button"
              onClick={() => cropAndConfirm(sel)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 cursor-pointer transition-colors"
            >
              <Crop className="size-3.5" /> Crop selection
            </button>
          )}
          <button
            type="button"
            onClick={() => cropAndConfirm(null)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-600 cursor-pointer transition-colors"
          >
            <Check className="size-3.5" /> Use full screenshot
          </button>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white cursor-pointer ml-1">
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6 select-none">
        <div className="relative" onMouseDown={onMouseDown} style={{ cursor: 'crosshair' }}>
          <img
            ref={imgRef}
            src={preview}
            alt="captured screenshot"
            className="max-w-full max-h-[calc(100vh-120px)] rounded shadow-2xl block"
            draggable={false}
          />
          {/* Dim overlay outside selection */}
          {sel && sel.w > 2 && sel.h > 2 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width="100%" height="100%"
            >
              <defs>
                <mask id="crop-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <rect x={sel.x} y={sel.y} width={sel.w} height={sel.h} fill="black" />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#crop-mask)" />
              <rect x={sel.x} y={sel.y} width={sel.w} height={sel.h}
                fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3" />
              {/* Corner handles */}
              {[[sel.x, sel.y],[sel.x+sel.w, sel.y],[sel.x, sel.y+sel.h],[sel.x+sel.w, sel.y+sel.h]].map(([cx,cy], i) => (
                <rect key={i} x={cx-4} y={cy-4} width={8} height={8} fill="white" stroke="#3b82f6" strokeWidth="1.5" rx="1" />
              ))}
              <text x={sel.x + sel.w / 2} y={sel.y - 6} textAnchor="middle"
                fontSize="11" fill="white" style={{ userSelect: 'none' }}>
                {Math.round(sel.w)} × {Math.round(sel.h)}
              </text>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Screen capture ───────────────────────────────────────────────────────────

async function captureScreen(): Promise<string> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;

    const cleanup = () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };

    // If the user stops sharing before the first frame arrives (e.g. pressing
    // Escape after selecting a window), the track ends without onplaying ever
    // firing — reject so the caller's finally block can reset state.
    const track = stream.getVideoTracks()[0];
    track?.addEventListener('ended', () => {
      cleanup();
      reject(new DOMException('Screen share ended before capture', 'AbortError'));
    }, { once: true });

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

// ─── Rating options ───────────────────────────────────────────────────────────

const RATING_OPTIONS = [
  { value: 1, label: 'Very easy', emoji: '😊' },
  { value: 2, label: 'Easy',      emoji: '🙂' },
  { value: 3, label: 'OK',        emoji: '😐' },
  { value: 4, label: 'Difficult', emoji: '😕' },
  { value: 5, label: 'Blocked',   emoji: '😤' },
];

// ─── Main widget ──────────────────────────────────────────────────────────────

export function FeedbackWidget({ view, context = '' }: FeedbackWidgetProps) {
  const [step,        setStep]        = useState<Step>('closed');
  const [goal,        setGoal]        = useState('');
  const [result,      setResult]      = useState('');
  const [rating,      setRating]      = useState<number | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotData[]>([]);
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [capturing,   setCapturing]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('closed'); setGoal(''); setResult('');
    setRating(null); setScreenshots([]); setCropPreview(null); setError(null);
  };

  const addScreenshot = (shot: ScreenshotData) =>
    setScreenshots((prev) => [...prev, shot]);

  const removeScreenshot = (idx: number) =>
    setScreenshots((prev) => prev.filter((_, i) => i !== idx));

  const handleCapture = async () => {
    setError(null);
    setCapturing(true); // hides the panel
    // Wait one frame so the panel is removed from the DOM before the
    // screen-share picker opens — otherwise it appears in the capture.
    await new Promise((r) => setTimeout(r, 120));
    try {
      const preview = await captureScreen();
      setCropPreview(preview);
    } catch {
      // user cancelled the picker
    } finally {
      setCapturing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    for (const file of files) {
      try {
        const preview = await readFile(file);
        addScreenshot({ name: file.name, data: preview.split(',')[1], mimeType: file.type, preview });
      } catch {
        setError('Could not read one of the files.');
      }
    }
  };

  const submit = async () => {
    if (!goal.trim() || !result.trim() || rating === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal.trim(), result: result.trim(), rating,
          view, context, url: window.location.href,
          timestamp: new Date().toISOString(),
          screenshots: screenshots.map(({ name, data, mimeType }) => ({ name, data, mimeType })),
        }),
      });
      if (!res.ok) throw new Error();
      setStep('done');
    } catch {
      setError('Could not send feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Crop overlay — rendered outside the panel so it's full-screen */}
      {cropPreview && (
        <CropOverlay
          preview={cropPreview}
          onConfirm={(shot) => { addScreenshot(shot); setCropPreview(null); }}
          onCancel={() => setCropPreview(null)}
        />
      )}

      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">

        {step !== 'closed' && (
          <div className={cn(
            'w-80 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden transition-opacity duration-100',
            capturing ? 'opacity-0 pointer-events-none' : 'opacity-100',
          )}>

            {/* Header */}
            <div className="flex items-center justify-between bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="size-4 text-slate-300" />
                <span className="text-sm font-semibold text-white">Share feedback</span>
              </div>
              <button type="button" onClick={reset} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="px-4 py-4">

              {/* Step 1 */}
              {step === 'goal' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 1 of 4</p>
                  <p className="text-sm font-semibold text-slate-800">What were you trying to do?</p>
                  <textarea autoFocus rows={3} value={goal} onChange={(e) => setGoal(e.target.value)}
                    placeholder="e.g. I wanted to add a solar panel to the roof surface…"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none" />
                  <button type="button" disabled={!goal.trim()} onClick={() => setStep('result')}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-slate-700 cursor-pointer transition-colors">
                    Next <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Step 2 */}
              {step === 'result' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 2 of 4</p>
                  <p className="text-sm font-semibold text-slate-800">What happened? What did you expect instead?</p>
                  <textarea autoFocus rows={3} value={result} onChange={(e) => setResult(e.target.value)}
                    placeholder="e.g. I couldn't find the install button…"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStep('goal')} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">Back</button>
                    <button type="button" disabled={!result.trim()} onClick={() => setStep('rating')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-slate-700 cursor-pointer transition-colors">
                      Next <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {step === 'rating' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 3 of 4</p>
                  <p className="text-sm font-semibold text-slate-800">How difficult was this task overall?</p>
                  <div className="grid grid-cols-5 gap-1">
                    {RATING_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setRating(opt.value)} title={opt.label}
                        className={cn('flex flex-col items-center gap-1 rounded-lg border py-2 text-lg transition-all cursor-pointer',
                          rating === opt.value ? 'border-slate-700 bg-slate-800 shadow-sm scale-105' : 'border-slate-200 bg-slate-50 hover:border-slate-300')}>
                        {opt.emoji}
                        <span className="text-[9px] font-semibold text-slate-500 leading-none">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStep('result')} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">Back</button>
                    <button type="button" disabled={rating === null} onClick={() => setStep('screenshot')}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-slate-700 cursor-pointer transition-colors">
                      Next <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: screenshots */}
              {step === 'screenshot' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 4 of 4 · Optional</p>
                  <p className="text-sm font-semibold text-slate-800">Add screenshots</p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Capture your screen — you can crop to a specific area after. Add as many as needed.
                  </p>

                  {/* Thumbnail grid */}
                  {screenshots.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {screenshots.map((s, i) => (
                        <div key={i} className="relative group rounded-md overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                          <img src={s.preview} alt={`screenshot ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeScreenshot(i)}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <Trash2 className="size-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add buttons */}
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={handleCapture} disabled={capturing}
                      className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-100 cursor-pointer transition-colors disabled:opacity-50">
                      <Monitor className="size-4 text-slate-500" />
                      {capturing ? 'Select window…' : screenshots.length > 0 ? 'Capture another' : 'Capture screen'}
                    </button>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-colors">
                      <ImagePlus className="size-4 text-slate-400" />
                      {screenshots.length > 0 ? 'Upload more images' : 'Upload images'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleFileChange} />
                  </div>

                  {error && <p className="text-[11px] text-red-500">{error}</p>}

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setStep('rating')} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">Back</button>
                    <button type="button" disabled={loading} onClick={submit}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:bg-primary/90 cursor-pointer transition-colors">
                      {loading
                        ? <span className="animate-pulse">Sending…</span>
                        : <><Send className="size-3.5" />{screenshots.length > 0 ? `Send (${screenshots.length} screenshot${screenshots.length > 1 ? 's' : ''})` : 'Send without'}</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Done */}
              {step === 'done' && (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <CheckCircle2 className="size-10 text-green-500" />
                  <p className="text-sm font-semibold text-slate-800">Thank you!</p>
                  <p className="text-xs text-slate-500 leading-snug">Your feedback has been recorded and will help us improve the tool.</p>
                  <button type="button" onClick={reset} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors">Close</button>
                </div>
              )}
            </div>

            {step !== 'done' && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                <p className="text-[10px] text-slate-400 truncate">📍 {view}{context ? ` › ${context}` : ''}</p>
              </div>
            )}
          </div>
        )}

        {step === 'closed' && !capturing && (
          <button type="button" onClick={() => setStep('goal')}
            className="flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-700 cursor-pointer transition-all hover:scale-105">
            <MessageSquarePlus className="size-4" />
            Feedback
          </button>
        )}
      </div>
    </>
  );
}
