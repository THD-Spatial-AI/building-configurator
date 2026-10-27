// A panel's sections as steps: a path of nodes, each in its status and named
// beneath, one section shown at a time, and Back and Next beneath it.

import type { ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, X } from '@/app/components/icons';
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
  /** Called when another step is opened while this one is. */
  onLeave?: () => void;
}

/**
 * Each status as a node: filled with its mark, or for the open step outlined
 * on white with the mark in the status colour. An incomplete step has no mark.
 */
const NODE: Record<StepStatus, { Icon?: typeof Check; filled: string; open: string }> = {
  complete: {
    Icon: Check,
    filled: 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500',
    open: 'border-emerald-600 bg-background text-emerald-600 dark:border-emerald-500 dark:text-emerald-400',
  },
  incomplete: { filled: 'border-muted-foreground/40 bg-background', open: 'border-primary bg-background' },
  attention: { Icon: AlertTriangle, filled: 'border-amber-500 bg-amber-500 text-white', open: 'border-amber-500 bg-background text-amber-600' },
  error: { Icon: X, filled: 'border-destructive bg-destructive text-white', open: 'border-destructive bg-background text-destructive' },
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

export function StepPanel({ steps, active, onActive, stickyTop = 'top-0' }: {
  steps: Step[];
  active: string;
  onActive: (key: string) => void;
  /** Where the step bar sticks, as a Tailwind top class: below any bar that sticks above it. */
  stickyTop?: string;
}) {
  const t = useT();
  const index = Math.max(0, steps.findIndex((step) => step.key === active));
  const current = steps[index];
  const go = (key: string) => {
    if (key === current.key) return;
    current.onLeave?.();
    onActive(key);
  };
  const previous = steps[index - 1];
  const next = steps[index + 1];
  return (
    <div className="flex flex-col gap-3">
      {/* Sticks at stickyTop while the section scrolls beneath it. */}
      <nav aria-label={t('steps.nav')} className={cn('sticky z-10 -mx-4 border-b border-border bg-card px-4 py-2', stickyTop)}>
        <ol className="m-0 flex list-none items-start p-0">
          {steps.map((step, i) => {
            const on = step.key === current.key;
            const { Icon, filled, open } = NODE[step.status];
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
                      'flex size-8 items-center justify-center rounded-full transition-shadow group-hover:shadow-md group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50',
                      on ? cn('border-[3px]', open) : cn('border-2', filled),
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

      <div>{current.content}</div>

      <div className="flex items-center justify-between gap-2">
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
      </div>
    </div>
  );
}
