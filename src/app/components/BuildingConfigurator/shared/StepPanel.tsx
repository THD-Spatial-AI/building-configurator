// A panel's sections as steps: a path of nodes, each in its status and named
// beneath, one step shown at a time with Back and Next beneath it. A step
// with a summary shows as a card of its values until Edit.

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** The step's values, shown in place of its content until Edit, each a field's label and value. */
  summary?: StepFact[];
  /** Called when another step is opened while this one is. */
  onLeave?: () => void;
}

/** One value of a closed step's summary. */
export interface StepFact {
  label: string;
  value: string;
  /** A status in place of a value, such as one still being worked out: shown in grey. */
  muted?: boolean;
  /** A heading the fact sits under, drawn once above the first fact of each section. */
  section?: string;
  /** A value behind its step's status: marked, so the user knows what to change. */
  attention?: boolean;
}

/**
 * Each status as a node: its mark on a tint of its colour, a step not yet
 * complete its number in an outline. Only an error is a solid fill. The open
 * step is solid primary whatever its status, its mark kept in white.
 */
const NODE: Record<StepStatus, { Icon?: typeof Check; node: string }> = {
  complete: { Icon: Check, node: 'border-transparent bg-primary-subtle text-primary' },
  incomplete: { node: 'border-step-line bg-background text-muted-foreground' },
  attention: { Icon: AlertTriangle, node: 'border-transparent bg-warning-subtle text-warning' },
  error: { Icon: X, node: 'border-destructive bg-destructive text-white' },
};
const OPEN_NODE = 'border-primary bg-primary text-primary-foreground';

/** A step's node: its status mark, or its number while it has none. */
function NodeMark({ step, number, open }: { step: Step; number: number; open: boolean }) {
  const { Icon, node } = NODE[step.status];
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-shadow group-hover:shadow-md group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-ring',
        open ? OPEN_NODE : node,
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : number}
    </span>
  );
}

/** The link from one node to the next. */
function Link({ side }: { side: 'left' | 'right' }) {
  return (
    <span
      aria-hidden
      className={cn('absolute top-3.5 h-0.5 -translate-y-1/2 bg-step-line', side === 'left' ? 'left-0 right-1/2' : 'left-1/2 right-0')}
    />
  );
}

/** Ready once every step is complete; otherwise how many are not, opening the first of them. */
function Readiness({ steps, go }: { steps: Step[]; go: (key: string) => void }) {
  const t = useT();
  const pending = steps.filter((step) => step.status !== 'complete');
  const badge = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold';
  if (pending.length === 0) {
    return (
      <span role="status" className={cn(badge, 'bg-success-subtle text-success-foreground')}>
        <Check className="size-3" aria-hidden />
        {t('steps.ready')}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => go(pending[0].key)}
      className={cn(badge, 'cursor-pointer bg-warning-subtle text-warning-foreground hover:underline')}
    >
      <AlertTriangle className="size-3 text-warning" aria-hidden />
      {t('steps.pending', { count: pending.length })}
    </button>
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
  const [editing, setEditing] = useState<string | null>(openFields ?? null);
  useEffect(() => { if (openFields) setEditing(openFields); }, [openFields]);
  const go = (key: string) => {
    if (key === current.key) return;
    current.onLeave?.();
    moved.current = true;
    setEditing(null);
    onActive(key);
  };
  const summarised = editing !== current.key && (current.summary?.length ?? 0) > 0;
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
    <div className="flex flex-1 flex-col gap-3">
      {/* Sticks at stickyTop while the section scrolls beneath it. */}
      <nav aria-label={t('steps.nav')} className={cn('sticky z-10 -mx-4 border-b border-border bg-card px-4 py-2', stickyTop)}>
        <div className="mb-1.5 flex justify-end">
          <Readiness steps={steps} go={go} />
        </div>
        <ol className="m-0 flex list-none items-start p-0">
          {steps.map((step, i) => {
            const on = step.key === current.key;
            return (
              <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center">
                {i > 0 && <Link side="left" />}
                {i < steps.length - 1 && <Link side="right" />}
                <button
                  type="button"
                  aria-current={on ? 'step' : undefined}
                  aria-label={`${i + 1}. ${step.label}, ${t(`steps.status.${step.status}`)}`}
                  onClick={() => go(step.key)}
                  className="group relative z-10 flex min-w-0 cursor-pointer flex-col items-center gap-1 px-0.5 outline-none"
                >
                  <NodeMark step={step} number={i + 1} open={on} />
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

      <div ref={sectionRef} className="flex-1">
        {summarised
          ? <StepSummary step={current} number={index + 1} onEdit={() => { moved.current = true; setEditing(current.key); }} />
          : current.content}
      </div>
      <StepNav
        previous={previous}
        next={next}
        go={go}
        // Edits apply as they are made; Done only closes the fields to the step's summary.
        onDone={!summarised && (current.summary?.length ?? 0) > 0 ? () => setEditing(null) : undefined}
      />
    </div>
  );
}

/** A step worked through: its number and name, its values with any needing attention marked, and Edit to show its fields again. */
export function StepSummary({ step, number, onEdit }: { step: Step; number: number; onEdit: () => void }) {
  const t = useT();
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex items-center gap-2 px-3 py-2">
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
            {step.summary.map((fact, i) => (
              <Fragment key={fact.label}>
                {fact.section && fact.section !== step.summary![i - 1]?.section && (
                  <tr className="border-t border-border bg-muted/50">
                    <th colSpan={2} scope="colgroup" className="px-3 py-1 text-left text-[11px] font-semibold text-foreground">{fact.section}</th>
                  </tr>
                )}
                <tr className="border-t border-border">
                  <th scope="row" className={cn('px-3 py-1.5 text-left font-normal', fact.attention ? 'text-warning-foreground' : 'text-muted-foreground')}>
                    {fact.attention && <AlertTriangle className="mr-1 inline size-3 align-[-2px] text-warning" aria-label={t('steps.status.attention')} />}
                    {fact.label}
                  </th>
                  <td className={cn('px-3 py-1.5 text-right tabular-nums', fact.muted ? 'text-muted-foreground' : 'font-semibold text-foreground')}>{fact.value}</td>
                </tr>
              </Fragment>
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
    <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-3">
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
