// Surface editor, placed so the surface it belongs to stays visible: beside its
// surface on a wide screen, docked to the bottom edge on a narrow one, where a
// floating card would cover most of the model it refers to.
//
// While the model is orbited the card follows its surface across the screen.
// That runs per frame, so the caller moves it with anchorCard() — a style write
// on the node — rather than through React.

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery, WIDE_LAYOUT } from '../../lib/useMediaQuery';

const WIDTH = 360;
const MARGIN = 12;
/** Clearance between the surface's own on-screen extent and the card, so the
 *  card sits beside the surface rather than on top of it. The leader line does
 *  the work of tying the two together, so this stays small. */
const GAP = 20;
/** A large surface only pushes the card so far before the leader line is doing
 *  a better job of showing what the card belongs to than distance would. */
const MAX_STANDOFF = 70;
/** How far the tail hangs off the card's edge. */
const TAIL_OFFSET = 7;

/**
 * Places the card clear of a surface and points its tail back at it: beside the
 * surface's on-screen extent, flipped to the other side and clamped to the
 * viewport rather than running off the edge.
 */
export function anchorCard(card: HTMLElement, at: { x: number; y: number; radius?: number }) {
  // Held still while a control inside it is being dragged: moving the card
  // moves that control out from under the pointer, and the next pointer event
  // then reads a different value off it.
  if (card.dataset.pinned === 'true') return;

  const height = card.offsetHeight;
  const standoff = Math.min(at.radius ?? 0, MAX_STANDOFF) + GAP;

  const onRight = at.x + standoff + WIDTH + MARGIN <= window.innerWidth
    || at.x - standoff - WIDTH < MARGIN;
  const left = onRight
    ? Math.min(at.x + standoff, window.innerWidth - WIDTH - MARGIN)
    : Math.max(MARGIN, at.x - standoff - WIDTH);
  const top = Math.min(
    Math.max(MARGIN, at.y - height / 2),
    Math.max(MARGIN, window.innerHeight - height - MARGIN),
  );
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;

  const tail = card.querySelector<HTMLElement>('[data-role="tail"]');
  if (!tail) return;
  // On the edge facing the surface, level with it, but kept within the card's
  // own height so it never floats off a corner.
  const tailTop = Math.min(Math.max(at.y - top, 16), Math.max(16, height - 16));
  tail.style.top = `${tailTop}px`;
  if (onRight) {
    tail.style.left = `${-TAIL_OFFSET}px`;
    tail.style.right = 'auto';
    tail.style.borderWidth = '0 0 1px 1px';
    // The card's own shadow cannot reach the tail, and white on the viewer's
    // near-white background has nothing else to read against.
    tail.style.filter = 'drop-shadow(-2px 2px 2px rgba(15,23,42,0.14))';
  } else {
    tail.style.right = `${-TAIL_OFFSET}px`;
    tail.style.left = 'auto';
    tail.style.borderWidth = '1px 1px 0 0';
    tail.style.filter = 'drop-shadow(2px -2px 2px rgba(15,23,42,0.14))';
  }

  // Leader from the surface to the card's tail, so the card is visibly about
  // that surface and not whichever one it happens to sit over.
  const line = card.querySelector<SVGLineElement>('[data-role="leader"] line');
  const dot = card.querySelector<SVGCircleElement>('[data-role="leader"] circle');
  if (!line || !dot) return;
  line.setAttribute('x1', String(at.x));
  line.setAttribute('y1', String(at.y));
  line.setAttribute('x2', String(onRight ? left : left + WIDTH));
  line.setAttribute('y2', String(top + tailTop));
  dot.setAttribute('cx', String(at.x));
  dot.setAttribute('cy', String(at.y));
}

interface SurfacePopoverProps {
  /** The surface's position and on-screen radius, in client coordinates. */
  at: { x: number; y: number; radius?: number };
  /** The card's node, for moving it as the model turns. */
  cardRef?: React.MutableRefObject<HTMLDivElement | null>;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function SurfacePopover({ at, cardRef, title, subtitle, onClose, children }: SurfacePopoverProps) {
  const wide = useMediaQuery(WIDE_LAYOUT);
  const ownRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const card = ownRef.current;
    if (cardRef) cardRef.current = card;
    // Placed once per surface, from the click, and moved from then on by the
    // caller as the model turns. Deliberately not on every render: re-anchoring
    // when the content changes height shifts the card under the pointer
    // mid-drag, which reads back as a different value.
    if (card && wide) anchorCard(card, at);
  }, [at, wide, cardRef]);

  // A pointer down anywhere in the card pins it until that gesture ends.
  useEffect(() => {
    const release = () => { delete ownRef.current?.dataset.pinned; };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);

  const anchored: React.CSSProperties = {
    width: WIDTH, maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
  };
  const docked: React.CSSProperties = {
    left: 0, right: 0, bottom: 0, maxHeight: '58vh',
  };

  return (
    <div
      ref={ownRef}
      onPointerDownCapture={() => { if (ownRef.current) ownRef.current.dataset.pinned = 'true'; }}
      style={{ position: 'fixed', ...(wide ? anchored : docked) }}
      className={cn(
        'z-30 flex flex-col border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]',
        // Not overflow-hidden while wide: the tail hangs outside the card's edge.
        wide ? 'rounded-xl border' : 'overflow-hidden rounded-t-2xl border-t',
      )}
    >
      {wide && (
        <svg
          data-role="leader"
          aria-hidden
          // Fixed and behind the card: the line spans the gap to the surface and
          // slips under the card rather than across its content.
          style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'visible' }}
        >
          <line stroke="var(--color-primary, #2f5d8a)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
          <circle r="3.5" fill="var(--color-primary, #2f5d8a)" />
        </svg>
      )}
      {wide && (
        <span
          data-role="tail"
          aria-hidden
          className="absolute size-3.5 -translate-y-1/2 rotate-45 border-slate-300 bg-white"
          style={{ top: 24, left: -TAIL_OFFSET, borderWidth: '0 0 1px 1px' }}
        />
      )}
      <div className={cn(
        'flex w-full shrink-0 items-start gap-2 border-b border-slate-200 px-3 py-2.5',
        // A form stretched across a tablet's full width reads worse than a column.
        !wide && 'mx-auto max-w-[560px] border-b-0 pt-4',
      )}>
        {!wide && (
          <span className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-slate-300" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-semibold text-slate-700">{title}</p>
          {subtitle && <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted [&_svg]:size-4"
        >
          <X />
        </button>
      </div>
      <div className={cn('min-h-0 w-full flex-1 overflow-y-auto', !wide && 'mx-auto max-w-[560px]')}>
        {children}
      </div>
    </div>
  );
}
