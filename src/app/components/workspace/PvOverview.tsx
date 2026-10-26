// The building's PV on the Technologies tab: totals and costs, the surfaces
// that take PV, the catalogue to drag products from, and the values of the
// products the building uses.

import { useState } from 'react';
import { Sun } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { DecimalInput } from '../BuildingConfigurator/shared/ui';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT } from '../../i18n';
import { installedByProduct, pvSummary } from '../../lib/pvSurfaces';
import type { PvLayout } from '../../lib/pvLayout';
import {
  constraintNumber, productCurrency, productModule, productName, PV_PRODUCT_DRAG_TYPE, shownConstraints,
  type TechnologyConstraint, type TechnologyProduct,
} from '../../lib/pvProducts';
import { DEFAULT_PV_MODULE } from '../../lib/pvLayout';
import { GeometryLine, surfaceName, surfaceProduct, Switch, type PvMode, type PvSurface } from './PvMode';

const STATE_ORDER: PvSurface['state'][] = ['installed', 'suggested', 'available'];
/** Plain-language labels for the constraints basic mode asks; others show the catalogue's own name. */
const QUESTION_KEYS = new Set(['cost_energy_cap', 'cost_om_annual', 'cont_lifetime']);

/** Capacity, surfaces with PV, investment and yearly O&M, as tiles. */
function Totals({ pv, elements, layouts }: { pv: PvMode; elements: Record<string, BuildingElement>; layouts: Readonly<Record<string, PvLayout>> }) {
  const t = useT();
  const format = useFormatNumber();
  const summary = pvSummary(pv.surfaces, elements, layouts, (id) => surfaceProduct(pv, id));
  const currency = productCurrency(Object.keys(pv.surfaces).map((id) => surfaceProduct(pv, id)).find(Boolean));
  const money = (value: number) => `${format(value, 0)} ${currency}`.trim();
  const tiles = [
    [`${format(summary.kwp, 1)} kWp`, t('pv.summary.capacity')],
    [t('pv.summary.count', { installed: summary.installed, total: summary.total }), t('pv.summary.surfaces')],
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

/** Every surface that takes PV with its switch, collapsed by default since the list can be long. */
function SurfaceList({ pv, elements, layouts, onSelect }: {
  pv: PvMode;
  elements: Record<string, BuildingElement>;
  layouts: Readonly<Record<string, PvLayout>>;
  onSelect: (surfaceId: string) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const entries = Object.entries(pv.surfaces);
  const installedCount = entries.filter(([, s]) => s.state === 'installed').length;
  const suggestedIds = entries.filter(([, s]) => s.state === 'suggested').map(([id]) => id);
  const ordered = STATE_ORDER.flatMap((state) => entries
    .filter(([, surface]) => surface.state === state)
    .sort(([a], [b]) => surfaceName(a, elements, pv.surfaces).localeCompare(surfaceName(b, elements, pv.surfaces), undefined, { numeric: true })));

  return (
    <details className="group rounded-md border border-border">
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[12px] font-semibold text-foreground">
        {t('pv.surfaces.toggle', { installed: installedCount, total: entries.length })}
        <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {ordered.map(([id, surface]) => {
          const name = surfaceName(id, elements, pv.surfaces);
          const installed = surface.state === 'installed';
          const kwp = layouts[id]?.kwp ?? surface.maxKwp;
          return (
            <li key={id} className={cn('flex items-center gap-2.5 px-3 py-2', surface.state === 'suggested' && 'bg-amber-500/5')}>
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
              <span className={cn('shrink-0 text-[12px]', installed ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {installed ? `${format(kwp, 1)} kWp` : t('pv.upTo', { kwp: format(kwp, 1) })}
              </span>
              <Switch on={installed} label={t('pv.toggle', { surface: name })} onChange={(on) => pv.onToggle(id, on)} />
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border p-2">
        <button
          type="button"
          disabled={suggestedIds.length === 0}
          onClick={() => suggestedIds.forEach((id) => pv.onToggle(id, true))}
          className="h-8 cursor-pointer rounded-md border border-border bg-card px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >{t('pv.useSuggested')}</button>
      </div>
    </details>
  );
}

/** The products installed on this building, one row each with its surfaces, modules and capacity. */
function Installed({ pv, layouts }: { pv: PvMode; layouts: Readonly<Record<string, PvLayout>> }) {
  const t = useT();
  const format = useFormatNumber();
  const rows = installedByProduct(pv.surfaces, layouts, (id) => surfaceProduct(pv, id));
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="m-0 text-[13px] font-semibold text-foreground">{t('pv.installed.title')}</h3>
      {rows.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{t('pv.installed.empty')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((row) => (
            <li key={row.product?.id ?? ''} className="flex items-baseline justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-foreground">{row.product ? productName(row.product) : t('pv.product.none')}</div>
                <div className="text-[11px] text-muted-foreground">{t('pv.installed.surfaces', { count: row.surfaces })}</div>
              </div>
              <div className="shrink-0 text-right text-[12px] tabular-nums text-foreground">
                {row.modules !== undefined && <div className="font-semibold">{t('pv.installed.modules', { count: row.modules })}</div>}
                <div className={row.modules === undefined ? 'font-semibold' : 'text-[11px] text-muted-foreground'}>{format(row.kwp, 1)} kWp</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The catalogue's PV products behind a drop-down, each draggable onto a surface in the 3D view. */
function Catalogue({ pv }: { pv: PvMode }) {
  const t = useT();
  const format = useFormatNumber();
  const [query, setQuery] = useState('');
  if (!pv.catalogue?.length) return null;
  const needle = query.trim().toLowerCase();
  const shown = needle ? pv.catalogue.filter((product) => productName(product).toLowerCase().includes(needle)) : pv.catalogue;
  return (
    <details className="group rounded-md border border-border">
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[12px] font-semibold text-foreground">
        {t('pv.catalogue.toggle', { count: pv.catalogue.length })}
        <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="flex flex-col gap-1.5 border-t border-border p-2">
        <p className="text-[11px] leading-snug text-muted-foreground">{t('pv.catalogue.hint')}</p>
        <input
          type="search"
          aria-label={t('pv.catalogue.search')}
          placeholder={t('pv.catalogue.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-[12px] text-foreground"
        />
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {shown.map((product) => {
            const module = productModule(product, pv.module ?? DEFAULT_PV_MODULE);
            const perKwp = constraintNumber(product, 'cost_energy_cap');
            return (
              <li
                key={product.id}
                draggable={Boolean(pv.onAssignProduct)}
                onDragStart={(e) => { e.dataTransfer.setData(PV_PRODUCT_DRAG_TYPE, product.id); e.dataTransfer.effectAllowed = 'copy'; }}
                className="cursor-grab rounded-md border border-dashed border-border bg-card px-2.5 py-1.5 active:cursor-grabbing"
              >
                <div className="text-[12px] font-semibold text-foreground">{productName(product)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t('pv.catalogue.module', { width: format(module.width, 2), height: format(module.height, 2), watts: format(module.kwp * 1000, 0) })}
                  {perKwp !== undefined && ` · ${format(perKwp, 0)} ${productCurrency(product)}/kWp`}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
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

/** The ids of the products this building uses: its own and those of its surfaces with PV. */
function usedProductIds(pv: PvMode): string[] {
  const ids = new Set<string>();
  if (pv.productId) ids.add(pv.productId);
  for (const surface of Object.values(pv.surfaces)) {
    if (surface.state === 'installed' && surface.productId) ids.add(surface.productId);
  }
  return [...ids];
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

/** The values of a product this building uses: basic questions, or every simulation value in expert mode. */
function ProductValues({ pv, mode }: { pv: PvMode; mode: 'basic' | 'expert' }) {
  const t = useT();
  const ids = usedProductIds(pv);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const id = chosen && ids.includes(chosen) ? chosen : ids[0];
  const product = id ? pv.products?.[id] ?? pv.catalogue?.find((p) => p.id === id) : undefined;
  if (!product || !pv.onConstraintChange) return null;
  const constraints = shownConstraints(product, mode);
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="m-0 text-[13px] font-semibold text-foreground">{t('pv.values.title')}</h3>
      {ids.length > 1 && (
        <select
          aria-label={t('pv.values.product')}
          value={product.id}
          onChange={(e) => setChosen(e.target.value)}
          className="h-8 cursor-pointer rounded-md border border-border bg-card px-2 text-[12px] text-foreground"
        >
          {ids.map((pid) => {
            const p = pv.products?.[pid] ?? pv.catalogue?.find((c) => c.id === pid);
            return <option key={pid} value={pid}>{p ? productName(p) : pid}</option>;
          })}
        </select>
      )}
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
export function PvOverview({ pv, elements, layouts = {}, mode, onSelect }: {
  pv: PvMode;
  elements: Record<string, BuildingElement>;
  /** Module layouts of the surfaces the view has polygons for. */
  layouts?: Readonly<Record<string, PvLayout>>;
  mode: 'basic' | 'expert';
  /** Shows a surface in the model and opens it in the surface panel. */
  onSelect: (surfaceId: string) => void;
}) {
  const t = useT();
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[15px] font-bold text-foreground">{t('pv.overview.title')}</h2>
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Sun className="size-3.5 text-yellow-500" aria-hidden />{pv.typeLabel}
        </p>
      </div>
      <Totals pv={pv} elements={elements} layouts={layouts} />
      <Installed pv={pv} layouts={layouts} />
      <SurfaceList pv={pv} elements={elements} layouts={layouts} onSelect={onSelect} />
      <Catalogue pv={pv} />
      <ProductValues pv={pv} mode={mode} />
      <p className="text-[11px] leading-snug text-muted-foreground">{pv.notice}</p>
    </section>
  );
}
