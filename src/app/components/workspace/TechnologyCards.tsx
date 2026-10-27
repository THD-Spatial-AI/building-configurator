// The technologies the host has installed on a building, one card each in its
// topic's colour, one card in focus at a time. The host owns every value and
// label; the cards show them and report edits. Nothing is stored here.

import { useState, type ReactNode } from 'react';
import { Trash2 } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { technologyTopic, type Topic } from '@/app/config/topics';
import { useFormatNumber, useT, type FormatNumber } from '../../i18n';
import { DecimalInput } from '../BuildingConfigurator/shared/ui';

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

/** A headline number of a technology, such as its power or COP. Null shows as "∞" (sized by the optimiser). */
export interface TechFigure {
  label: string;
  value: number | null;
  unit?: string;
}

/** A figure as a card's headline: with its unit, or with its label where it has none (COP 3.3). */
function headlineText(figure: TechFigure, format: FormatNumber): string {
  const value = formatValue(figure.value, format);
  return figure.unit ? `${value} ${figure.unit}` : `${figure.label} ${value}`;
}

/** A product the host offers for a technology. */
export interface TechProductOption {
  id: string;
  name: string;
  /** One line under the name, such as its key figures. */
  detail?: string;
}

/** One installed technology. Titles and labels arrive in the user's language. */
export interface TechCard {
  id: string;
  title: string;
  subtitle?: string;
  fields: TechField[];
  /** EnerPlanET's technology type (battery_storage, air_source_heat_pump, ...): sets the card's icon and colour. */
  type?: string;
  /** Up to three headline numbers; the first is shown while the card is not in focus. */
  figures?: TechFigure[];
  /** The investment estimate; with `amount` null, `rate` (such as "1,400 EUR/kW") is shown instead. */
  investment?: { amount: number | null; currency: string; rate?: string };
  /** The products to choose from, behind a drop-down with a search field. */
  catalogue?: { products: TechProductOption[]; productId?: string; onSelect: (productId: string) => void };
  /** A button on the card. */
  action?: { label: string; onClick: () => void };
}

/**
 * The building's technologies. Hold the object and its callbacks stable, as
 * for `services`: the cards show the next `items` the host passes.
 */
export interface Technologies {
  items: TechCard[];
  /** A field was edited; fires with each valid number typed, and with null when the input is cleared. */
  onChange: (id: string, fieldKey: string, value: number | null) => void;
  onRemove: (id: string) => void;
  /** Opens the host's own way to add a technology; without it there is no "Add a technology" button. */
  onAdd?: () => void;
}

function formatValue(value: number | null, format: FormatNumber): string {
  if (value === null) return '∞';
  return format(value, { min: 0, max: 2 });
}

/** An editable field: empty with a "∞" placeholder when unbounded, a red ring and message on error. */
function FieldInput({ field, onChange }: { field: TechField; onChange: (value: number | null) => void }) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium leading-tight text-muted-foreground">{field.label}</span>
      <div className={cn('cfg-input-wrap', field.error && 'ring-2 ring-destructive/60')}>
        <DecimalInput
          className="cfg-number"
          aria-label={field.label}
          aria-invalid={field.error ? true : undefined}
          value={field.value}
          placeholder="∞"
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={onChange}
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

/**
 * The frame every technology shares: a header band in its topic's colour with
 * a headline figure, a line with its products and cost, and, in focus, its
 * detail. Clicking the header opens or closes it.
 */
export function TechCardFrame({ topic, title, headline, subtitle, cost, focused, onFocus, onRemove, removeLabel, children }: {
  topic: Topic;
  title: string;
  headline?: string;
  subtitle?: string;
  cost?: string;
  focused: boolean;
  onFocus: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <section className={cn('overflow-hidden rounded-lg bg-card', focused ? cn('border-2', topic.border) : 'border border-border')}>
      <div className={cn('flex items-center gap-2 px-3 py-2', topic.tile)}>
        <button
          type="button"
          aria-expanded={focused}
          onClick={onFocus}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <topic.Icon className={cn('size-4 shrink-0', topic.icon)} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{title}</span>
          {focused
            ? <span className="shrink-0 text-[11px] font-bold">{t('tech.inFocus')}</span>
            : headline && <span className="shrink-0 text-[12px] font-semibold tabular-nums">{headline}</span>}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            title={removeLabel}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-card/60 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {(subtitle || cost) && (
        <div className="flex items-baseline justify-between gap-2 px-3 py-1.5 text-[12px]">
          <span className="min-w-0 truncate text-muted-foreground">{subtitle}</span>
          {cost && <span className="shrink-0 font-semibold tabular-nums text-[#2F7A4F] dark:text-[#8FD1A9]">{cost}</span>}
        </div>
      )}
      {focused && children}
    </section>
  );
}

