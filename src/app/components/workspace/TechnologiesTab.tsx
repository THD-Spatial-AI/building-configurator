// The Technologies tab: how many technologies the building has, one card per
// technology, PV included, at most one open at a time (its header opens and
// closes it), the host's way to add another, and the total cost pinned below.

import { useState } from 'react';
import { TOPICS } from '@/app/config/topics';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT } from '../../i18n';
import type { PvLayout } from '../../lib/pvLayout';
import { productCurrency, productName } from '../../lib/pvProducts';
import { installedByProduct, installedPvIds, pvSummary } from '../../lib/pvSurfaces';
import { surfaceProduct, type PvMode } from './PvMode';
import { PvOverview } from './PvOverview';
import { TechCardFrame, TechnologyCards, type Technologies } from './TechnologyCards';
import type { ConfiguratorMode } from '@/app/lib/configuratorMode';

const PV_CARD = 'pv';

export function TechnologiesTab({ pv, available, technologies, elements, layouts, mode, onSelectSurface }: {
  pv?: PvMode;
  /** The surfaces some PV option fits on; without it every surface the host offers. */
  available?: ReadonlySet<string>;
  technologies?: Technologies;
  elements: Record<string, BuildingElement>;
  layouts: Readonly<Record<string, PvLayout>>;
  mode: ConfiguratorMode;
  onSelectSurface: (surfaceId: string) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const [focusId, setFocusId] = useState<string | null>(pv ? PV_CARD : technologies?.items[0]?.id ?? null);

  const productFor = (id: string) => (pv ? surfaceProduct(pv, id) : undefined);
  const summary = pv ? pvSummary(pv.surfaces, elements, layouts, productFor) : null;
  const installed = pv ? installedByProduct(pv.surfaces, layouts, productFor) : [];
  const pvCurrency = pv ? productCurrency(installed.find((row) => row.product)?.product) : '';

  // Only amounts add up; a rate (size still open) has no total yet.
  const amounts = [
    summary?.investment,
    ...(technologies?.items ?? []).map((card) => card.investment?.amount ?? undefined),
  ].filter((amount): amount is number => typeof amount === 'number');
  const currency = pvCurrency || technologies?.items.find((card) => card.investment)?.investment?.currency || '';
  const unsized = (technologies?.items ?? []).filter((card) => card.investment && card.investment.amount === null).length;
  const count = (pv ? 1 : 0) + (technologies?.items.length ?? 0);

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[12px] text-muted-foreground">{t('tech.count', { count })}</span>

      {pv && summary && (
        <TechCardFrame
          topic={TOPICS.pv}
          title={t('pv.overview.title')}
          headline={`${format(summary.kwp, 1)} kWp · ${t('tech.pvSurfaces', { count: summary.installed })}`}
          subtitle={installed.map((row) => (row.product ? productName(row.product) : pv.typeLabel)).join(' · ') || pv.typeLabel}
          cost={summary.investment === undefined ? undefined : `${format(summary.investment, 0)} ${pvCurrency}`.trim()}
          focused={focusId === PV_CARD}
          onFocus={() => setFocusId(focusId === PV_CARD ? null : PV_CARD)}
          {...(installed.length > 0 ? {
            onRemove: () => installedPvIds(pv.surfaces, productFor).forEach((id) => pv.onToggle(id, false)),
            removeLabel: t('pv.removeAll'),
            confirmLabel: t('pv.removeAllConfirm'),
          } : {})}
        >
          <PvOverview pv={pv} available={available} elements={elements} layouts={layouts} mode={mode} onSelect={onSelectSurface} framed />
        </TechCardFrame>
      )}

      {technologies && technologies.items.length > 0 && (
        <TechnologyCards technologies={technologies} focusId={focusId} onFocus={setFocusId} />
      )}
      {technologies && technologies.items.length === 0 && !pv && <TechnologyCards technologies={technologies} />}

      {technologies?.onAdd && (
        <button
          type="button"
          onClick={technologies.onAdd}
          className="h-9 cursor-pointer rounded-lg border border-dashed border-border bg-card text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          {t('tech.add')}
        </button>
      )}

      {amounts.length > 0 && (
        // Pinned to the bottom of the scrolling panel, so the total stays in view.
        <div className="sticky bottom-0 -mx-4 -mb-4 mt-1 flex flex-col gap-0.5 border-t border-border bg-card px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-semibold text-foreground">{t('tech.total.label')}</span>
            <span className="text-[17px] font-bold tabular-nums text-[#2F7A4F] dark:text-[#8FD1A9]">
              {`${format(amounts.reduce((a, b) => a + b, 0), 0)} ${currency}`.trim()}
            </span>
          </div>
          {unsized > 0 && <span className="text-[11px] text-muted-foreground">{t('tech.total.unsized', { count: unsized })}</span>}
        </div>
      )}
    </div>
  );
}
