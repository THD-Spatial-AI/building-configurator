// The building editor's Heating and comfort group: what the building needs
// from its heat supply. Field keys are BuEM's own names, see DEFAULT_GENERAL.

import {
  FieldLabel, FieldRow, NumberInput, SegmentedControl, SelectInput,
} from '@/app/components/BuildingConfigurator/shared/ui';
import { SETBACK_OPTIONS, isServiceBuildingType } from '@/app/components/BuildingConfigurator/shared/buildingOptions';
import { computeTotalFloorArea } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';

interface ComfortProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  mode: 'basic' | 'expert';
}

// BuEM's three thermal_class values, so a saved choice reopens as chosen.
const MASS_CLASSES = [
  { value: 'Light',  label: 'Light' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Heavy',  label: 'Heavy' },
];

// c_m per class from EN ISO 13790 Table 12; Medium is the schema's default.
const MASS_DEFAULTS: Record<string, number> = { Light: 110, Medium: 165, Heavy: 260 };

const HOT_WATER_OPTIONS = [
  { value: 'on',  label: 'Included' },
  { value: 'off', label: 'Not included' },
];

/** One line for the group's collapsed card. */
export function comfortSummary(general: Record<string, any>): string {
  const setback = general.setback_profile === 'none'
    ? 'no setback'
    : `lowered ${(SETBACK_OPTIONS.find((o) => o.value === general.setback_profile)?.label ?? general.setback_profile).toLowerCase()}`;
  const parts = [`${general.comfortT_lb} °C`, setback];
  if (!isServiceBuildingType(general.buildingType)) parts.push(general.include_dhw ? 'hot water included' : 'no hot water');
  return parts.join(' · ');
}

/** Heating setpoint, setback and hot water; Expert adds the cooling setpoint, air changes and thermal mass. */
export function ComfortSection({ general, setGen, mode }: ComfortProps) {
  const residential = !isServiceBuildingType(general.buildingType);
  return (
    <div className="flex flex-col gap-4">
      <FieldRow>
        <NumberInput
          label="Heating setpoint"
          value={general.comfortT_lb}
          onChange={(v) => setGen('comfortT_lb', v)}
          unit="°C" min={5} max={30} step={0.5}
          tip="Lowest indoor temperature the heating keeps."
        />
        <SelectInput
          label="Lower it when"
          value={general.setback_profile}
          onChange={(v) => setGen('setback_profile', v)}
          options={SETBACK_OPTIONS}
          tip="Lowers the heating setpoint while occupants are asleep or away. Affects heating only."
        />
      </FieldRow>
      {mode === 'expert' && <CoolingSetpoint general={general} setGen={setGen} />}
      {residential && (
        <div>
          <FieldLabel tip="Turn off when hot water is supplied by a system accounted for elsewhere. Space heating is unaffected.">
            Hot water
          </FieldLabel>
          <SegmentedControl
            options={HOT_WATER_OPTIONS}
            value={general.include_dhw ? 'on' : 'off'}
            onChange={(v) => setGen('include_dhw', v === 'on')}
            fullWidth
          />
        </div>
      )}
      {mode === 'expert' && (
        <>
          <AirChanges general={general} setGen={setGen} />
          <ThermalMass general={general} setGen={setGen} />
        </>
      )}
    </div>
  );
}

type FieldProps = Omit<ComfortProps, 'mode'>;

function CoolingSetpoint({ general, setGen }: FieldProps) {
  const inverted = general.comfortT_ub <= general.comfortT_lb;
  return (
    <div>
      <NumberInput
        label="Cooling setpoint"
        value={general.comfortT_ub}
        onChange={(v) => setGen('comfortT_ub', v)}
        unit="°C" min={15} max={35} step={0.5}
        tip="Highest indoor temperature the cooling keeps."
      />
      {inverted && (
        <p className="mt-1 text-[10px] text-amber-700">Set it above the heating setpoint.</p>
      )}
    </div>
  );
}

function AirChanges({ general, setGen }: FieldProps) {
  const total = (general.n_air_infiltration + general.n_air_use).toFixed(2);
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <FieldRow>
        <NumberInput
          label="Air leakage"
          value={general.n_air_infiltration}
          onChange={(v) => setGen('n_air_infiltration', Math.max(0, v))}
          unit="h⁻¹" min={0} max={5} step={0.05}
          tip="Uncontrolled air changes per hour through gaps in the envelope (infiltration)."
        />
        <NumberInput
          label="Ventilation by occupants"
          value={general.n_air_use}
          onChange={(v) => setGen('n_air_use', Math.max(0, v))}
          unit="h⁻¹" min={0} max={5} step={0.05}
          tip="Air changes per hour from window opening and fans while the building is in use."
        />
      </FieldRow>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Total air changes</span>
        <span className="text-xs font-semibold text-foreground">{total} <span className="text-[10px] font-normal text-muted-foreground">h⁻¹</span></span>
      </div>
    </div>
  );
}

function ThermalMass({ general, setGen }: FieldProps) {
  const totalMass = (general.c_m * computeTotalFloorArea(general.floorArea, general.storeys) / 1000).toFixed(1);
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <div>
        <FieldLabel tip="How much heat the structure stores. Light: timber frame or lightweight; medium: mixed; heavy: concrete or masonry.">
          Thermal mass
        </FieldLabel>
        <SegmentedControl
          options={MASS_CLASSES}
          value={general.massClass}
          onChange={(v) => { setGen('massClass', v); setGen('c_m', MASS_DEFAULTS[v] ?? general.c_m); }}
          fullWidth
        />
      </div>
      <NumberInput
        label="Heat capacity per floor area"
        value={general.c_m}
        onChange={(v) => setGen('c_m', Math.max(10, v))}
        unit="kJ/m²K" min={10} max={500} step={5}
        tip="Set from the thermal mass class; editable."
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Total thermal mass</span>
        <span className="text-xs font-semibold text-foreground">{totalMass} <span className="text-[10px] font-normal text-muted-foreground">MJ/K</span></span>
      </div>
    </div>
  );
}