/** A product picker behind a drop-down, with a search field for a long catalogue. */
function CatalogueSelect({ catalogue }: { catalogue: NonNullable<TechCard['catalogue']> }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const current = catalogue.products.find((product) => product.id === catalogue.productId);
  const needle = query.trim().toLowerCase();
  const shown = needle ? catalogue.products.filter((product) => product.name.toLowerCase().includes(needle)) : catalogue.products;
  return (
    <details className="group rounded-md border border-border">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-[12px] text-foreground">
        <span className="min-w-0 truncate">
          <span className="text-muted-foreground">{t('tech.product')}: </span>{current?.name ?? t('pv.product.none')}
        </span>
        <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="flex flex-col gap-1.5 border-t border-border p-2">
        <input
          type="search"
          aria-label={t('pv.catalogue.search')}
          placeholder={t('pv.catalogue.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-[12px] text-foreground"
        />
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {shown.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                aria-pressed={product.id === catalogue.productId}
                onClick={() => catalogue.onSelect(product.id)}
                className={cn(
                  'w-full cursor-pointer rounded-md border px-2.5 py-1.5 text-left',
                  product.id === catalogue.productId ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted',
                )}
              >
                <span className="block text-[12px] font-semibold text-foreground">{product.name}</span>
                {product.detail && <span className="block text-[11px] text-muted-foreground">{product.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** A card's investment as shown: the amount, else its rate. */
export function investmentText(investment: TechCard['investment'], format: FormatNumber): string | undefined {
  if (!investment) return undefined;
  if (investment.amount !== null) return `${format(investment.amount, 0)} ${investment.currency}`.trim();
  return investment.rate;
}

/** The detail of a host's card in focus: its figures, product, values and action. */
function CardBody({ card, technologies }: { card: TechCard; technologies: Technologies }) {
  const format = useFormatNumber();
  return (
    <div className="flex flex-col gap-2.5 px-3 pb-3 pt-1">
      {card.figures && card.figures.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {card.figures.slice(0, 3).map((figure) => (
            <div key={figure.label}>
              <div className="text-[10px] text-muted-foreground">{figure.label}</div>
              <div className="text-[13px] font-bold tabular-nums text-foreground">
                {formatValue(figure.value, format)}{figure.unit && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{figure.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {card.catalogue && card.catalogue.products.length > 0 && <CatalogueSelect catalogue={card.catalogue} />}
      <div className="flex flex-col gap-2">
        {card.fields.map((field) => (field.editable ? (
          <FieldInput key={field.key} field={field} onChange={(value) => technologies.onChange(card.id, field.key, value)} />
        ) : (
          <div key={field.key}>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">{field.label}</span>
              <span className="text-[12px] font-semibold text-foreground">
                {formatValue(field.value, format)}
                {field.unit && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{field.unit}</span>}
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
          className="flex w-full cursor-pointer items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {card.action.label}
        </button>
      )}
    </div>
  );
}

/** The host's cards, one in focus, or a line saying there are none. */
export function TechnologyCards({ technologies, focusId, onFocus }: {
  technologies: Technologies;
  /** The card in focus; without it the cards keep their own, the first one. */
  focusId?: string | null;
  /** The card to bring into focus, or null when the card in focus was closed. */
  onFocus?: (id: string | null) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const [ownFocus, setOwnFocus] = useState<string | null>(technologies.items[0]?.id ?? null);
  const focused = focusId === undefined ? ownFocus : focusId;
  if (technologies.items.length === 0) {
    return <p className="text-[12px] text-muted-foreground">{t('tech.none')}</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {technologies.items.map((card) => {
        const first = card.figures?.[0];
        return (
          <TechCardFrame
            key={card.id}
            topic={technologyTopic(card.type ?? '')}
            title={card.title}
            headline={first && headlineText(first, format)}
            subtitle={card.subtitle}
            cost={investmentText(card.investment, format)}
            focused={focused === card.id}
            onFocus={() => (onFocus ?? setOwnFocus)(focused === card.id ? null : card.id)}
            onRemove={() => technologies.onRemove(card.id)}
            removeLabel={t('tech.remove', { title: card.title })}
          >
            <CardBody card={card} technologies={technologies} />
          </TechCardFrame>
        );
      })}
    </div>
  );
}
