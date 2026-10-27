// The PV section of the surface panel: the surface's geometry, its PV switch,
// and with PV its product, usable share, mounting, module format, the
// resulting modules and cost, and products that fit more.

import { PresetSlider } from './surfaceControls';
import { SegmentedControl } from '../BuildingConfigurator/shared/ui';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT } from '../../i18n';
import { pvGeometry } from '../../lib/pvSurfaces';
import { DEFAULT_PV_MODULE, DEFAULT_RACK, FLAT_MAX_TILT_DEG, type PvLayout, type PvMounting, type PvOrientation } from '../../lib/pvLayout';
import { fitsMore, productCurrency, productName, pvCosts } from '../../lib/pvProducts';
import type { SurfacePolygon } from '../../lib/surfaceMesh';
import { compassPoint, surfaceProduct, Switch, type PvMode, type PvSurface } from './PvMode';

/** Tilt, facing and area as tiles; a flat surface shows "Flat" and no facing. */
function GeometryTiles({ id, elements, surface }: { id: string; elements: Record<string, BuildingElement>; surface: PvSurface }) {
  const t = useT();
  const format = useFormatNumber();
  const geometry = pvGeometry(id, elements, surface);
  if (!geometry) return null;
  const tiles = geometry.flat
    ? [[t('surface.tilt'), t('surface.tiltShape.flat')], [t('surface.area'), `${format(geometry.area, 0)} m²`]]
    : [
        [t('surface.tilt'), `${format(geometry.tilt, 0)}°`],
        [t('surface.facing'), `${format(geometry.azimuth, 0)}° ${t(`surface.compass.${compassPoint(geometry.azimuth)}`)}`],
        [t('surface.area'), `${format(geometry.area, 0)} m²`],
      ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className={geometry.flat ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-3 gap-1.5'}>
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-md bg-muted px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className="text-[13px] font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">{t('pv.card.fromModel')}</span>
    </div>
  );
}

/** Mounting (racking only on surfaces under 10°), panel angles when racked, and module format. */
function MountingControls({ surfaceId, surface, layout, canRack, pv }: {
  surfaceId: string;
  surface: PvSurface;
  layout: PvLayout;
  canRack: boolean;
  pv: PvMode;
}) {
  const t = useT();
  const { mounting } = layout;
  const setMounting = (next: PvMounting) => pv.onMountingChange(surfaceId, next, surface.orientation);
  return (
    <div className="flex flex-col gap-2.5">
      {canRack && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">{t('pv.mounting.label')}</span>
          <SegmentedControl
            options={[{ value: 'flush', label: t('pv.mounting.flush') }, { value: 'racked', label: t('pv.mounting.racked') }]}
            value={mounting.kind}
            onChange={(kind) => setMounting(kind === 'racked' ? DEFAULT_RACK : { kind: 'flush' })}
          />
        </div>
      )}
      {mounting.kind === 'racked' && (
        <>
          <PresetSlider
            label={t('pv.panelTilt')} value={mounting.tilt} min={0} max={45} step={5} unit="°" decimals={0}
            onChange={(tilt) => setMounting({ ...mounting, tilt })}
          />
          <PresetSlider
            label={t('pv.panelFacing')} value={mounting.azimuth} min={0} max={355} step={5} unit="°" decimals={0}
            onChange={(azimuth) => setMounting({ ...mounting, azimuth })}
          />
        </>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">{t('pv.orientation.label')}</span>
        <SegmentedControl
          fullWidth
          options={[
            { value: 'auto', label: t('pv.orientation.auto') },
            { value: 'portrait', label: t('pv.orientation.portrait') },
            { value: 'landscape', label: t('pv.orientation.landscape') },
          ]}
          value={surface.orientation ?? 'auto'}
          onChange={(value) => pv.onMountingChange(surfaceId, mounting, value === 'auto' ? undefined : value as PvOrientation)}
        />
      </div>
    </div>
  );
}

/** The surface's product, chosen from the catalogue. */
function ProductPicker({ surfaceId, pv }: { surfaceId: string; pv: PvMode }) {
  const t = useT();
  const current = surfaceProduct(pv, surfaceId);
  if (!pv.catalogue?.length || !pv.onAssignProduct) return null;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{t('pv.product.label')}</span>
      <select
        value={current?.id ?? ''}
        onChange={(e) => pv.onAssignProduct?.(surfaceId, e.target.value)}
        className="h-8 cursor-pointer rounded-md border border-border bg-card px-2 text-[12px] text-foreground"
      >
        {!current && <option value="">{t('pv.product.none')}</option>}
        {pv.catalogue.map((product) => <option key={product.id} value={product.id}>{productName(product)}</option>)}
      </select>
    </label>
  );
}

/** Modules, kWp and module area of the layout, with its investment where the product carries a cost. */
function LayoutResult({ layout, pv, surfaceId }: { layout: PvLayout; pv: PvMode; surfaceId: string }) {
  const t = useT();
  const format = useFormatNumber();
  const product = surfaceProduct(pv, surfaceId);
  const { investment } = pvCosts(product, layout.kwp);
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2 text-[12px] font-medium text-foreground">
      {layout.count === 0
        ? t('pv.card.noFit')
        : t('pv.card.modules', { count: layout.count, kwp: format(layout.kwp, 1), area: format(layout.area, 0) })}
      {layout.count > 0 && !layout.capped && (
        <span className="text-[11px] font-normal text-muted-foreground">{t('pv.card.spaceLimited')}</span>
      )}
      {layout.count > 0 && investment !== undefined && (
        <span className="text-[11px] font-normal text-muted-foreground">
          {t('pv.cost.investmentEstimate', { amount: `${format(investment, 0)} ${productCurrency(product)}`.trim() })}
        </span>
      )}
    </div>
  );
}

