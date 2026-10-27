/**
 * Building Configurator Design System
 * Shared primitive components and design tokens.
 *
 * Styled with Tailwind CSS + CSS variables to match the EnerPlanET UI.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, ChevronDown } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { formatDecimal, parseDecimal, useFormatNumber, useLanguage, useT } from '@/app/i18n';
import { formatTotal } from '@/app/lib/loadProfile';

// ─── Design tokens — CSS variable references for use in SVG attributes ─────────
// SVG stroke/fill attributes accept var() directly, so these strings work as-is.

export const T = {
  card:        'var(--color-card)',
  background:  'var(--color-background)',
  foreground:  'var(--color-foreground)',
  muted:       'var(--color-muted)',
  mutedFg:     'var(--color-muted-foreground)',
  border:      'var(--color-border)',
  primary:     'var(--color-primary)',
  primaryFg:   'var(--color-primary-foreground)',
  inputBg:     'var(--color-input-background)',
  switchBg:    'var(--color-switch-background)',
  destructive: 'var(--color-destructive)',
  warning:     '#92400e',
};

// ─── Element type badge colours ────────────────────────────────────────────────

export const TYPE_BADGES: Record<string, { bg: string; fg: string; border: string }> = {
  wall:   { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  window: { bg: '#f0f9ff', fg: '#0369a1', border: '#bae6fd' },
  roof:   { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  floor:  { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  door:   { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' },
};

// ─── Element dot colours ───────────────────────────────────────────────────────

export const ELEMENT_DOTS: Record<string, string> = {
  wall:   '#8ab4d0',
  window: '#56bce0',
  roof:   '#c0a870',
  floor:  '#608c4c',
  door:   '#8a5a38',
};

// ─── ConfiguratorStyles — no-op; styles are now in theme.css ──────────────────

/** @deprecated Styles are now in theme.css. This component is kept for compatibility. */
export function ConfiguratorStyles() {
  return null;
}

// ─── InfoTip ──────────────────────────────────────────────────────────────────

/** Half the tip's maximum width plus a margin, kept between the tip's middle and the window's edges. */
const TIP_HALF_WIDTH = 148;

/**
 * An info icon whose tip shows on hover or keyboard focus. The tip is drawn
 * into document.body so a scrolling panel cannot clip it; it sits above the
 * icon, or below it near the top of the window.
 */
