// The building editor's household and output sections: what BuEM reads beyond
// the envelope. Field keys are BuEM's own names, see DEFAULT_GENERAL.

import type { ReactNode } from 'react';
import {
  FieldLabel, FieldRow, NumberInput, SegmentedControl, SelectInput, ToggleSwitch,
} from '@/app/components/BuildingConfigurator/shared/ui';
import {
  ARCHETYPE_OPTIONS,
  COOKING_CARRIER_OPTIONS,
  EQUIPMENT_GROUPS,
  OUTPUT_LEVEL_OPTIONS,
  OUTPUT_PROFILES,
  SETBACK_OPTIONS,
  TV_IDS,
  isServiceBuildingType,
  requiresResidentialUnits,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';

interface SectionProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
}

const PERSON_OPTIONS = [
  { value: '', label: 'Default' },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: String(n) })),
];

/** A whole number BuEM defaults when it is left empty. */
function OptionalCount({ label, value, onChange, tip, placeholder }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  tip: string;
  placeholder: string;
}) {
  return (
    <div>
      <FieldLabel tip={tip}>{label}</FieldLabel>
      <NumberInput
        value={value ?? ''}
        onChange={(v) => onChange(Math.max(1, Math.round(v)))}
        unit="" min={1} step={1}
      />
      <p className="mt-1 text-[10px] text-muted-foreground">
        {value === null ? placeholder : (
          <button type="button" className="cursor-pointer text-[10px] underline" onClick={() => onChange(null)}>
            Use default
          </button>
        )}
      </p>
    </div>
  );
}

function SetbackSelect({ general, setGen }: SectionProps) {
  return (
    <SelectInput
      label="Heating setback"
      value={general.setback_profile}
      onChange={(v) => setGen('setback_profile', v)}
      options={SETBACK_OPTIONS}
      tip="Lowers the heating set point while occupants are asleep or away. Affects heating only."
    />
  );
}

/** Dwellings, occupants and household habits; capacity alone for a service building. */
export function OccupancySection({ general, setGen }: SectionProps) {
  if (isServiceBuildingType(general.buildingType)) {
    return (
      <div className="flex flex-col gap-3">
        <OptionalCount
          label="Capacity"
          value={general.capacity}
          onChange={(v) => setGen('capacity', v)}
          placeholder="Derived from the floor area."
          tip="Number of occupants. Left empty, BuEM derives it from the floor area with a density for the building type."
        />
        <SetbackSelect general={general} setGen={setGen} />
      </div>
    );
  }

  const required = requiresResidentialUnits(general.buildingType);
  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        {required ? (
          <div>
            <FieldLabel tip="Number of dwellings. Prefilled from the TABULA archetype. BuEM simulates one representative dwelling and multiplies it by this number.">
              Dwellings
            </FieldLabel>
            <NumberInput
              value={general.residential_units ?? ''}
              onChange={(v) => setGen('residential_units', Math.max(1, Math.round(v)))}
              unit="" min={1} step={1}
            />
            {!general.residential_units && (
              <p className="mt-1 text-[10px] text-amber-700">Required for a {general.buildingType}.</p>
            )}
          </div>
        ) : (
          <OptionalCount
            label="Dwellings"
            value={general.residential_units}
            onChange={(v) => setGen('residential_units', v)}
            placeholder="One dwelling."
            tip="Number of dwellings. BuEM simulates one representative dwelling and multiplies it by this number."
          />
        )}
        <SelectInput
          label="Occupants per dwelling"
          value={general.num_persons === null ? '' : String(general.num_persons)}
          onChange={(v) => setGen('num_persons', v ? Number(v) : null)}
          options={PERSON_OPTIONS}
          tip="People living in each dwelling. The default is the statistical household size for the country, region and building type."
        />
      </FieldRow>
      <SelectInput
        label="Household type"
        value={general.archetype}
        onChange={(v) => setGen('archetype', v)}
        options={ARCHETYPE_OPTIONS}
        tip="Household composition. Sets when occupants are at home, which drives internal gains, electricity and hot water."
      />
      <div>
        <FieldLabel tip="Dutch CBS municipality code. Selects the regional household size when occupants per dwelling is left to the default.">
          Region code (Netherlands)
        </FieldLabel>
        <div className="cfg-input-wrap">
          <input
            type="text"
            value={general.region_code}
            onChange={(e) => setGen('region_code', e.target.value.trim().toUpperCase())}
            placeholder="e.g. GM0200"
            className="cfg-number"
          />
        </div>
      </div>
      <SelectInput
        label="Cooking with"
        value={general.cooking_carrier}
        onChange={(v) => setGen('cooking_carrier', v)}
        options={COOKING_CARRIER_OPTIONS}
        tip="Electric cooking stays inside the electricity profile. Gas cooking is reported separately as cooking gas."
      />
      <ToggleSwitch
        checked={general.include_dhw}
        onChange={(v) => setGen('include_dhw', v)}
        label="Report hot water"
        tip="Turn off when hot water is supplied by a system accounted for elsewhere. Space heating is unaffected."
      />
      <SetbackSelect general={general} setGen={setGen} />
    </div>
  );
}

