// One section of a panel: a header band in its topic's colour with the
// topic's icon, then the section's content. Expert-only sections are dashed.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Topic } from '@/app/config/topics';
import { InfoTip } from './ui';

export function SectionCard({ topic, title, info, action, dashed, emphasised, children }: {
  topic: Topic;
  title: string;
  /** What the section changes, behind an info icon in the header. */
  info?: string;
  /** A control at the right of the header, such as an Edit button. */
  action?: ReactNode;
  dashed?: boolean;
  /** A thicker border, for the section in focus. */
  emphasised?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={cn(
      'overflow-hidden rounded-lg bg-card',
      emphasised ? 'border-2 border-[#475B7A] dark:border-[#C3CDDD]' : 'border border-border',
      dashed && 'border-dashed',
    )}>
      <header className={cn('flex min-h-8 items-center gap-2 px-3 py-1.5 text-[12px] font-bold', topic.tile)}>
        <topic.Icon className={cn('size-4 shrink-0', topic.icon)} aria-hidden />
        <h3 className="m-0 min-w-0 flex-1 truncate text-[12px] font-bold">{title}</h3>
        {action}
        {info && <InfoTip tip={info} />}
      </header>
      {children}
    </section>
  );
}
