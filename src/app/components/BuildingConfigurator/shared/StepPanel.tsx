// A panel's sections as steps: a path of nodes, each in its status and named
// beneath, one step shown at a time with Back and Next beneath it. A step
// already worked through shows as a summary card of its values until Edit.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, Pencil, X } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import type { Topic } from '@/app/config/topics';
import { useT } from '@/app/i18n';

/** Complete: nothing missing. Incomplete: an input still needed. Attention: a warning to look at. Error: something failed. */
export type StepStatus = 'complete' | 'incomplete' | 'attention' | 'error';

export interface Step {
  key: string;
  label: string;
  topic: Topic;
  status: StepStatus;
  content: ReactNode;
  /** The step's values, shown in place of its content once it has been left, each a field's label and value. */
  summary?: StepFact[];
  /** Shows the summary from the start, for a step whose values arrive filled in. */
  startSummarised?: boolean;
  /** Called when another step is opened while this one is. */
  onLeave?: () => void;
}

/** One value of a closed step's summary. */
export interface StepFact {
  label: string;
  value: string;
  /** A status in place of a value, such as one still being worked out: shown in grey. */
  muted?: boolean;
}

/**
 * Each status as a node, the same whether its step is open or not: filled
 * with its mark, an incomplete step outlined without one. The open step adds
 * a ring in the status colour, so status and position never share a cue.
 */
const NODE: Record<StepStatus, { Icon?: typeof Check; node: string; ring: string }> = {
  complete: {
    Icon: Check,
    node: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
    ring: 'ring-emerald-600 dark:ring-emerald-500',
  },
  incomplete: { node: 'border-muted-foreground/40 bg-background', ring: 'ring-primary' },
  attention: { Icon: AlertTriangle, node: 'border-amber-500 bg-amber-500 text-white', ring: 'ring-amber-500' },
  error: { Icon: X, node: 'border-destructive bg-destructive text-white', ring: 'ring-destructive' },
};

/** The link from one node to the next: green once the step it leaves is complete. */
function Link({ done, side }: { done: boolean; side: 'left' | 'right' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute top-4 h-1 -translate-y-1/2',
        side === 'left' ? 'left-0 right-1/2' : 'left-1/2 right-0',
        done ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-border',
      )}
    />
  );
}

