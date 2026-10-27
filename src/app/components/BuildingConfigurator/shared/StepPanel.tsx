// A panel's sections as steps: a bar naming each with its status, one section
// shown at a time, and Previous and Next beneath it.

import type { ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, X } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import type { Topic } from '@/app/config/topics';
import { useT } from '@/app/i18n';

/** Complete: nothing missing. Attention: a warning to look at. Error: something failed. */
export type StepStatus = 'complete' | 'attention' | 'error';

export interface Step {
  key: string;
  label: string;
  topic: Topic;
  status: StepStatus;
  content: ReactNode;
  /** Called when another step is opened while this one is. */
  onLeave?: () => void;
}

const STATUS_MARK: Record<StepStatus, { Icon: typeof Check; className: string }> = {
  complete: { Icon: Check, className: 'bg-emerald-600 text-white dark:bg-emerald-500' },
  attention: { Icon: AlertTriangle, className: 'bg-amber-500 text-white' },
  error: { Icon: X, className: 'bg-destructive text-white' },
};

function StatusMark({ status }: { status: StepStatus }) {
  const { Icon, className } = STATUS_MARK[status];
  return (
    <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full', className)} aria-hidden>
      <Icon className="size-2.5" />
    </span>
  );
}

export function StepPanel({ steps, active, onActive }: {
  steps: Step[];
  active: string;
  onActive: (key: string) => void;
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
      {/* Sticks under the panel's top edge while the section scrolls beneath it. */}
      <nav aria-label={t('steps.nav')} className="sticky top-0 z-10 -mx-4 border-b border-border bg-card px-4 py-2">
        <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {steps.map((step, i) => {
            const on = step.key === current.key;
            return (
              <li key={step.key}>
                <button
                  type="button"
                  aria-current={on ? 'step' : undefined}
                  aria-label={`${i + 1}. ${step.label}, ${t(`steps.status.${step.status}`)}`}
                  onClick={() => go(step.key)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
                    on ? cn('border-2', step.topic.border, step.topic.tile) : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <step.topic.Icon className={cn('size-3.5', on && step.topic.icon)} aria-hidden />
                  <span>{i + 1}. {step.label}</span>
                  <StatusMark status={step.status} />
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
