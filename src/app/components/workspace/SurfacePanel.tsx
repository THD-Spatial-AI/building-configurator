// The clicked surface's panel: a fixed column left of the model on a wide
// screen, so it never covers the building while it turns; a sheet over the
// bottom of the screen on a narrow one. It holds every section of one
// surface, whichever tab the building panel shows.

import { X } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { useT } from '../../i18n';

interface SurfacePanelProps {
  /** A sheet over the bottom of the screen instead of a column. */
  docked: boolean;
  /** Nothing selected: the column shows `emptyText`, the sheet nothing. */
  open: boolean;
  title?: string;
  subtitle?: string;
  emptyText: string;
  /** Picks a surface without the model; shown above the content in the column. */
  picker?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
}

export function SurfacePanel({ docked, open, title, subtitle, emptyText, picker, onClose, children }: SurfacePanelProps) {
  const t = useT();
  if (docked && !open) return null;
  return (
    <aside
      aria-label={title}
      className={cn(
        'flex flex-col border-border bg-card',
        docked
          ? 'fixed inset-x-0 bottom-0 z-30 max-h-[58vh] overflow-hidden rounded-t-2xl border-t shadow-[0_18px_50px_rgba(15,23,42,0.28)]'
          : 'w-[300px] shrink-0 rounded-lg border',
      )}
    >
      {picker && !docked && <div className="shrink-0 border-b border-border p-2">{picker}</div>}
      {open ? (
        <>
          <div className={cn(
            'flex w-full shrink-0 items-start gap-2 border-border px-3',
            // A form stretched across a tablet's full width reads worse than a column.
            docked ? 'mx-auto max-w-[560px] pt-4 pb-2.5' : 'border-b py-2.5',
          )}>
            {docked && <span className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-muted-foreground/40" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-foreground">{title}</p>
              {subtitle && <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('surface.close')}
              className="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted [&_svg]:size-4"
            >
              <X />
            </button>
          </div>
          <div className={cn('min-h-0 w-full flex-1 overflow-y-auto', docked && 'mx-auto max-w-[560px]')}>
            {children}
          </div>
        </>
      ) : (
        <p className="m-auto max-w-[220px] px-4 text-center text-[12px] leading-snug text-muted-foreground">{emptyText}</p>
      )}
    </aside>
  );
}
