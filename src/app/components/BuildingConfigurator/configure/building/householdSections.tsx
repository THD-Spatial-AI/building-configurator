// The building editor's household and output sections: what BuEM reads beyond
// the envelope. Field keys are BuEM's own names, see DEFAULT_GENERAL.

import type { ReactNode } from 'react';
import { Dropdown, FieldLabel, FieldRow, NumberInput, SegmentedControl, SelectInput } from '@/app/components/BuildingConfigurator/shared/ui';
import {
  archetypeOptions,
  buildingTypeName,
  cookingCarrierOptions,
  EQUIPMENT_GROUPS,
  outputLevelOptions,
  OUTPUT_PROFILES,
  TV_IDS,
  isServiceBuildingType,
  requiresResidentialUnits,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';
import { useT, type Translate } from '@/app/i18n';

interface SectionProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
}

/** A whole number BuEM defaults when it is left empty. */
function OptionalCount({ label, value, onChange, tip, placeholder }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  tip: string;
  placeholder: string;
}) {
  const t = useT();
  return (
    <div>
      <FieldLabel tip={tip}>{label}</FieldLabel>
      <NumberInput
        label={label}
        hideLabel
        value={value ?? ''}
        placeholder={t('household.default')}
        onChange={(v) => onChange(Math.max(1, Math.round(v)))}
        unit="" min={1} step={1} integer
      />
      <p className="mt-1 text-[10px] text-muted-foreground">
        {value === null ? placeholder : (
          <button type="button" className="cursor-pointer text-[10px] underline" onClick={() => onChange(null)}>
            {t('household.useDefault')}
          </button>
        )}
      </p>
    </div>
  );
}

/** Dwellings, occupants and household habits; capacity alone for a service building. */
/** The region code is in Expert only: it is optional, and few users know their municipality's code. */
export function OccupancySection({ general, setGen, mode = 'basic' }: SectionProps & { mode?: 'basic' | 'expert' }) {
  const t = useT();
  if (isServiceBuildingType(general.buildingType)) {
    return (
      <div className="flex flex-col gap-3">
        <OptionalCount
          label={t('household.capacity.label')}
          value={general.capacity}
          onChange={(v) => setGen('capacity', v)}
          placeholder={t('household.capacity.placeholder')}
          tip={t('household.capacity.tip')}
        />
      </div>
    );
  }

  const required = requiresResidentialUnits(general.buildingType);
  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        {required ? (
          <div>
            <FieldLabel tip={t('household.dwellings.requiredTip')}>
              {t('household.dwellings.label')}
            </FieldLabel>
            <NumberInput
              value={general.residential_units ?? ''}
              onChange={(v) => setGen('residential_units', Math.max(1, Math.round(v)))}
              unit="" min={1} step={1} integer
            />
            {!general.residential_units && (
              <p className="mt-1 text-[10px] text-amber-700">
                {t('household.dwellings.required', { type: buildingTypeName(t, general.buildingType) })}
              </p>
            )}
          </div>
        ) : (
          <OptionalCount
            label={t('household.dwellings.label')}
            value={general.residential_units}
            onChange={(v) => setGen('residential_units', v)}
            placeholder={t('household.dwellings.placeholder')}
            tip={t('household.dwellings.tip')}
          />
        )}
        <OptionalCount
          label={t('household.persons.label')}
          value={general.num_persons}
          onChange={(v) => setGen('num_persons', v)}
          placeholder={t('household.persons.placeholder')}
          tip={t('household.persons.tip')}
        />
      </FieldRow>
      <SelectInput
        label={t('household.archetype.label')}
        value={general.archetype}
        onChange={(v) => setGen('archetype', v)}
        options={archetypeOptions(t)}
        tip={t('household.archetype.tip')}
      />
      {mode === 'expert' && <div>
        <FieldLabel tip={t('household.region.tip')}>
          {t('household.region.label')}
        </FieldLabel>
        <div className="cfg-input-wrap">
          <input
            type="text"
            value={general.region_code}
            onChange={(e) => setGen('region_code', e.target.value.trim().toUpperCase())}
            placeholder={t('household.region.placeholder')}
            className="cfg-number"
          />
        </div>
      </div>}
      <SelectInput
        label={t('household.cooking.label')}
        value={general.cooking_carrier}
        onChange={(v) => setGen('cooking_carrier', v)}
        options={cookingCarrierOptions(t)}
        tip={t('household.cooking.tip')}
      />
    </div>
  );
}