type Ownership = 'default' | 'on' | 'off';

const OWNERSHIP_OPTIONS: { value: Ownership; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'on', label: 'Yes' },
  { value: 'off', label: 'No' },
];

const TV_OPTIONS = ['default', '0', '1', '2', '3'].map((value) => ({
  value, label: value === 'default' ? 'Default' : value,
}));

/** The TV count the three TV ids encode, or 'default' when none is set. */
function tvCount(equipment: Record<string, boolean>): string {
  if (TV_IDS.every((id) => equipment[id] === undefined)) return 'default';
  return String(TV_IDS.filter((id) => equipment[id]).length);
}

/** Appliance ownership: each one forced on, forced off, or left to BuEM's ownership probability. */
export function EquipmentSection({ general, setGen }: SectionProps) {
  const equipment: Record<string, boolean> = general.equipment;

  const setOwnership = (id: string, value: Ownership) => {
    const { [id]: _, ...rest } = equipment;
    setGen('equipment', value === 'default' ? rest : { ...rest, [id]: value === 'on' });
  };

  const setTvCount = (value: string) => {
    const rest = Object.fromEntries(Object.entries(equipment).filter(([id]) => !TV_IDS.includes(id)));
    if (value === 'default') return setGen('equipment', rest);
    const count = Number(value);
    setGen('equipment', { ...rest, ...Object.fromEntries(TV_IDS.map((id, i) => [id, i < count])) });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-muted-foreground leading-snug">
        Default leaves each appliance to BuEM's ownership statistics.
        {requiresResidentialUnits(general.buildingType) && ' Every dwelling in the building gets the same appliances.'}
      </p>
      {EQUIPMENT_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">{group.label}</p>
          {group.label === 'Electronics' && (
            <ApplianceRow label="Televisions">
              <SegmentedControl options={TV_OPTIONS} value={tvCount(equipment)} onChange={setTvCount} />
            </ApplianceRow>
          )}
          {group.items.map((item) => (
            <ApplianceRow key={item.id} label={item.label}>
              <SegmentedControl
                options={OWNERSHIP_OPTIONS}
                value={equipment[item.id] === undefined ? 'default' : equipment[item.id] ? 'on' : 'off'}
                onChange={(v) => setOwnership(item.id, v as Ownership)}
              />
            </ApplianceRow>
          ))}
        </div>
      ))}
      {Object.keys(equipment).length > 0 && (
        <button
          type="button"
          onClick={() => setGen('equipment', {})}
          className="cursor-pointer self-start text-[11px] text-muted-foreground underline"
        >
          Reset all to default
        </button>
      )}
    </div>
  );
}

function ApplianceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Which load profiles BuEM computes, each off, as an annual summary, or hourly. */
export function OutputsSection({ general, setGen }: SectionProps) {
  const service = isServiceBuildingType(general.buildingType);
  const profiles = OUTPUT_PROFILES.filter(({ key }) => !service || (key !== 'hot_water' && key !== 'kitchen'));
  const thermalOff = general.outputs.heating === 'none' && general.outputs.cooling === 'none';

  return (
    <div className="flex flex-col gap-2">
      {profiles.map(({ key, label }) => (
        <ApplianceRow key={key} label={label}>
          <SegmentedControl
            options={OUTPUT_LEVEL_OPTIONS}
            value={general.outputs[key]}
            onChange={(v) => setGen('outputs', { ...general.outputs, [key]: v })}
          />
        </ApplianceRow>
      ))}
      {!service && general.cooking_carrier !== 'gas' && general.outputs.kitchen !== 'none' && (
        <p className="text-[10px] text-muted-foreground">Cooking gas is reported only when cooking with gas.</p>
      )}
      {thermalOff && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Without heating or cooling BuEM skips the thermal model: surfaces and weather are not used.
        </p>
      )}
    </div>
  );
}
