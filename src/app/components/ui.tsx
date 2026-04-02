/**
 * Building Configurator Design System
 * Shared primitive components and design tokens.
 *
 * Styled with Tailwind CSS + CSS variables to match the EnerPlanET UI.
 * Radix UI is used for Tooltip and Switch; all other components are plain HTML.
 */
import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Info, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function InfoTip({ tip }: { tip: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="inline-flex items-center cursor-help shrink-0">
            <Info className="size-3 text-muted-foreground" />
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={4}
            className="z-[9999] bg-foreground text-background text-[11px] leading-snug rounded-md px-2.5 py-1.5 max-w-[200px] shadow-md animate-in fade-in-0 zoom-in-95"
          >
            {tip}
            <TooltipPrimitive.Arrow className="fill-foreground" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
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
}

export function NumberInput({
  label, value, onChange, unit, min, max, step = 0.01,
  tip, readOnly = false, width,
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
        <input
          className="cfg-number"
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          readOnly={readOnly}
          onChange={(e) => {
            if (!onChange) return;
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
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
      'inline-flex bg-muted rounded-md p-0.5 gap-0.5',
      fullWidth && 'flex w-full',
    )}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-[5px] rounded text-xs select-none cursor-pointer transition-all duration-150 whitespace-nowrap',
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
  label: string;
  tip?: string;
}

export function ToggleSwitch({ checked, onChange, label, tip }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-foreground">{label}</span>
        {tip && <InfoTip tip={tip} />}
      </div>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onChange}
        className="peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-background inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SwitchPrimitive.Thumb className="bg-background pointer-events-none block size-4 rounded-full shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
      </SwitchPrimitive.Root>
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
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full h-11 px-3 flex items-center justify-between cursor-pointer select-none hover:bg-muted transition-colors duration-100"
      >
        <span className="text-[11px] font-semibold text-muted-foreground tracking-[0.08em] uppercase">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <div
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
        style={{ maxHeight: expanded ? 600 : 0 }}
      >
        <div className={cn('px-3 pb-3 pt-1.5', expanded && 'border-t border-border')}>
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