/** Up to three products reaching more on this surface, each with a button to use it. */
function FitsMore({ surfaceId, surface, pv, polygon, layout }: {
  surfaceId: string;
  surface: PvSurface;
  pv: PvMode;
  polygon: SurfacePolygon;
  layout: PvLayout;
}) {
  const t = useT();
  const format = useFormatNumber();
  if (!pv.catalogue?.length || !pv.onAssignProduct) return null;
  const options = { usableShare: surface.usableShare, mounting: surface.mounting, orientation: surface.orientation };
  const better = fitsMore(polygon, options, pv.catalogue, surfaceProduct(pv, surfaceId)?.id, layout.kwp, pv.module ?? DEFAULT_PV_MODULE);
  if (better.length === 0) return null;
  // Closed by default: the list changes as the surface's settings do, and open
  // it would move the rest of the panel each time.
  return (
    <details className="group rounded-md border border-border">
      <summary className="flex cursor-pointer items-center justify-between px-2.5 py-2 text-[12px] font-semibold text-foreground">
        {t('pv.fitsMore.title', { count: better.length })}
        <span className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="flex flex-col gap-1.5 border-t border-border p-2">
      {better.map(({ product, layout: theirs }) => {
        const perKwp = pvCosts(product, 1).investment;
        return (
          <div key={product.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-foreground">{productName(product)}</div>
              <div className="text-[11px] text-muted-foreground">
                {t('pv.fitsMore.reach', { count: theirs.count, kwp: format(theirs.kwp, 1) })}
                {perKwp !== undefined && ` · ${format(perKwp, 0)} ${productCurrency(product)}/kWp`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => pv.onAssignProduct?.(surfaceId, product.id)}
              className="h-7 shrink-0 cursor-pointer rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground hover:bg-muted"
            >{t('pv.fitsMore.use')}</button>
          </div>
        );
      })}
      </div>
    </details>
  );
}

/** The PV section of a clicked surface. */
export function PvSurfaceSection({ surfaceId, surface, pv, elements = {}, layout, polygon, showGeometry = true, onClose }: {
  surfaceId: string;
  surface: PvSurface;
  pv: PvMode;
  elements?: Record<string, BuildingElement>;
  /** The surface's module layout, when the view has its polygon. */
  layout?: PvLayout;
  polygon?: SurfacePolygon;
  /** Off where the envelope section above already shows the geometry. */
  showGeometry?: boolean;
  /** Closes the panel, from its Done button. */
  onClose?: () => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const installed = surface.state === 'installed';
  const geometry = pvGeometry(surfaceId, elements, surface);
  const area = elements[surfaceId]?.area ?? surface.area;
  const element = elements[surfaceId];
  const orientationEdited = element !== undefined && (
    (element.defaultTilt !== undefined && element.defaultTilt !== element.tilt)
    || (element.defaultAzimuth !== undefined && element.defaultAzimuth !== element.azimuth)
  );

  return (
    <div className="flex flex-col gap-3 p-3">
      {showGeometry && <GeometryTiles id={surfaceId} elements={elements} surface={surface} />}
      {orientationEdited && geometry && (
        <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-300">
          {t('pv.followsModel', { tilt: format(geometry.tilt, 0) })}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
        <span className="text-[12px] font-semibold text-foreground">{t('pv.thisSurface')}</span>
        <Switch on={installed} label={t('pv.thisSurface')} onChange={(on) => pv.onToggle(surfaceId, on)} />
      </div>

      {installed ? (
        <>
          <ProductPicker surfaceId={surfaceId} pv={pv} />
          <PresetSlider
            label={t('pv.usableShare')}
            value={surface.usableShare * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            decimals={0}
            quality={t('pv.usableShareNote')}
            onChange={(percent) => pv.onShareChange(surfaceId, percent / 100)}
          />
          {layout && (
            <MountingControls
              surfaceId={surfaceId}
              surface={surface}
              layout={layout}
              canRack={(geometry?.tilt ?? 0) < FLAT_MAX_TILT_DEG || layout.mounting.kind === 'racked'}
              pv={pv}
            />
          )}
          {layout ? <LayoutResult layout={layout} pv={pv} surfaceId={surfaceId} /> : (
            <div className="rounded-md bg-muted px-3 py-2 text-[12px] font-medium text-foreground">
              {area === undefined
                ? `${format(surface.maxKwp, 1)} kWp`
                : t('pv.card.panels', { kwp: format(surface.maxKwp, 1), area: format(area * surface.usableShare, 0) })}
            </div>
          )}
          {layout && polygon && <FitsMore surfaceId={surfaceId} surface={surface} pv={pv} polygon={polygon} layout={layout} />}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => pv.onToggle(surfaceId, false)}
              className="h-9 cursor-pointer rounded-md border border-destructive/40 bg-card px-3 text-[12px] font-medium text-destructive hover:bg-destructive/10"
            >{t('pv.card.remove')}</button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-9 cursor-pointer rounded-md bg-foreground px-4 text-[12px] font-semibold text-background hover:opacity-90"
              >{t('pv.card.done')}</button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
