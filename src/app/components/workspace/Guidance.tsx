// First-visit tour and step hints. The tour lights up one area of the view at
// a time; the hints follow what the user has done and say what comes next.
// Areas are found by their data-tour attribute.

import { useEffect, useLayoutEffect, useState } from 'react';
import { MousePointerClick, X } from '@/app/components/icons';
import { useT } from '../../i18n';

/** The areas the tour lights up, in order; each is an element with data-tour set to its key. */
const TOUR_STEPS = ['model', 'surface', 'building', 'technologies', 'run'] as const;
type TourStep = (typeof TOUR_STEPS)[number];

const tourTarget = (key: TourStep) => document.querySelector(`[data-tour="${key}"]`);

/** Where an element is on screen, or null when it is not rendered. */
function useTargetRect(key: TourStep): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const measure = () => setRect(tourTarget(key)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [key]);
  return rect;
}

const CARD_WIDTH = 360;
const GAP = 16;

/** The card's position: beside the area where there is room, else inside it, never off screen. */
function cardPosition(rect: DOMRect): { left: number; top: number } {
  const right = rect.right + GAP;
  const left = right + CARD_WIDTH <= window.innerWidth - GAP
    ? right
    : rect.left - GAP - CARD_WIDTH >= GAP ? rect.left - GAP - CARD_WIDTH : Math.max(GAP, rect.right - CARD_WIDTH - GAP);
  const top = Math.min(Math.max(GAP, rect.top + 24), window.innerHeight - 260);
  return { left, top };
}

/**
 * The tour: one area lit at a time with a card that explains it. Areas not on
 * screen when it starts are left out. Escape or Skip ends it.
 */
export function Tour({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [steps] = useState(() => TOUR_STEPS.filter((key) => tourTarget(key)));
  const [index, setIndex] = useState(0);
  const step = steps[index] ?? TOUR_STEPS[0];
  const rect = useTargetRect(step);
  const last = index >= steps.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const position = rect ? cardPosition(rect) : { left: GAP, top: GAP };
  return (
    <div className="fixed inset-0 z-50" aria-live="polite">
      {rect ? (
        // The lit area: a hole in the dimmed screen drawn by the box's own shadow.
        <div
          className="pointer-events-none fixed rounded-xl border-[3px] border-white"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: '0 0 0 9999px rgba(27,36,48,0.55)' }}
        />
      ) : <div className="fixed inset-0 bg-[rgba(27,36,48,0.55)]" />}
      <div
        role="dialog"
        aria-label={t('tour.stepOf', { step: index + 1, total: steps.length })}
        className="fixed flex flex-col gap-2.5 rounded-xl bg-card p-4 text-foreground shadow-[0_16px_40px_rgba(27,36,48,0.35)]"
        style={{ width: CARD_WIDTH, ...position }}
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          {t('tour.stepOf', { step: index + 1, total: steps.length })}
        </span>
        <b className="text-[16px]">{t(`tour.${step}.title`)}</b>
        <p className="m-0 text-[13px] leading-snug text-muted-foreground">{t(`tour.${step}.body`)}</p>
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((key, i) => (
            <span key={key} className={i === index ? 'h-2 w-5 rounded-full bg-primary' : 'size-2 rounded-full bg-border'} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer text-[12px] font-medium text-primary hover:underline">
            {t('tour.skip')}
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="h-8 cursor-pointer rounded-md border border-border bg-card px-3 text-[12px] font-medium hover:bg-muted"
              >{t('tour.back')}</button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (last ? onClose() : setIndex(index + 1))}
              className="h-8 cursor-pointer rounded-md bg-primary px-4 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
            >{t(last ? 'tour.done' : 'tour.next')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const HINTS_HIDDEN_KEY = 'building-configurator.hideStepHints';

/** Whether the user hid the step hints; a browser that refuses storage shows them. */
function readHintsHidden(): boolean {
  try { return window.localStorage.getItem(HINTS_HIDDEN_KEY) === '1'; } catch { return false; }
}

/**
 * The next step over the model: click a surface, change it, then save and
 * preview. Hidden for good with "Hide hints", remembered in this browser.
 */
export function StepHints({ surfaceOpened, edited, ran }: { surfaceOpened: boolean; edited: boolean; ran: boolean }) {
  const t = useT();
  const [hidden, setHidden] = useState(readHintsHidden);
  if (hidden || ran) return null;
  const step = edited ? 3 : surfaceOpened ? 2 : 1;
  const hide = () => {
    setHidden(true);
    try { window.localStorage.setItem(HINTS_HIDDEN_KEY, '1'); } catch { /* a refused write only means the hints return next time */ }
  };
  return (
    <div className="absolute right-3 top-3 z-10 flex w-[260px] flex-col gap-1.5 rounded-lg border border-border bg-card p-3 shadow-[0_8px_24px_rgba(27,36,48,0.14)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground">{t('hints.stepOf', { step, total: 3 })}</span>
        <button type="button" onClick={hide} aria-label={t('hints.hide')} title={t('hints.hide')} className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted [&_svg]:size-3.5">
          <X />
        </button>
      </div>
      <p className="m-0 flex items-start gap-2 text-[13px] font-semibold leading-snug text-foreground">
        <MousePointerClick className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {t(`hints.step${step}`)}
      </p>
    </div>
  );
}
