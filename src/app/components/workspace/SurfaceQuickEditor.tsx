// Everything one surface needs, in a card small enough to sit beside it:
// its area (with the measured value from the 3D geometry one click away), how
// well it insulates and which way it faces.

import React from 'react';
import { AlertTriangle, Ruler, RotateCcw, Trash2 } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { AzimuthDial, PresetSlider, TiltDial } from './surfaceControls';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT, type Translate } from '../../i18n';
import { variantName } from '../../lib/refurbishment';
import { isFlat, modelGeometry } from '../../lib/pvSurfaces';
import { compassPoint } from './PvMode';
import { DecimalInput } from '../BuildingConfigurator/shared/ui';

/** Widest U-value the slider covers: a single-glazed window sits near 5. */
const U_MAX = 5;

/** TABULA level names are long; the chip keeps the distinguishing word and the
 *  title attribute carries the rest. */
function shortPresetLabel(label: string): string {
  return label.replace(/\s*(state|refurbishment)\s*$/i, '').trim() || label;
}

/** Plain words for a U-value, so the number is not the only signal. */
function insulationLabel(uValue: number, t: Translate): string {
  if (uValue <= 0.25) return t('surface.insulation.veryWell');
  if (uValue <= 0.5) return t('surface.insulation.well');
  if (uValue <= 1) return t('surface.insulation.moderate');
  if (uValue <= 2) return t('surface.insulation.poor');
  return t('surface.insulation.none');
}

/** Tilt and facing as the 3D model has them, for Basic, where they are not edited. */
function ModelOrientation({ element }: { element: BuildingElement }) {
  const t = useT();
  const format = useFormatNumber();
  const { tilt, azimuth } = modelGeometry(element);
  return (
    <p className="rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
      {isFlat(tilt, azimuth)
        ? t('surface.flatFromModel')
        : t('surface.fromModel', { tilt: format(tilt, 0), azimuth: format(azimuth, 0), compass: t(`surface.compass.${compassPoint(azimuth)}`) })}
    </p>
  );
}

interface SurfaceQuickEditorProps {
  element: BuildingElement;
  /** Area of this surface's 3D polygon, when geometry for it was loaded. */
  geometryArea?: number | null;
  /** This building's TABULA U-values for this surface type. */
  uValuePresets: { label: string; number: number; uValue: number }[];
  mode?: 'basic' | 'expert';
  onUpdate: (patch: Partial<BuildingElement>) => void;
  onDelete: () => void;
}

export function SurfaceQuickEditor({
  element, geometryArea, uValuePresets, mode = 'basic', onUpdate, onDelete,
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

      {/* ── Area ── */}
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">{t('surface.area')}</span>
          {areaMissing && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
              <AlertTriangle className="size-3" />
              {t('surface.areaRejected')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center overflow-hidden rounded-lg border bg-card',
            areaMissing ? 'border-destructive ring-1 ring-destructive/30' : 'border-border',
          )}>
            <DecimalInput
              aria-label={t('surface.area')}
              min={0}
              step={0.1}
              value={element.area}
              onChange={(next) => { if (next !== null) onUpdate({ area: next }); }}
              className="w-[92px] px-2.5 py-1.5 text-right text-[13px] font-semibold text-foreground outline-none"
            />
            <span className="pr-2.5 text-[10px] text-muted-foreground">m²</span>
          </div>
          {offerGeometryArea && (
            <button
              type="button"
              onClick={() => onUpdate({ area: Math.round(geometryArea! * 100) / 100 })}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <Ruler className="size-3.5" />
              {t('surface.useGeometryArea', { area: format(geometryArea!, 1) })}
            </button>
          )}
        </div>
      </div>

      {/* ── Insulation ── */}
      <PresetSlider
        label={t('surface.uValue')}
        value={element.uValue}
        min={0.1}
        max={U_MAX}
        step={0.01}
        unit="W/m²K"
        quality={insulationLabel(element.uValue, t)}
        presets={uValuePresets.map((p) => ({ label: shortPresetLabel(variantName(t, p.label, p.number, true)), value: p.uValue }))}
        onChange={(uValue) => onUpdate({ uValue })}
      />

      {mode === 'expert' && (
        <p className="-mt-2 text-[10px] text-muted-foreground">
          {t('surface.rValue', { value: format(1 / Math.max(0.01, element.uValue), 2) })}
        </p>
      )}

      {element.type === 'window' && element.gValue !== null && (
        <PresetSlider
          label={t('surface.gValue')}
          value={element.gValue}
          min={0.1}
          max={0.9}
          step={0.01}
          quality={element.gValue >= 0.6 ? t('surface.solar.high') : t('surface.solar.low')}
          onChange={(gValue) => onUpdate({ gValue })}
        />
      )}

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
