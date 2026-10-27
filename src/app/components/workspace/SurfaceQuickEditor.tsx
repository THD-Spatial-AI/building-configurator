// Everything one surface needs, in a card small enough to sit beside it:
// its area (with the measured value from the 3D geometry one click away), how
// well it insulates and which way it faces.

import React from 'react';
import { AlertTriangle, Ruler, RotateCcw, Trash2 } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { AzimuthDial, TiltDial, tiltLabel } from './surfaceControls';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT } from '../../i18n';
import { isFlat, modelGeometry } from '../../lib/pvSurfaces';
import { compassPoint } from './PvMode';
import { DecimalInput, NumberInput } from '../BuildingConfigurator/shared/ui';

/** Highest U-value accepted: a single-glazed window sits near 5. */
const U_MAX = 5;

/** One labelled figure of the surface's geometry. */
function GeometryFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="truncate text-[13px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

/** Tilt and facing as the 3D model has them, for Basic, where they are not edited. */
function ModelOrientation({ element }: { element: BuildingElement }) {
  const t = useT();
  const format = useFormatNumber();
  const { tilt, azimuth } = modelGeometry(element);
  const flat = isFlat(tilt, azimuth);
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted px-2.5 py-2">
      <div className="grid grid-cols-2 gap-2">
        <GeometryFigure label={t('surface.tilt')} value={`${format(tilt, 0)}° · ${tiltLabel(tilt, t)}`} />
        <GeometryFigure
          label={t('surface.facing')}
          value={flat ? '—' : `${format(azimuth, 0)}° ${t(`surface.compass.${compassPoint(azimuth)}`)}`}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{t('surface.geometrySource')}</span>
    </div>
  );
}

interface SurfaceQuickEditorProps {
  element: BuildingElement;
  /** Area of this surface's 3D polygon, when geometry for it was loaded. */
  geometryArea?: number | null;
  mode?: 'basic' | 'expert';
  onUpdate: (patch: Partial<BuildingElement>) => void;
  onDelete: () => void;
}

export function SurfaceQuickEditor({
  element, geometryArea, mode = 'basic', onUpdate, onDelete,
}: SurfaceQuickEditorProps) {
  const t = useT();
  const format = useFormatNumber();
  const areaMissing = !(element.area > 0);
  // Worth offering only when it would actually change the area.
  const offerGeometryArea = geometryArea != null && geometryArea > 0
    && Math.abs(geometryArea - element.area) > Math.max(0.05, element.area * 0.01);

  // The values this surface arrived with, stamped on import (see
  // normalizeElementRecord), so a hand-edit can always be walked back.
  const imported = {
    area: element.defaultArea,
    uValue: element.defaultUValue,
    tilt: element.defaultTilt,
    azimuth: element.defaultAzimuth,
  };
  const edited = (['area', 'uValue', 'tilt', 'azimuth'] as const)
    .some((key) => imported[key] !== undefined && imported[key] !== element[key]);

  return (
    <div className="flex flex-col gap-4 p-3">

      {/* ── Area, U-value and, for a window, g-value ── */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="mb-1 block text-[11px] font-medium leading-tight text-muted-foreground">{t('surface.area')}</span>
            <div className={cn('cfg-input-wrap', areaMissing && 'border-destructive ring-1 ring-destructive/30')}>
              <DecimalInput
                className="cfg-number"
                aria-label={t('surface.area')}
                min={0}
                step={0.1}
                value={element.area}
                onChange={(next) => { if (next !== null) onUpdate({ area: next }); }}
              />
              <div className="flex shrink-0 select-none items-center border-l border-border bg-muted px-2.5 text-[11px] text-muted-foreground">m²</div>
            </div>
          </div>
          <NumberInput
            label={`${t('surface.uValue')} (W/m²K)`}
            tip={t('surface.uValueTip')}
            value={element.uValue}
            min={0.1}
            max={U_MAX}
            step={0.01}
            unit=""
            onChange={(uValue) => onUpdate({ uValue })}
          />
          {element.type === 'window' && element.gValue !== null && (
            <NumberInput
              label={t('surface.gValue')}
              unit=""
              value={element.gValue}
              min={0.1}
              max={0.9}
              step={0.01}
              onChange={(gValue) => onUpdate({ gValue })}
            />
          )}
        </div>
        {areaMissing && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
            <AlertTriangle className="size-3" />
            {t('surface.areaRejected')}
          </span>
        )}
        {offerGeometryArea && (
          <button
            type="button"
            onClick={() => onUpdate({ area: Math.round(geometryArea! * 100) / 100 })}
            className="flex cursor-pointer items-center gap-1.5 self-start rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <Ruler className="size-3.5" />
            {t('surface.useGeometryArea', { area: format(geometryArea!, 1) })}
          </button>
        )}
        {mode === 'expert' && (
          <p className="text-[10px] text-muted-foreground">
            {t('surface.rValue', { value: format(1 / Math.max(0.01, element.uValue), 2) })}
          </p>
        )}
      </div>

      {element.type === 'wall' && (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={element.bTransmission === 0}
            onChange={(e) => onUpdate({ bTransmission: e.target.checked ? 0 : undefined })}
            className="size-4 cursor-pointer accent-primary"
          />
          <span className="text-[12px] text-foreground">{t('surface.sharedWall')}</span>
        </label>
      )}

      {/* ── Orientation ── */}
      {/* Tilt and facing change only what BuEM receives, not the geometry or the PV on it: Expert only. */}
      {mode !== 'expert' ? <ModelOrientation element={element} /> : (
      <div className="flex items-start justify-center gap-4">
        {isFlat(element.tilt, element.azimuth) ? (
          <span className="self-center rounded-md bg-muted px-2.5 py-1.5 text-[12px] font-semibold text-foreground">{t('surface.tiltShape.flat')}</span>
        ) : (
          <AzimuthDial
            value={element.azimuth}
            reference={element.defaultAzimuth}
            onChange={(azimuth) => onUpdate({ azimuth })}
          />
        )}
        <TiltDial value={element.tilt} onChange={(tilt) => onUpdate({ tilt })} />
      </div>
      )}

      {edited && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <span className="text-[10px] leading-snug text-muted-foreground">
            {t('surface.imported', {
              area: imported.area === undefined ? '' : format(imported.area, 1),
              uValue: imported.uValue === undefined ? '' : format(imported.uValue, 2),
              tilt: imported.tilt === undefined ? '' : format(imported.tilt),
              azimuth: imported.azimuth === undefined ? '' : format(imported.azimuth),
            })}
          </span>
          <button
            type="button"
            onClick={() => onUpdate({
              area: imported.area ?? element.area,
              uValue: imported.uValue ?? element.uValue,
              tilt: imported.tilt ?? element.tilt,
              azimuth: imported.azimuth ?? element.azimuth,
            })}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw className="size-3" />
            {t('surface.reset')}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/5"
      >
        <Trash2 className="size-3.5" />
        {t('surface.delete')}
      </button>
    </div>
  );
}
