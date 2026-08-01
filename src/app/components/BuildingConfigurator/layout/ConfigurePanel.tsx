// Center panel of the configure workspace — routes to the building editor,
// surface group grid/editor, or a technology editor, based on panelView.

import React from 'react';
import type { BuildingElement } from '../configure/model/buildingElements';
import { SurfaceGroupGrid } from '../configure/surfaces/SurfaceGroupGrid';
import { SurfaceGroupEditor } from '../configure/surfaces/SurfaceGroupEditor';
import { BuildingEditor } from '../configure/building/BuildingEditor';
import { PvSurfaceManager } from '../configure/pv/PvSurfaceManager';
import { BatteryEditor } from '../configure/pv/BatteryEditor';
import type { PvConfig, BatteryConfig } from '../shared/buildingDefaults';
import type { ElementGroupKey } from '../shared/elementListUtils';
import type { IgnisState, IgnisInputs, IgnisFieldMetadata } from '../../../lib/ignisAdapter';

export interface ConfigurePanelProps {
  panelView: string;
  activeGroupType: ElementGroupKey | null;
  selectedId: string | null;
  elements: Record<string, BuildingElement>;
  mode: 'basic' | 'expert';
  surfaceEditorTab: 'properties' | 'pv';
  surfacePvConfigs: Record<string, PvConfig>;

  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  ignis: IgnisState | null;
  ignisFieldMetadata: IgnisFieldMetadata[];
  onIgnisFieldChange: (changes: Partial<IgnisInputs>) => void;
  onIgnisVariantSelect: (index: number) => void;
  onIgnisReset: () => void;
  onIgnisPeriodOverride: (period: string) => void;

  onUpdateElement: (id: string, patch: Partial<BuildingElement>) => void;
  onRenameElement: (id: string, label: string) => void;
  onUpdateSurfacePv: (surfaceId: string, patch: Partial<PvConfig>) => void;
  onDeleteSurface: (id: string) => void;
  onSelectSurface: (elementId: string) => void;
  onCreateSurface: (type: BuildingElement['type']) => void;
  onApplyRoofType: (newRoofElements: Record<string, BuildingElement>) => void;

  pvInstalledSurfaces: { element: BuildingElement; pv: PvConfig }[];
  totalPvCapacityKw: number;
  onEditPvSurface: (surfaceId: string) => void;

  batteryConfig: BatteryConfig;
  onUpdateBattery: (patch: Partial<BatteryConfig>) => void;
}

export function ConfigurePanel({
  panelView, activeGroupType, selectedId, elements, mode, surfaceEditorTab, surfacePvConfigs,
  general, setGen, ignis, ignisFieldMetadata, onIgnisFieldChange, onIgnisVariantSelect, onIgnisReset, onIgnisPeriodOverride,
  onUpdateElement, onRenameElement, onUpdateSurfacePv, onDeleteSurface, onSelectSurface, onCreateSurface, onApplyRoofType,
  pvInstalledSurfaces, totalPvCapacityKw, onEditPvSurface,
  batteryConfig, onUpdateBattery,
}: ConfigurePanelProps) {
  if (panelView === 'building') {
    return (
      <BuildingEditor
        general={general}
        setGen={setGen}
        mode={mode}
        ignis={ignis}
        ignisFieldMetadata={ignisFieldMetadata}
        onIgnisFieldChange={onIgnisFieldChange}
        onIgnisVariantSelect={onIgnisVariantSelect}
        onIgnisReset={onIgnisReset}
        onIgnisPeriodOverride={onIgnisPeriodOverride}
      />
    );
  }

  if (panelView === 'surface-group' && activeGroupType) {
    if (activeGroupType === 'roof') {
      // Roof: type picker (no card grid) + embedded editor when selected
      return (
        <SurfaceGroupGrid
          groupType="roof"
          elements={elements}
          selectedElementId={selectedId}
          onSelect={onSelectSurface}
          onDeleteSurface={onDeleteSurface}
          onApplyRoofType={onApplyRoofType}
          onCreateSurface={onCreateSurface}
          surfacePvConfigs={surfacePvConfigs}
          hideCardGrid
          editorSlot={selectedId ? (
            <SurfaceGroupEditor
              selectedElementId={selectedId}
              elements={elements}
              onUpdateElement={onUpdateElement}
              onRenameElement={onRenameElement}
              preferredTab={surfaceEditorTab}
              surfacePvConfig={surfacePvConfigs[selectedId] ?? null}
              onUpdatePv={(patch) => onUpdateSurfacePv(selectedId, patch)}
              onDeleteSurface={onDeleteSurface}
              mode={mode}
              embedded
            />
          ) : undefined}
        />
      );
    }

    if (selectedId) {
      // Non-roof with surface selected: pure editor, no card grid
      return (
        <SurfaceGroupEditor
          selectedElementId={selectedId}
          elements={elements}
          onUpdateElement={onUpdateElement}
          onRenameElement={onRenameElement}
          preferredTab={surfaceEditorTab}
          surfacePvConfig={surfacePvConfigs[selectedId] ?? null}
          onUpdatePv={(patch) => onUpdateSurfacePv(selectedId, patch)}
          onDeleteSurface={onDeleteSurface}
          mode={mode}
        />
      );
    }

    // No surface selected yet — prompt
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center p-8">
        <p className="text-sm font-semibold text-slate-500">Select a surface</p>
        <p className="text-[11px] text-slate-400 leading-snug">
          Pick a surface from the list on the right to configure it.
        </p>
      </div>
    );
  }

  if (panelView === 'technology-pv') {
    return (
      <PvSurfaceManager
        surfaces={pvInstalledSurfaces}
        totalCapacityKw={totalPvCapacityKw}
        mode={mode}
        onEditSurface={onEditPvSurface}
        allElements={elements}
        onEnableSurface={onEditPvSurface}
      />
    );
  }

  if (panelView === 'technology-battery') {
    return (
      <BatteryEditor
        battery={batteryConfig}
        onUpdate={onUpdateBattery}
        mode={mode}
      />
    );
  }

  return null;
}