export function InfoTip({ tip }: { tip: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const show = () => setRect(ref.current?.getBoundingClientRect() ?? null);
  const hide = () => setRect(null);
  const below = rect !== null && rect.top < 64;
  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-describedby={rect ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="inline-flex shrink-0 cursor-help items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Info className="size-3 text-muted-foreground" />
      {rect && createPortal(
        <span
          id={id}
          role="tooltip"
          className={cn(
            // A set width: near the window's edge a fixed element shrinks to the room left of its left edge.
            'pointer-events-none fixed z-[9999] w-max max-w-[280px] -translate-x-1/2 rounded-[6px] bg-foreground px-2.5 py-1.5 text-[11px] leading-snug text-background shadow-md',
            below ? 'translate-y-0' : '-translate-y-full',
          )}
          style={{
            left: Math.min(window.innerWidth - TIP_HALF_WIDTH, Math.max(TIP_HALF_WIDTH, rect.left + rect.width / 2)),
            top: below ? rect.bottom + 4 : rect.top - 4,
          }}
        >
          {tip}
        </span>,
        document.body,
      )}
    </span>
  );
}

// ─── HeatingDeltaBadge ────────────────────────────────────────────────────────

/**
 * Percentages beyond DELTA_DISPLAY_CAP are shown as ">300%" rather than the
 * raw figure — while BuEM and the building's data are still placeholders, a
 * comparison between two disconnected estimates can produce swings in the
 * thousands of percent, which is noise, not a real signal, and reads as broken.
 */
const DELTA_DISPLAY_CAP = 300;

/**
 * Small tag next to an energy row's label naming where its number came
 * from. Nothing is shown for 'buem' — a confirmed full simulation is the
 * ordinary/default state and doesn't need calling out.
 */
export function SourceTag({ source }: { source?: 'ignis' | 'buem' | 'user' }) {
  const t = useT();
  if (source === 'ignis') return <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">{t('common.source.estimated')}</span>;
  if (source === 'user') return <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">{t('common.source.userDefined')}</span>;
  return null;
}

/**
 * One-line plain-language comparison — "26% lower than the last full
 * simulation (24,955 kWh)" — replacing a bare percentage badge with wording
 * a non-CS reader can act on. Caller decides when there's something worth
 * saying (e.g. only while the number differs from a reference); this just
 * renders it.
 */
export function EnergyComparisonNote({
  deltaPercent, referenceKwh, referenceLabel,
}: {
  deltaPercent?: number | null;
  referenceKwh?: string;
  referenceLabel?: string;
}) {
  const t = useT();
  const format = useFormatNumber();
  if (deltaPercent === null || deltaPercent === undefined || !referenceKwh || !referenceLabel) return null;
  if (Math.abs(deltaPercent) < 0.5) return null;

  const isIncrease = deltaPercent > 0;
  const magnitude = Math.abs(deltaPercent);
  const displayValue = magnitude > DELTA_DISPLAY_CAP ? `>${format(DELTA_DISPLAY_CAP, 0)}` : format(magnitude, 0);

  return (
    <p className={cn('text-[11px] leading-snug', isIncrease ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>
      {t(isIncrease ? 'common.comparison.higher' : 'common.comparison.lower', {
        percent: displayValue, reference: referenceLabel, kwh: formatTotal(referenceKwh, format),
      })}
    </p>
  );
}

// ─── DecimalInput ─────────────────────────────────────────────────────────────

type DecimalInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'> & {
  /** '' or null shows an empty field. */
  value: number | '' | null;
  /** A typed number, or null when the field is cleared. Text that is not a number yet is not passed on. */
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Takes whole numbers only, such as a year or a count. */
  integer?: boolean;
};

/** Whether a number field lets the user type this: digits, a sign and, unless whole, either decimal separator. */
export function isNumberText(text: string, integer: boolean): boolean {
  return (integer ? /^-?\d*$/ : /^-?[\d.,]*$/).test(text);
}

/**
 * A number field in the view's language: 0,4 in de, 0.4 in en. A browser's
 * type="number" field shows the browser's locale, not the page's, so this is a
 * text field that formats while not being edited and reads either separator.
 * The arrow keys step by `step` within min and max.
 */
export function DecimalInput({ value, onChange, min, max, step = 1, integer = false, onFocus, onBlur, onKeyDown, ...rest }: DecimalInputProps) {
  const language = useLanguage();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (typeof value === 'number' ? formatDecimal(language, value) : '');

  const commit = (text: string) => {
    if (!isNumberText(text, integer)) return;
    setDraft(text);
    const parsed = parseDecimal(text);
    if (parsed !== undefined) onChange?.(parsed);
  };

  const stepBy = (direction: 1 | -1) => {
    const current = parseDecimal(shown) ?? 0;
    const precision = (String(step).split('.')[1] ?? '').length;
    let next = Number((current + direction * step).toFixed(precision));
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setDraft(formatDecimal(language, next));
    onChange?.(next);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={shown}
      onChange={(e) => commit(e.target.value)}
      onFocus={(e) => { setDraft(shown); onFocus?.(e); }}
      onBlur={(e) => { setDraft(null); onBlur?.(e); }}
      onKeyDown={(e) => {
        if (!rest.readOnly && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          stepBy(e.key === 'ArrowUp' ? 1 : -1);
        }
        onKeyDown?.(e);
      }}
    />
  );
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

interface NumberInputProps {
  label?: string;
  value: number | string;
  onChange?: (v: number) => void;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  tip?: string;
  readOnly?: boolean;
  width?: number | string;
  /** Whole numbers only, as in DecimalInput. */
  integer?: boolean;
}

export function NumberInput({
  label, value, onChange, unit, min, max, step = 0.01,
  tip, readOnly = false, width, integer,
}: NumberInputProps) {
  return (
    <div style={width !== undefined ? { width } : undefined}>
      {label && (
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</span>
          {tip && <InfoTip tip={tip} />}
        </div>
      )}
      <div className="cfg-input-wrap">
        <DecimalInput
          className="cfg-number"
          value={typeof value === 'number' ? value : value === '' ? '' : Number(value)}
          min={min}
          max={max}
          step={step}
          integer={integer}
          readOnly={readOnly}
          aria-label={label}
          onChange={(v) => { if (v !== null) onChange?.(v); }}
          style={{ cursor: readOnly ? 'default' : 'text' }}
        />
        <div className="px-2.5 flex items-center justify-center bg-muted border-l border-border text-[11px] text-muted-foreground whitespace-nowrap shrink-0 select-none">
          {unit}
        </div>
      </div>
    </div>
  );
}

// ─── SelectInput ──────────────────────────────────────────────────────────────

interface SelectInputProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[] | { value: string; label: string }[];
  tip?: string;
}

export function SelectInput({ label, value, onChange, options, tip }: SelectInputProps) {
  const normalized = (options as any[]).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  return (
    <div>
      {label && (
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</span>
          {tip && <InfoTip tip={tip} />}
        </div>
      )}
      <select
        className="cfg-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {normalized.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── SegmentedControl ─────────────────────────────────────────────────────────

interface SegOpt { value: string; label: string }

interface SegmentedControlProps {
  options: SegOpt[];
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}

export function SegmentedControl({ options, value, onChange, fullWidth }: SegmentedControlProps) {
  return (
    <div className={cn(
      'bg-muted rounded-[6px] p-0.5 gap-0.5',
      fullWidth ? 'flex w-full' : 'inline-flex',
    )}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-[5px] rounded-[5px] text-xs select-none cursor-pointer transition-all duration-150 whitespace-nowrap',
              fullWidth && 'flex-1',
              active
                ? 'bg-card text-foreground font-semibold shadow-sm'
                : 'text-muted-foreground font-normal hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── RangeSlider ─────────────────────────────────────────────────────────────

interface RangeMark { value: number; label: string }

interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  marks?: RangeMark[];
  onChange: (v: number) => void;
}

export function RangeSlider({ value, min, max, step = 1, marks, onChange }: RangeSliderProps) {
  return (
    <div>
      <input
        className="cfg-range"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {marks && (
        <div className="flex justify-between mt-0.5">
          {marks.map((m) => (
            <span key={m.value} className="text-[10px] text-muted-foreground leading-none">
              {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  tip?: string;
}

export function ToggleSwitch({ checked, onChange, label, tip }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-foreground">{label}</span>
        {tip && <InfoTip tip={tip} />}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-primary' : 'bg-switch-background',
        )}
      >
        <span className={cn('bg-background pointer-events-none block size-4 rounded-full shadow-sm transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} />
      </button>
    </div>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-muted-foreground tracking-[0.08em] uppercase block">
      {children}
    </span>
  );
}

// ─── ConfigSection (accordion) ────────────────────────────────────────────────

interface ConfigSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ConfigSection({ title, expanded, onToggle, children }: ConfigSectionProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-11 w-full items-center justify-between bg-muted px-3 cursor-pointer select-none transition-colors duration-100 hover:bg-muted"
      >
        <span className="text-[11px] font-semibold text-muted-foreground tracking-[0.08em] uppercase">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-300 ease-out',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <div className={cn(
        'overflow-hidden transition-[max-height] duration-300 ease-in-out',
        expanded ? 'max-h-[600px]' : 'max-h-0',
      )}>
        <div className={cn('bg-card px-3 pb-3 pt-1.5', expanded && 'border-t border-border/80')}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── FieldRow — 2-column grid ─────────────────────────────────────────────────

export function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {children}
    </div>
  );
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────

export function FieldLabel({ children, tip }: { children: React.ReactNode; tip?: string }) {
  return (
    <div className="flex items-center gap-1 mb-1">
      <span className="text-[11px] font-medium text-muted-foreground leading-tight">{children}</span>
      {tip && <InfoTip tip={tip} />}
    </div>
  );
}

// ─── TypeBadge ────────────────────────────────────────────────────────────────

export function TypeBadge({ type }: { type: string }) {
  const b = TYPE_BADGES[type] ?? { bg: 'var(--color-muted)', fg: 'var(--color-muted-foreground)', border: 'var(--color-border)' };
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize"
      style={{ backgroundColor: b.bg, color: b.fg, border: `1px solid ${b.border}` }}
    >
      {type}
    </span>
  );
}

// ─── InlineStepper ────────────────────────────────────────────────────────────

interface InlineStepperProps {
  label: string;
  value: number;
  min?: number;
  onDecrement: () => void;
  onIncrement: () => void;
}

export function InlineStepper({ label, value, min = 1, onDecrement, onIncrement }: InlineStepperProps) {
  const canDecrement = value > min;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground flex-1">{label}</span>
      <button
        type="button"
        onClick={() => canDecrement && onDecrement()}
        className={cn(
          'size-7 border border-border rounded-md flex items-center justify-center text-lg text-foreground select-none transition-colors',
          canDecrement ? 'cursor-pointer hover:bg-muted' : 'cursor-not-allowed opacity-40',
        )}
      >
        −
      </button>
      <span className="text-sm font-bold text-foreground w-8 text-center">{value}</span>
      <button
        type="button"
        onClick={onIncrement}
        className="size-7 border border-border rounded-md flex items-center justify-center text-lg text-foreground cursor-pointer hover:bg-muted select-none transition-colors"
      >
        +
      </button>
    </div>
  );
}

// ─── Scroll hint container ────────────────────────────────────────────────────

/**
 * Wraps a scrollable content area and shows a gradient fade + chevron arrow at
 * the bottom whenever the content overflows below the visible edge.
 * The hint fades out smoothly once the user scrolls to the bottom.
 *
 * Usage: replace the scrollable outer div of a panel with this component.
 * The `className` prop is forwarded to the inner scrollable div (use it for
 * padding, flex direction, etc. — the outer div fills the available space).
 */
export function ScrollHintContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const scrollRef  = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number | null>(null);
  const [showHint, setShowHint] = useState(false);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowHint(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
  }, []);

  // Debounce via rAF so the check always runs after the browser has painted.
  const scheduleCheck = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; check(); });
  }, [check]);

  useEffect(() => {
    const el      = scrollRef.current;
    const content = contentRef.current;
    if (!el) return;

    // Scroll events — immediate is fine here; layout is already done.
    el.addEventListener('scroll', check, { passive: true });

    // Observe the outer container (catches window resize).
    const roOuter = new ResizeObserver(scheduleCheck);
    roOuter.observe(el);

    // Observe the inner content wrapper (catches content additions / accordion opens).
    const roInner = new ResizeObserver(scheduleCheck);
    if (content) roInner.observe(content);

    // Initial check — deferred so the browser has finished its first layout pass.
    scheduleCheck();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      el.removeEventListener('scroll', check);
      roOuter.disconnect();
      roInner.disconnect();
    };
  }, [check, scheduleCheck]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div ref={scrollRef} className={cn('h-full overflow-y-auto', className)}>
        {/* Content wrapper — observed so the hint reacts when sections expand.
            h-full (not min-h-full — that doesn't reliably give descendants a
            definite height to resolve percentage heights against) so a short
            child using h-full (e.g. a centered empty state) actually gets a
            height to center against, instead of collapsing to its own
            content size and rendering pinned at the top. Safe for taller
            content too: overflow stays visible, so it still spills past this
            box and still counts toward the scrollable ancestor's
            scrollHeight, same as before. */}
        <div ref={contentRef} className="h-full">
          {children}
        </div>
      </div>

      {/* Scroll hint — visible whenever content overflows below the fold */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-3 transition-opacity duration-200',
          showHint ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          height: 80,
          background: 'linear-gradient(to top, var(--card, #ffffff) 0%, color-mix(in oklab, var(--card, #ffffff) 85%, transparent) 40%, transparent 100%)',
        }}
      >
        {/* Pill badge — clearly visible against the gradient */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 shadow-sm">
          <ChevronDown className="size-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground">{t('common.scroll')}</span>
        </div>
      </div>
    </div>
  );
}

