// The building's PV on the Technologies tab: totals and costs, the products
// installed (each with its values behind an edit button), the products to drag
// onto a surface, and the surfaces that take PV.

import { useState, type ReactNode } from 'react';
import { ChevronDown, CircleHelp, GripVertical, Pencil, Sun } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { DecimalInput, Dropdown, DROPDOWN_LIST, OPTION_ROW, SearchField, Switch } from '../BuildingConfigurator/shared/ui';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT } from '../../i18n';
import { fittedPvIds, installedByProduct, pvSummary } from '../../lib/pvSurfaces';
import type { PvLayout } from '../../lib/pvLayout';
import {
  constraintNumber, productCurrency, productModule, productName, PV_PRODUCT_DRAG_TYPE, shownConstraints, sortProducts,
  type ProductOrder, type TechnologyConstraint, type TechnologyProduct,
} from '../../lib/pvProducts';
import { DEFAULT_PV_MODULE } from '../../lib/pvLayout';
import { GeometryLine, surfaceName, surfaceProduct, type PvMode, type PvSurface } from './PvMode';

const STATE_ORDER: PvSurface['state'][] = ['installed', 'suggested', 'available'];
/** Plain-language labels for the constraints basic mode asks; others show the catalogue's own name. */
const QUESTION_KEYS = new Set(['cost_energy_cap', 'cost_om_annual', 'cont_lifetime']);

/** The surfaces offered for PV: those some option fits on, and any with PV on. */
function offeredIds(pv: PvMode, available: ReadonlySet<string> | undefined): string[] {
  return Object.entries(pv.surfaces)
    .filter(([id, surface]) => !available || available.has(id) || surface.state === 'installed')
    .map(([id]) => id);
}

/** Capacity, surfaces with PV, investment and yearly O&M, as tiles. */
function Totals({ pv, available, elements, layouts }: {
  pv: PvMode;
  available?: ReadonlySet<string>;
  elements: Record<string, BuildingElement>;
  layouts: Readonly<Record<string, PvLayout>>;
}) {
  const t = useT();
  const format = useFormatNumber();
  const summary = pvSummary(pv.surfaces, elements, layouts, (id) => surfaceProduct(pv, id));
  const currency = productCurrency(Object.keys(pv.surfaces).map((id) => surfaceProduct(pv, id)).find(Boolean));
  const money = (value: number) => `${format(value, 0)} ${currency}`.trim();
  const tiles = [
    [`${format(summary.kwp, 1)} kWp`, t('pv.summary.capacity')],
    [t('pv.summary.count', { installed: summary.installed, total: offeredIds(pv, available).length }), t('pv.summary.surfaces')],
    ...(summary.investment === undefined ? [] : [[money(summary.investment), t('pv.cost.investment')]]),
    ...(summary.omPerYear === undefined ? [] : [[money(summary.omPerYear), t('pv.cost.omPerYear')]]),
  ];
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([value, label]) => (
          <div key={label} className="rounded-md bg-muted px-2.5 py-2">
            <div className="text-[15px] font-bold tabular-nums text-foreground">{value}</div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {summary.investment !== undefined && <span className="text-[10px] text-muted-foreground">{t('pv.cost.estimateNote')}</span>}
    </div>
  );
}

