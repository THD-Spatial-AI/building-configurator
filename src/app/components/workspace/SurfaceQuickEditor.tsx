// Everything one surface needs, in a card small enough to sit beside it:
// its area (with the measured value from the 3D geometry one click away), how
// well it insulates, which way it faces, and whether it carries PV.
//
// Detailed technology parameters stay in the configurator dialog; this is the
// set a user changes while looking at the building.

import React from 'react';
import { AlertTriangle, Ruler, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AzimuthDial, PresetSlider, TiltDial } from './surfaceControls';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { createSurfacePvConfig, type PvConfig } from '../BuildingConfigurator/shared/buildingDefaults';

/** Widest U-value the slider covers: a single-glazed window sits near 5. */
const U_MAX = 5;

/** TABULA level names are long; the chip keeps the distinguishing word and the
 *  title attribute carries the rest. */
function shortPresetLabel(label: string): string {
  return label.replace(/\s*(state|refurbishment)\s*$/i, '').trim() || label;
}

/** Plain words for a U-value, so the number is not the only signal. */
function insulationLabel(uValue: number): string {
  if (uValue <= 0.25) return 'Very well insulated';
  if (uValue <= 0.5) return 'Well insulated';
  if (uValue <= 1) return 'Moderately insulated';
  if (uValue <= 2) return 'Poorly insulated';
  return 'Uninsulated';
}

interface SurfaceQuickEditorProps {
  element: BuildingElement;
  /** Area of this surface's 3D polygon, when geometry for it was loaded. */
  geometryArea?: number | null;
  /** This building's TABULA U-values for this surface type. */
  uValuePresets: { label: string; uValue: number }[];
  pv: PvConfig | null;
  onUpdate: (patch: Partial<BuildingElement>) => void;
  onUpdatePv: (patch: Partial<PvConfig>) => void;
  onDelete: () => void;
}

export function SurfaceQuickEditor({
  element, geometryArea, uValuePresets, pv, onUpdate, onUpdatePv, onDelete,
}: SurfaceQuickEditorProps) {
  const areaMissing = !(element.area > 0);
  // Worth offering only when it would actually change the area.
  const offerGeometryArea = geometryArea != null && geometryArea > 0
    && Math.abs(geometryArea - element.area) > Math.max(0.05, element.area * 0.01);
  const pvEligible = element.type === 'roof' || element.type === 'wall';
  const pvConfig = pv ?? createSurfacePvConfig(element);

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
          <span className="text-[11px] font-medium text-muted-foreground">Area</span>
          {areaMissing && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
              <AlertTriangle className="size-3" />
              A simulation will reject this
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center overflow-hidden rounded-lg border bg-white',
            areaMissing ? 'border-destructive ring-1 ring-destructive/30' : 'border-slate-200',
          )}>
            <input
              type="number"
              aria-label="Area"
              min={0}
              step={0.1}
              value={element.area}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (!Number.isNaN(next)) onUpdate({ area: next });
              }}
              className="w-[92px] px-2.5 py-1.5 text-right text-[13px] font-semibold text-slate-700 outline-none"
            />
            <span className="pr-2.5 text-[10px] text-slate-400">m²</span>
          </div>
          {offerGeometryArea && (
            <button
              type="button"
              onClick={() => onUpdate({ area: Math.round(geometryArea! * 100) / 100 })}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <Ruler className="size-3.5" />
              Use {geometryArea!.toFixed(1)} m² from the model
            </button>
          )}
        </div>
      </div>

      {/* ── Insulation ── */}
      <PresetSlider
        label="U-value"
        value={element.uValue}
        min={0.1}
        max={U_MAX}
        step={0.01}
        unit="W/m²K"
        quality={insulationLabel(element.uValue)}
        presets={uValuePresets.map((p) => ({ label: shortPresetLabel(p.label), value: p.uValue }))}
        onChange={(uValue) => onUpdate({ uValue })}
      />

      {element.type === 'window' && element.gValue !== null && (
        <PresetSlider
          label="Solar transmittance (g)"
          value={element.gValue}
          min={0.1}
          max={0.9}
          step={0.01}
          quality={element.gValue >= 0.6 ? 'Lets most solar heat through' : 'Blocks most solar heat'}
          onChange={(gValue) => onUpdate({ gValue })}
        />
      )}

      {/* ── Orientation ── */}
      <div className="flex items-start justify-center gap-4">
        <AzimuthDial
          value={element.azimuth}
          reference={element.defaultAzimuth}
          onChange={(azimuth) => onUpdate({ azimuth })}
        />
        <TiltDial value={element.tilt} onChange={(tilt) => onUpdate({ tilt })} />
      </div>

      {/* ── Solar PV ── */}
      {pvEligible && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={pvConfig.installed}
              onChange={(e) => onUpdatePv({
                installed: e.target.checked,
                // The panel follows the surface it sits on until changed by hand.
                tilt: element.tilt,
                azimuth: element.azimuth,
              })}
              className="size-4 cursor-pointer accent-primary"
            />
            <Sun className={cn('size-4', pvConfig.installed ? 'text-yellow-500' : 'text-slate-300')} />
            <span className="flex-1 text-[12px] font-semibold text-slate-700">Solar PV on this surface</span>
          </label>

          {pvConfig.installed && (
            <div className="mt-2.5">
              <PresetSlider
                label="Capacity"
                value={pvConfig.system_capacity}
                min={0.5}
                max={30}
                step={0.5}
                unit="kWp"
                decimals={1}
                onChange={(system_capacity) => onUpdatePv({ system_capacity, cont_energy_cap_max: system_capacity })}
              />
            </div>
          )}
        </div>
      )}

      {edited && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <span className="text-[10px] leading-snug text-slate-400">
            Imported: {imported.area?.toFixed(1)} m² · U {imported.uValue?.toFixed(2)} · {imported.tilt}° / {imported.azimuth}°
          </span>
          <button
            type="button"
            onClick={() => onUpdate({
              area: imported.area ?? element.area,
              uValue: imported.uValue ?? element.uValue,
              tilt: imported.tilt ?? element.tilt,
              azimuth: imported.azimuth ?? element.azimuth,
            })}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 transition-colors hover:bg-muted"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/5"
      >
        <Trash2 className="size-3.5" />
        Delete this surface
      </button>
    </div>
  );
}
