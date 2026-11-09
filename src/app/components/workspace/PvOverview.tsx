// The building's PV on the Technologies tab: totals and costs, the products
// installed (each with its values behind an edit button), the products to drag
// onto a surface, and the surfaces that take PV.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, CircleHelp, GripVertical, Pencil, Plus, Search, Sun } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { DecimalInput, Dropdown, DROPDOWN_LIST, OPTION_ROW, SearchField, Switch } from '../BuildingConfigurator/shared/ui';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT } from '../../i18n';
import { fittedPvIds, installedByProduct, installedPvIds, pvSummary } from '../../lib/pvSurfaces';
import type { PvLayout } from '../../lib/pvLayout';
import {
  constraintNumber, productCurrency, productModule, productName, PV_PRODUCT_DRAG_TYPE, shownConstraints, sortProducts,
  type ProductOrder, type TechnologyConstraint, type TechnologyProduct,
} from '../../lib/pvProducts';
import { DEFAULT_PV_MODULE } from '../../lib/pvLayout';
import { GeometryLine, surfaceName, surfaceProduct, type PvMode, type PvSurface } from './PvMode';
import { RemoveButton } from './TechnologyCards';
import type { ConfiguratorMode } from '@/app/lib/configuratorMode';

const STATE_ORDER: PvSurface['state'][] = ['installed', 'suggested', 'available'];
/** Plain-language labels for the constraints simple mode asks; others show the catalogue's own name. */
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
  const ordered = (group: [string, PvSurface][]) => STATE_ORDER.flatMap((state) => group
    .filter(([, surface]) => surface.state === state)
    .sort(([a], [b]) => surfaceName(a, elements, pv.surfaces).localeCompare(surfaceName(b, elements, pv.surfaces), undefined, { numeric: true })));
  const groups = [
    { key: 'roof', entries: ordered(entries.filter(([id, surface]) => isRoof(id, elements, surface))) },
    { key: 'wall', entries: ordered(entries.filter(([id, surface]) => !isRoof(id, elements, surface))) },
  ].filter((group) => group.entries.length > 0);

  return (
    <Dropdown
      title={t('pv.surfaces.toggle', { name: t('pv.surfaces.name'), installed: installedCount, total: entries.length })}
      action={<AddToRoofs pv={pv} available={available} elements={elements} />}
    >
      <div className={DROPDOWN_LIST}>
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            <h4 className="m-0 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t(`surface.group.${group.key}`)}</h4>
            <SurfaceRows entries={group.entries} pv={pv} elements={elements} layouts={layouts} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </Dropdown>
  );
}