/** Every surface some PV option fits on, with its switch, collapsed by default since the list can be long. */
function SurfaceList({ pv, available, elements, layouts, onSelect }: {
  pv: PvMode;
  available?: ReadonlySet<string>;
  elements: Record<string, BuildingElement>;
  layouts: Readonly<Record<string, PvLayout>>;
  onSelect: (surfaceId: string) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const offered = new Set(offeredIds(pv, available));
  const entries = Object.entries(pv.surfaces).filter(([id]) => offered.has(id));
  const installedCount = fittedPvIds(pv.surfaces, layouts).length;
  const suggestedIds = entries.filter(([, s]) => s.state === 'suggested').map(([id]) => id);
  const ordered = STATE_ORDER.flatMap((state) => entries
    .filter(([, surface]) => surface.state === state)
    .sort(([a], [b]) => surfaceName(a, elements, pv.surfaces).localeCompare(surfaceName(b, elements, pv.surfaces), undefined, { numeric: true })));

  return (
    <Dropdown title={t('pv.surfaces.toggle', { name: t('pv.surfaces.name'), installed: installedCount, total: entries.length })}>
      <ul className={DROPDOWN_LIST}>
        {ordered.map(([id, surface]) => {
          const name = surfaceName(id, elements, pv.surfaces);
          const installed = surface.state === 'installed';
          const kwp = layouts[id]?.kwp ?? surface.maxKwp;
          return (
            <li key={id} className={cn(OPTION_ROW, 'flex items-center gap-2.5', surface.state === 'suggested' && 'border-amber-500/40 bg-amber-500/5')}>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    className="min-w-0 cursor-pointer truncate text-left text-[13px] font-semibold text-foreground hover:underline"
                  >{name}</button>
                  {surface.state === 'suggested' && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{t('pv.state.suggested')}</span>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  <GeometryLine id={id} elements={elements} surface={surface} />
                </div>
              </div>
              {installed && layouts[id]?.count === 0 ? (
                <span className="shrink-0 text-[11px] font-medium text-destructive">{t('pv.card.noFitShort')}</span>
              ) : (
                <span className={cn('shrink-0 text-[12px]', installed ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                  {installed ? `${format(kwp, 1)} kWp` : t('pv.upTo', { kwp: format(kwp, 1) })}
                </span>
              )}
              <Switch on={installed} label={t('pv.toggle', { surface: name })} onChange={(on) => pv.onToggle(id, on)} />
            </li>
          );
        })}
      </ul>
      <div>
        <button
          type="button"
          disabled={suggestedIds.length === 0}
          onClick={() => suggestedIds.forEach((id) => pv.onToggle(id, true))}
          className="h-8 cursor-pointer rounded-md border border-border bg-card px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >{t('pv.useSuggested')}</button>
      </div>
    </Dropdown>
  );
}

/**
 * The products installed on this building, one row each with its surfaces,
 * modules and capacity, and an edit button that opens the product's values.
 */
function Installed({ pv, layouts, mode }: { pv: PvMode; layouts: Readonly<Record<string, PvLayout>>; mode: 'basic' | 'expert' }) {
  const t = useT();
  const format = useFormatNumber();
  const [editing, setEditing] = useState<string | null>(null);
  const rows = installedByProduct(pv.surfaces, layouts, (id) => surfaceProduct(pv, id));
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="m-0 text-[13px] font-semibold text-foreground">{t('pv.installed.title')}</h3>
      {rows.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{t('pv.installed.empty')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((row) => {
            const product = row.product && (pv.products?.[row.product.id] ?? row.product);
            const open = product !== undefined && editing === product.id;
            return (
              <li key={row.product?.id ?? ''} className="flex flex-col">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-foreground">{product ? productName(product) : t('pv.product.none')}</div>
                    <div className="text-[11px] text-muted-foreground">{t('pv.installed.surfaces', { count: row.surfaces })}</div>
                  </div>
                  <div className="ml-auto shrink-0 text-right text-[12px] tabular-nums text-foreground">
                    {row.modules !== undefined && <div className="font-semibold">{t('pv.installed.modules', { count: row.modules })}</div>}
                    <div className={row.modules === undefined ? 'font-semibold' : 'text-[11px] text-muted-foreground'}>{format(row.kwp, 1)} kWp</div>
                  </div>
                  {product && pv.onConstraintChange && (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={t('pv.values.edit', { name: productName(product) })}
                      title={t('pv.values.edit', { name: productName(product) })}
                      onClick={() => setEditing(open ? null : product.id)}
                      className={cn(
                        'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors',
                        open ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted',
                      )}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                </div>
                {open && product && (
                  <div className="border-t border-border bg-muted/40 p-3">
                    <ProductValues pv={pv} product={product} mode={mode} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The catalogue's PV products behind a drop-down, each draggable onto a surface in the 3D view. */
/** The steps to install PV on a surface, closed until opened. */
/** A translated line with each {placeholder} drawn bold, as the control it names. */
function withLabels(template: string, labels: Record<string, string>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name && name in labels ? <b key={i} className="font-semibold">{labels[name]}</b> : part;
  });
}

/** The ways to add and remove PV, one bullet each; open until the building has PV. */
function InstallHelp({ hasPv }: { hasPv: boolean }) {
  const t = useT();
  const methods = ['drag', 'click', 'all', 'remove'] as const;
  // The lines name the controls by the controls' own strings, so they match in every language.
  const labels = {
    options: t('pv.catalogue.name'),
    surfaces: t('pv.surfaces.name'),
    install: t('pv.thisSurface'),
    suggested: t('pv.state.suggested'),
    useSuggested: t('pv.useSuggested'),
  };
  return (
    <details open={!hasPv} className="group rounded-lg border border-sky-500/30 bg-sky-500/5">
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2 text-[12px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <CircleHelp className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <span className="flex-1">{t('pv.help.title')}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="m-0 flex list-disc flex-col gap-1 py-2 pl-8 pr-3 text-[12px] leading-snug text-foreground">
        {methods.map((method) => (
          <li key={method}>
            <b className="font-semibold">{t(`pv.help.lead.${method}`)}:</b> {withLabels(t(`pv.help.${method}`), labels)}
          </li>
        ))}
      </ul>
    </details>
  );
}

const SORT_ORDERS: readonly ProductOrder[] = ['name', 'cost', 'capacity', 'size'];

function Catalogue({ pv }: { pv: PvMode }) {
  const t = useT();
  const format = useFormatNumber();
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<ProductOrder>('name');
  if (!pv.catalogue?.length) return null;
  const needle = query.trim().toLowerCase();
  const found = needle ? pv.catalogue.filter((product) => productName(product).toLowerCase().includes(needle)) : pv.catalogue;
  const shown = sortProducts(found, order, pv.module ?? DEFAULT_PV_MODULE);
  return (
    <Dropdown title={t('pv.catalogue.toggle', { name: t('pv.catalogue.name'), count: pv.catalogue.length })}>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><SearchField label={t('pv.options.search')} value={query} onChange={setQuery} /></div>
          <div className="w-40 shrink-0">
            <select className="cfg-select" aria-label={t('pv.sort.label')} value={order} onChange={(e) => setOrder(e.target.value as ProductOrder)}>
              {SORT_ORDERS.map((option) => <option key={option} value={option}>{t(`pv.sort.${option}`)}</option>)}
            </select>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] font-medium leading-snug text-foreground">
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />{t('pv.catalogue.hint')}
        </p>
        <ul className={DROPDOWN_LIST}>
          {shown.map((product) => {
            const module = productModule(product, pv.module ?? DEFAULT_PV_MODULE);
            const perKwp = constraintNumber(product, 'cost_energy_cap');
            return (
              <li
                key={product.id}
                draggable={Boolean(pv.onAssignProduct)}
                onDragStart={(e) => { e.dataTransfer.setData(PV_PRODUCT_DRAG_TYPE, product.id); e.dataTransfer.effectAllowed = 'copy'; }}
                title={t('pv.catalogue.drag')}
                className={cn(OPTION_ROW, 'flex cursor-grab items-center gap-2 active:cursor-grabbing active:shadow-lg')}
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-foreground">{productName(product)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t('pv.catalogue.module', { width: format(module.width, 2), height: format(module.height, 2), watts: format(module.kwp * 1000, 0) })}
                    {perKwp !== undefined && ` · ${format(perKwp, 0)} ${productCurrency(product)}/kWp`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
    </Dropdown>
  );
}

/** One constraint as a number field, an option list, or text for a value such as "INF". */
function ConstraintField({ constraint, label, onChange }: {
  constraint: TechnologyConstraint;
  label: string;
  onChange: (value: number | string) => void;
}) {
  const value = constraint.default_value;
  const input = constraint.options?.length ? (
    <select
      aria-label={label}
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 min-w-0 flex-1 cursor-pointer bg-card px-2 text-[12px] text-foreground outline-none"
    >
      {constraint.options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  ) : typeof value === 'number' || value === 'INF' || value === null ? (
    <DecimalInput
      className="cfg-number"
      aria-label={label}
      value={typeof value === 'number' ? value : null}
      placeholder="∞"
      onChange={(next) => onChange(next ?? 'INF')}
    />
  ) : (
    <input
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 min-w-0 flex-1 bg-card px-2 text-[12px] text-foreground outline-none"
    />
  );
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium leading-tight text-muted-foreground">{label}</span>
      <div className="cfg-input-wrap">
        {input}
        {constraint.unit && (
          <div className="flex shrink-0 select-none items-center whitespace-nowrap border-l border-border bg-muted px-2.5 text-[11px] text-muted-foreground">
            {constraint.unit}
          </div>
        )}
      </div>
    </div>
  );
}

/** Saves the shown product's values for this building as a new product of the user's own. */
function SaveAsTechnology({ product, onSave }: { product: TechnologyProduct; onSave: (productId: string, name: string) => Promise<string> }) {
  const t = useT();
  const [name, setName] = useState(() => t('pv.values.copyName', { name: productName(product) }));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const save = () => {
    setStatus('saving');
    onSave(product.id, name.trim()).then(() => setStatus('saved'), () => setStatus('failed'));
  };
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
      <span className="text-[11px] font-medium text-muted-foreground">{t('pv.values.saveAs')}</span>
      <div className="flex gap-2">
        <input
          aria-label={t('pv.values.saveAs')}
          value={name}
          onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-[12px] text-foreground"
        />
        <button
          type="button"
          disabled={!name.trim() || status === 'saving'}
          onClick={save}
          className="h-8 shrink-0 cursor-pointer rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >{t('pv.values.save')}</button>
      </div>
      {status === 'saved' && <span className="text-[11px] text-emerald-700 dark:text-emerald-400">{t('pv.values.saved', { name })}</span>}
      {status === 'failed' && <span className="text-[11px] text-destructive">{t('pv.values.saveFailed')}</span>}
    </div>
  );
}

/** One installed product's values: basic questions, or every simulation value in expert mode. */
export function ProductValues({ pv, product, mode }: { pv: PvMode; product: TechnologyProduct; mode: 'basic' | 'expert' }) {
  const t = useT();
  const constraints = shownConstraints(product, mode);
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[11px] leading-snug text-muted-foreground">{t('pv.values.buildingOnly', { name: productName(product) })}</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {constraints.map((constraint) => (
          <ConstraintField
            key={constraint.key}
            constraint={constraint}
            label={QUESTION_KEYS.has(constraint.key) ? t(`pv.values.question.${constraint.key}`) : constraint.alias ?? constraint.key}
            onChange={(value) => pv.onConstraintChange?.(product.id, constraint.key, value)}
          />
        ))}
      </div>
      {pv.onSaveAsTechnology && <SaveAsTechnology key={product.id} product={product} onSave={pv.onSaveAsTechnology} />}
    </div>
  );
}

/** The PV block of the Technologies tab. */
export function PvOverview({ pv, available, elements, layouts = {}, mode, onSelect, framed = false }: {
  pv: PvMode;
  /** The surfaces some PV option fits on; without it every surface the host offers. */
  available?: ReadonlySet<string>;
  elements: Record<string, BuildingElement>;
  /** Module layouts of the surfaces the view has polygons for. */
  layouts?: Readonly<Record<string, PvLayout>>;
  mode: 'basic' | 'expert';
  /** Shows a surface in the model and opens it in the surface panel. */
  onSelect: (surfaceId: string) => void;
  /** Inside a technology card, which carries the title: no border or heading of its own. */
  framed?: boolean;
}) {
  const t = useT();
  return (
    <section className={cn('flex flex-col gap-3', framed ? 'px-3 pb-3 pt-1' : 'rounded-lg border border-border bg-card p-4')}>
      {!framed && (
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-[15px] font-bold text-foreground">{t('pv.overview.title')}</h2>
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Sun className="size-3.5 text-yellow-500" aria-hidden />{pv.typeLabel}
          </p>
        </div>
      )}
      <Totals pv={pv} available={available} elements={elements} layouts={layouts} />
      <InstallHelp hasPv={fittedPvIds(pv.surfaces, layouts).length > 0} />
      <Installed pv={pv} layouts={layouts} mode={mode} />
      <Catalogue pv={pv} />
      <SurfaceList pv={pv} available={available} elements={elements} layouts={layouts} onSelect={onSelect} />
      <p className="text-[11px] leading-snug text-muted-foreground">{pv.notice}</p>
    </section>
  );
}