type Ownership = 'default' | 'on' | 'off';

function ownershipOptions(t: Translate): { value: Ownership; label: string }[] {
  return [
    { value: 'default', label: t('household.default') },
    { value: 'on', label: t('household.equipment.yes') },
    { value: 'off', label: t('household.equipment.no') },
  ];
}

function tvOptions(t: Translate) {
  return ['default', '0', '1', '2', '3'].map((value) => ({
    value, label: value === 'default' ? t('household.default') : value,
  }));
}

/** The TV count the three TV ids encode, or 'default' when none is set. */
function tvCount(equipment: Record<string, boolean>): string {
  if (TV_IDS.every((id) => equipment[id] === undefined)) return 'default';
  return String(TV_IDS.filter((id) => equipment[id]).length);
}

/** Appliance ownership: each one forced on, forced off, or left to BuEM's ownership probability. */
export function EquipmentSection({ general, setGen }: SectionProps) {
  const t = useT();
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
        {t('household.equipment.intro')}
        {requiresResidentialUnits(general.buildingType) && ` ${t('household.equipment.sameInEveryDwelling')}`}
      </p>
      {EQUIPMENT_GROUPS.map((group) => (
        <Dropdown key={group.id} title={(
          <span className="flex items-baseline justify-between gap-2">
            <span>{group.label(t)}</span>
            <span className="text-[11px] font-normal text-muted-foreground">{groupSummary(t, group, equipment)}</span>
          </span>
        )}>
          <div className="flex flex-col gap-1.5">
            {group.id === 'electronics' && (
              <ApplianceRow label={t('household.equipment.televisions')}>
                <SegmentedControl options={tvOptions(t)} value={tvCount(equipment)} onChange={setTvCount} />
              </ApplianceRow>
            )}
            {group.items.map((item) => (
              <ApplianceRow key={item.id} label={item.label(t)}>
                <SegmentedControl
                  options={ownershipOptions(t)}
                  value={equipment[item.id] === undefined ? 'default' : equipment[item.id] ? 'on' : 'off'}
                  onChange={(v) => setOwnership(item.id, v as Ownership)}
                />
              </ApplianceRow>
            ))}
          </div>
        </Dropdown>
      ))}
      {Object.keys(equipment).length > 0 && (
        <button
          type="button"
          onClick={() => setGen('equipment', {})}
          className="cursor-pointer self-start text-[11px] text-muted-foreground underline"
        >
          {t('household.equipment.resetAll')}
        </button>
      )}
    </div>
  );
}

/** One line for a collapsed appliance group: how many are set by hand, and how. */
function groupSummary(t: Translate, group: (typeof EQUIPMENT_GROUPS)[number], equipment: Record<string, boolean>): string {
  const ids = [...group.items.map((item) => item.id), ...(group.id === 'electronics' ? TV_IDS : [])];
  const set = ids.filter((id) => equipment[id] !== undefined);
  if (set.length === 0) return t('household.equipment.groupDefault', { items: group.items.length });
  const owned = set.filter((id) => equipment[id]).length;
  return t('household.equipment.groupSet', { set: set.length, owned, notOwned: set.length - owned });
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
  const t = useT();
  const service = isServiceBuildingType(general.buildingType);
  const profiles = OUTPUT_PROFILES.filter(({ key }) => !service || (key !== 'hot_water' && key !== 'kitchen'));
  const thermalOff = general.outputs.heating === 'none' && general.outputs.cooling === 'none';

  return (
    <div className="flex flex-col gap-2">
      {profiles.map(({ key, label }) => (
        <ApplianceRow key={key} label={label(t)}>
          <SegmentedControl
            options={outputLevelOptions(t)}
            value={general.outputs[key]}
            onChange={(v) => setGen('outputs', { ...general.outputs, [key]: v })}
          />
        </ApplianceRow>
      ))}
      {!service && general.cooking_carrier && general.cooking_carrier !== 'gas' && general.outputs.kitchen !== 'none' && (
        <p className="text-[10px] text-muted-foreground">{t('household.outputs.cookingGasOnlyWithGas')}</p>
      )}
      {thermalOff && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {t('household.outputs.thermalOff')}
        </p>
      )}
    </div>
  );
}