/** The rows of one group of surfaces, each with its geometry, capacity and switch. */
function SurfaceRows({ entries, pv, elements, layouts, onSelect }: {
  entries: [string, PvSurface][];
  pv: PvMode;
  elements: Record<string, BuildingElement>;
  layouts: Readonly<Record<string, PvLayout>>;
  onSelect: (surfaceId: string) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  return (
    <ul className="flex flex-col gap-1.5">
      {entries.map(([id, surface]) => {
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
  );
}

const CHOICE = 'h-8 cursor-pointer rounded-md border border-border bg-card px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';

/**
 * A roof by the building's own element type; a surface of the building's other
 * 3D parts has no element, so its tilt decides, walls being vertical.
 */
function isRoof(id: string, elements: Record<string, BuildingElement>, surface: PvSurface): boolean {
  const element = elements[id];
  if (element) return element.type === 'roof';
  return surface.tilt !== undefined && surface.tilt < 90;
}

/** Adds PV to the offered roof surfaces without it: all of them, or only the suggested ones. Walls are never included. */
function AddToRoofs({ pv, available, elements }: {
  pv: PvMode;
  available?: ReadonlySet<string>;
  elements: Record<string, BuildingElement>;
}) {
  const t = useT();
  const roofs = offeredIds(pv, available).filter((id) => pv.surfaces[id].state !== 'installed' && isRoof(id, elements, pv.surfaces[id]));
  const best = roofs.filter((id) => pv.surfaces[id].state === 'suggested');
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  // Low in a short panel the menu would open below its visible part.
  useEffect(() => { if (open) menuRef.current?.scrollIntoView({ block: 'nearest' }); }, [open]);
  // Inside the list's header: a click here must not open or close the list.
  const inHeader = (event: MouseEvent) => { event.preventDefault(); event.stopPropagation(); };
  const add = (ids: string[]) => (event: MouseEvent) => {
    inHeader(event);
    ids.forEach((id) => pv.onToggle(id, true));
    setOpen(false);
  };
  return (
    <span className="relative shrink-0" onClick={inHeader}>
      <button
        type="button"
        aria-expanded={open}
        onClick={(event) => { inHeader(event); setOpen(!open); }}
        className="flex h-7 cursor-pointer items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
      >
        <Plus className="size-3.5" aria-hidden />{t('pv.addRoofs.button')}
      </button>
      {/* The bottom scroll margin keeps the menu above the technologies total pinned to the panel bottom. */}
      <span ref={menuRef} className={cn(open ? 'flex' : 'hidden', 'absolute right-0 top-full z-20 mt-1 w-max scroll-mb-20 flex-col gap-1.5 rounded-md border border-border bg-card p-2 shadow-lg')}>
        <button type="button" disabled={roofs.length === 0} onClick={add(roofs)} className={CHOICE}>{t('pv.addRoofs.all', { count: roofs.length })}</button>
        <button type="button" disabled={best.length === 0} onClick={add(best)} className={CHOICE}>{t('pv.addRoofs.best', { count: best.length })}</button>
      </span>
    </span>
  );
}

/**
 * The products installed on this building, one row each with its surfaces,
 * modules and capacity, an edit button that opens the product's values, and a
 * bin that takes the product off every surface it is on.
 */
function Installed({ pv, layouts, mode }: { pv: PvMode; layouts: Readonly<Record<string, PvLayout>>; mode: ConfiguratorMode }) {
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
                    <div className="truncate text-[12px] font-semibold text-foreground">{product ? productName(product) : pv.typeLabel}</div>
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
                  <RemoveButton
                    label={t('pv.installed.remove', { name: product ? productName(product) : pv.typeLabel })}
                    confirmLabel={t('pv.installed.removeConfirm')}
                    onRemove={() => installedPvIds(pv.surfaces, (id) => surfaceProduct(pv, id), row.product?.id ?? '').forEach((id) => pv.onToggle(id, false))}
                    className="size-7 border border-border bg-card text-muted-foreground hover:bg-muted"
                  />
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
    addRoofs: t('pv.addRoofs.button'),
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
  const [tool, setTool] = useState<'search' | 'sort' | null>(null);
  // Read once, so placing the first product does not close the list the user drags from.
  const [openAtStart] = useState(() => Object.values(pv.surfaces).every((surface) => surface.state !== 'installed'));
  if (!pv.catalogue?.length) return null;
  const needle = query.trim().toLowerCase();
  const found = needle ? pv.catalogue.filter((product) => productName(product).toLowerCase().includes(needle)) : pv.catalogue;
  const shown = sortProducts(found, order, pv.module ?? DEFAULT_PV_MODULE);
  return (
    <Dropdown defaultOpen={openAtStart} title={t('pv.catalogue.toggle', { name: t('pv.catalogue.name'), count: pv.catalogue.length })}>
        <div className="flex items-center gap-1.5">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-medium leading-snug text-foreground">
            <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />{t('pv.catalogue.hint')}
          </p>
          <ToolButton label={t('pv.options.search')} active={tool === 'search' || needle !== ''} open={tool === 'search'} onClick={() => setTool(tool === 'search' ? null : 'search')}>
            <Search className="size-3.5" aria-hidden />
          </ToolButton>
          <ToolButton label={t('pv.sort.label')} active={tool === 'sort' || order !== 'name'} open={tool === 'sort'} onClick={() => setTool(tool === 'sort' ? null : 'sort')}>
            <ArrowUpDown className="size-3.5" aria-hidden />
          </ToolButton>
        </div>
        {tool === 'search' && <SearchField label={t('pv.options.search')} value={query} onChange={setQuery} autoFocus />}
        {tool === 'sort' && (
          <select className="cfg-select" aria-label={t('pv.sort.label')} value={order} onChange={(e) => setOrder(e.target.value as ProductOrder)}>
            {SORT_ORDERS.map((option) => <option key={option} value={option}>{t(`pv.sort.${option}`)}</option>)}
          </select>
        )}
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

/** An icon that shows or hides one of the catalogue's tools; `active` while open or while its setting is in use. */
function ToolButton({ label, active, open, onClick, children }: {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground',
      )}
    >{children}</button>
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

/** One installed product's values: simple-mode questions, or every simulation value in advanced mode. */
export function ProductValues({ pv, product, mode }: { pv: PvMode; product: TechnologyProduct; mode: ConfiguratorMode }) {
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
  mode: ConfiguratorMode;
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
      <Catalogue pv={pv} />
      <SurfaceList pv={pv} available={available} elements={elements} layouts={layouts} onSelect={onSelect} />
      <Installed pv={pv} layouts={layouts} mode={mode} />
      <p className="text-[11px] leading-snug text-muted-foreground">{pv.notice}</p>
    </section>
  );
}
