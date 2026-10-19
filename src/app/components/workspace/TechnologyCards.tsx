// The technologies the host has installed on a building, one card each. The
// host owns every value and label; the cards show them and report edits.
// Nothing is stored here.

import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One value on a technology card. */
export interface TechField {
  key: string;
  label: string;
  /** Null is unbounded, for example a maximum size the optimiser chooses; shown as "∞". */
  value: number | null;
  unit?: string;
  /** Shown as a number input when true, as plain text otherwise. */
  editable?: boolean;
  /** Passed to the input as hints; the host clamps. */
  min?: number;
  max?: number;
  step?: number;
  /** Set by the host when the value is refused; shown under the field until the host clears it. */
  error?: string;
}

/** One installed technology. Titles and labels arrive in the user's language. */
export interface TechCard {
  id: string;
  title: string;
  subtitle?: string;
  fields: TechField[];
  /** A button on the card, for example one that opens PV mode. */
  action?: { label: string; onClick: () => void };
}

/**
 * The building's technologies. Hold the object and both callbacks stable, as
 * for `services`: the cards show the next `items` the host passes.
 */
export interface Technologies {
  items: TechCard[];
  /** A field was edited; fires with each valid number typed, and with null when the input is cleared. */
  onChange: (id: string, fieldKey: string, value: number | null) => void;
  onRemove: (id: string) => void;
}

function formatValue(value: number | null): string {
  if (value === null) return '∞';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * What an edit to a number input reports: null for a cleared input, the number
 * typed, or undefined to report nothing. A half-typed number such as "-" also
 * reads as '', flagged as bad input.
 */
export function fieldValueFromInput(raw: string, badInput: boolean): number | null | undefined {
  if (raw === '') return badInput ? undefined : null;
  const value = parseFloat(raw);
  return Number.isNaN(value) ? undefined : value;
}

/** An editable field: empty with a "∞" placeholder when unbounded, a red ring and message on error. */
function FieldInput({ field, onChange }: { field: TechField; onChange: (value: number | null) => void }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium leading-tight text-muted-foreground">{field.label}</span>
      <div className={cn('cfg-input-wrap', field.error && 'ring-2 ring-destructive/60')}>
        <input
          className="cfg-number"
          type="number"
          aria-label={field.label}
          aria-invalid={field.error ? true : undefined}
          value={field.value ?? ''}
          placeholder="∞"
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => {
            const value = fieldValueFromInput(e.target.value, e.target.validity.badInput);
            if (value !== undefined) onChange(value);
          }}
        />
        {field.unit && (
          <div className="flex shrink-0 select-none items-center justify-center whitespace-nowrap border-l border-border bg-muted px-2.5 text-[11px] text-muted-foreground">
            {field.unit}
          </div>
        )}
      </div>
      {field.error && <p className="mt-1 text-[10px] leading-snug text-destructive">{field.error}</p>}
    </div>
  );
}

/** The cards, or a line saying there are none. */
export function TechnologyCards({ technologies }: { technologies: Technologies }) {
  if (technologies.items.length === 0) {
    return <p className="text-[12px] text-muted-foreground">No technologies on this building.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {technologies.items.map((card) => (
        <div key={card.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-800">{card.title}</p>
              {card.subtitle && <p className="truncate text-[11px] text-muted-foreground">{card.subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={() => technologies.onRemove(card.id)}
              aria-label={`Remove ${card.title}`}
              title={`Remove ${card.title}`}
              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {card.fields.map((field) => (field.editable ? (
              <FieldInput
                key={field.key}
                field={field}
                onChange={(value) => technologies.onChange(card.id, field.key, value)}
              />
            ) : (
              <div key={field.key}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">{field.label}</span>
                  <span className="text-[12px] font-semibold text-slate-700">
                    {formatValue(field.value)}
                    {field.unit && <span className="ml-1 text-[10px] font-normal text-slate-400">{field.unit}</span>}
                  </span>
                </div>
                {field.error && <p className="mt-1 text-[10px] leading-snug text-destructive">{field.error}</p>}
              </div>
            )))}
          </div>

          {card.action && (
            <button
              type="button"
              onClick={card.action.onClick}
              className="mt-3 flex w-full cursor-pointer items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {card.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