/** Asked before closing something (a building, a surface) that has edits since it was last saved. */
export function UnsavedChangesDialog({
  open,
  onCancel,
  onSave,
  onDiscard,
  message,
  note,
}: {
  open: boolean;
  onCancel: () => void;
  onSave: () => void;
  onDiscard: () => void;
  message?: string;
  note?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  // showModal, not the open attribute: it traps focus, puts the dialog in the
  // top layer over everything, and makes the rest of the page inert. Opened a
  // frame later: shown during the Escape press that asked for it, the dialog
  // would take that same press as its own cancel and close at once.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const frame = requestAnimationFrame(() => { if (!dialog.open) dialog.showModal(); });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      // Escape: the parent decides whether it closes.
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      // A click on the dialog element itself, not its content, is on the backdrop.
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      className="m-auto w-[calc(100%-32px)] max-w-md overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex gap-3 px-5 pb-4 pt-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="m-0 text-base font-semibold text-foreground">
            {t('common.unsaved.title')}
          </h2>
          <p id={messageId} className="m-0 text-sm text-foreground">
            {message ?? t('common.unsaved.message')}
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            {note ?? t('common.unsaved.note')}
          </p>
        </div>
      </div>

      {/* Discard sits apart from the safe pair; a long translation wraps whole buttons, never a label. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-5 py-3">
        <button
          type="button"
          onClick={onDiscard}
          className="cursor-pointer whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          {t('common.unsaved.discard')}
        </button>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="cursor-pointer whitespace-nowrap rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t('common.unsaved.continueEditing')}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="cursor-pointer whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t('common.unsaved.saveAndClose')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