export function StepPanel({ steps, active, onActive, stickyTop = 'top-0', openFields }: {
  steps: Step[];
  active: string;
  onActive: (key: string) => void;
  /** A step whose fields to show, not its summary, as when storeys are picked in the model to be configured. */
  openFields?: string;
  /** Where the step bar sticks, as a Tailwind top class: below any bar that sticks above it. */
  stickyTop?: string;
}) {
  const t = useT();
  const index = Math.max(0, steps.findIndex((step) => step.key === active));
  const current = steps[index];
  /** Steps left after being shown, which return as their summary. */
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set(steps.filter((step) => step.startSummarised).map((step) => step.key)));
  const [editing, setEditing] = useState<string | null>(openFields ?? null);
  useEffect(() => { if (openFields) setEditing(openFields); }, [openFields]);
  const go = (key: string) => {
    if (key === current.key) return;
    current.onLeave?.();
    moved.current = true;
    setDone((prev) => new Set(prev).add(current.key));
    setEditing(null);
    onActive(key);
  };
  const summarised = done.has(current.key) && editing !== current.key && (current.summary?.length ?? 0) > 0;
  const sectionRef = useRef<HTMLDivElement>(null);
  /** Set by the user opening a step or its fields, so opening the panel itself scrolls nothing. */
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const section = sectionRef.current;
    if (!section) return;
    scrollPanelTo(section);
    section.querySelector<HTMLElement>('input, select, textarea')?.focus({ preventScroll: true });
  }, [current.key, summarised]);
  const previous = steps[index - 1];
  const next = steps[index + 1];
  return (
    <div className="flex flex-col gap-3">
      {/* Sticks at stickyTop while the section scrolls beneath it. */}
      <nav aria-label={t('steps.nav')} className={cn('sticky z-10 -mx-4 border-b border-border bg-card px-4 py-2', stickyTop)}>
        <ol className="m-0 flex list-none items-start p-0">
          {steps.map((step, i) => {
            const on = step.key === current.key;
            const { Icon, node, ring } = NODE[step.status];
            return (
              <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center">
                {i > 0 && <Link side="left" done={steps[i - 1].status === 'complete'} />}
                {i < steps.length - 1 && <Link side="right" done={step.status === 'complete'} />}
                <button
                  type="button"
                  aria-current={on ? 'step' : undefined}
                  aria-label={`${i + 1}. ${step.label}, ${t(`steps.status.${step.status}`)}`}
                  onClick={() => go(step.key)}
                  className="group relative z-10 flex min-w-0 cursor-pointer flex-col items-center gap-1 px-0.5 outline-none"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-8 items-center justify-center rounded-full border-2 transition-shadow group-hover:shadow-md group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-ring',
                      node,
                      on && cn('ring-[3px] ring-offset-2 ring-offset-card', ring),
                    )}
                  >
                    {Icon && <Icon className="size-4" />}
                  </span>
                  <span className={cn(
                    'text-center text-[11px] leading-tight',
                    on ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground group-hover:text-foreground',
                  )}>
                    {i + 1}. {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div ref={sectionRef}>
        {summarised
          ? <StepSummary step={current} number={index + 1} onEdit={() => { moved.current = true; setEditing(current.key); }} />
          : current.content}
      </div>
      <StepNav
        previous={previous}
        next={next}
        go={go}
        // Edits apply as they are made; Done only closes the fields to the step's summary.
        onDone={!summarised && (current.summary?.length ?? 0) > 0 ? () => {
          setDone((prev) => new Set(prev).add(current.key));
          setEditing(null);
        } : undefined}
      />
    </div>
  );
}

/** A step worked through: its number, name and status, its values, and Edit to show its fields again. */
export function StepSummary({ step, number, onEdit }: { step: Step; number: number; onEdit: () => void }) {
  const t = useT();
  const { Icon, node } = NODE[step.status];
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex items-center gap-2 px-3 py-2">
        <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', node)}>
          {Icon && <Icon className="size-3" />}
        </span>
        <h3 className="m-0 min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">{number}. {step.label}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('steps.edit', { step: step.label })}
          className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground hover:bg-muted"
        >
          <Pencil className="size-3" aria-hidden />
          {t('panel.edit')}
        </button>
      </header>
      {step.summary && step.summary.length > 0 && (
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {step.summary.map((fact) => (
              <tr key={fact.label} className="border-t border-border">
                <th scope="row" className="px-3 py-1.5 text-left font-normal text-muted-foreground">{fact.label}</th>
                <td className={cn('px-3 py-1.5 text-right tabular-nums', fact.muted ? 'text-muted-foreground' : 'font-semibold text-foreground')}>{fact.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** How far below the scrolling panel's top a section is scrolled to: clear of the sticky tabs and step bar. */
const STICKY_BARS_PX = 150;

/**
 * Scrolls the panel holding `section` so its top sits below the sticky bars.
 * Only that panel scrolls: scrollIntoView would also scroll the host's page,
 * taking the tabs and step bar out of view.
 */
function scrollPanelTo(section: HTMLElement) {
  let panel = section.parentElement;
  while (panel && !/(auto|scroll)/.test(getComputedStyle(panel).overflowY)) panel = panel.parentElement;
  if (!panel) return;
  const top = section.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - STICKY_BARS_PX;
  panel.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

/** Back and Next beneath the open step, and Done while its fields are shown. */
function StepNav({ previous, next, go, onDone }: { previous?: Step; next?: Step; go: (key: string) => void; onDone?: () => void }) {
  const t = useT();
  return (
    // Sticks to the bottom of the panel, so a long step scrolls between the step bar and it.
    <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-2">
      {previous ? (
        <button
          type="button"
          onClick={() => go(previous.key)}
          className="flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 text-[12px] font-medium text-foreground shadow-xs hover:bg-muted"
        >
          <ChevronDown className="size-3.5 rotate-90" aria-hidden />
          {t('steps.previous', { step: previous.label })}
        </button>
      ) : <span />}
      <span className="flex items-center gap-2">
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-3 text-[12px] font-medium text-foreground shadow-xs hover:bg-muted"
          >
            <Check className="size-3.5" aria-hidden />
            {t('steps.done')}
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={() => go(next.key)}
            className="flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-primary bg-background px-3 text-[12px] font-semibold text-primary shadow-xs hover:bg-primary/5"
          >
            {t('steps.next', { step: next.label })}
            <ChevronDown className="size-3.5 -rotate-90" aria-hidden />
          </button>
        )}
      </span>
    </div>
  );
}
