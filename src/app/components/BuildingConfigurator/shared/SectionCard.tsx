// One section of a panel: a header band in its topic's colour with the
// topic's icon, then the section's content. Expert-only sections are dashed.

import type { MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RotateCcw } from '@/app/components/icons';
import type { Topic } from '@/app/config/topics';
import { InfoTip } from './ui';

export function SectionCard({ topic, title, info, action, onReset, resetLabel, dashed, emphasised, onToggle, children }: {
  topic: Topic;
  title: string;
  /** What the section changes, behind an info icon in the header. */
  info?: string;
  /** A control at the right of the header, such as an Edit button. */
  action?: ReactNode;
  /** Returns the section to its default values; pass it only while something differs from them. */
  onReset?: () => void;
  /** The reset button's name and tooltip. */
  resetLabel?: string;
  dashed?: boolean;
  /** A thicker border, for the section in focus. */
  emphasised?: boolean;
  /** Makes the whole header open and close the section. Keep a button for it in `action`: the header is not focusable. */
  onToggle?: () => void;
  children?: ReactNode;
}) {
  // A click on a control in the header is that control's, not the toggle's.
  const onHeaderClick = onToggle && ((e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button, a, input, select, label, [tabindex]')) onToggle();
  });
  return (
    <section className={cn(
      'overflow-hidden rounded-lg bg-card',
      emphasised ? 'border-2 border-[#475B7A] dark:border-[#C3CDDD]' : 'border border-border',
      dashed && 'border-dashed',
    )}>
      <header
        onClick={onHeaderClick}
        className={cn('flex min-h-8 items-center gap-2 px-3 py-1.5 text-[12px] font-bold', topic.tile, onToggle && 'cursor-pointer select-none')}
      >
        <topic.Icon className={cn('size-4 shrink-0', topic.icon)} aria-hidden />
        <h3 className="m-0 min-w-0 flex-1 truncate text-[12px] font-bold">{title}</h3>
        {action}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label={resetLabel}
            title={resetLabel}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
        {info && <InfoTip tip={info} />}
      </header>
      {children}
    </section>
  );
}
