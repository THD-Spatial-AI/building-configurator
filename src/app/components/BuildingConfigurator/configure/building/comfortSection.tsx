// The building editor's Heating and comfort group: what the building needs
// from its heat supply. Field keys are BuEM's own names, see DEFAULT_GENERAL.

import {
  FieldLabel, FieldRow, NumberInput, SegmentedControl, SelectInput,
} from '@/app/components/BuildingConfigurator/shared/ui';
import { setbackOptions, isServiceBuildingType } from '@/app/components/BuildingConfigurator/shared/buildingOptions';
import { computeTotalFloorArea } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';
import { useFormatNumber, useT, type Translate } from '@/app/i18n';
import { TOPICS } from '@/app/config/topics';
import type { ConfiguratorMode } from '@/app/lib/configuratorMode';

interface ComfortProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  mode: ConfiguratorMode;
}

// BuEM's three thermal_class values, so a saved choice reopens as chosen.
function massClasses(t: Translate) {
  return [
    { value: 'Light',  label: t('comfort.mass.light') },
    { value: 'Medium', label: t('comfort.mass.medium') },
    { value: 'Heavy',  label: t('comfort.mass.heavy') },
  ];
}

// c_m per class from EN ISO 13790 Table 12; Medium is the schema's default.
const MASS_DEFAULTS: Record<string, number> = { Light: 110, Medium: 165, Heavy: 260 };

/** Hot water included takes the heat topic's soft tile; not included stays plain. */
function hotWaterOptions(t: Translate) {
  return [
    { value: 'on',  label: t('comfort.hotWater.on'), activeClassName: TOPICS.heat.tile },
    { value: 'off', label: t('comfort.hotWater.off') },
  ];
}

/** Heating setpoint, setback and hot water; Advanced adds the cooling setpoint, air changes and thermal mass. */
export function ComfortSection({ general, setGen, mode }: ComfortProps) {
  const t = useT();
  const residential = !isServiceBuildingType(general.buildingType);
  return (
    <div className="flex flex-col gap-4">
      <FieldRow>
        <NumberInput
          label={t('comfort.heating.label')}
          value={general.comfortT_lb}
          onChange={(v) => setGen('comfortT_lb', v)}
          unit="°C" min={5} max={30} step={0.5}
          tip={t('comfort.heating.tip')}
        />
        <SelectInput
          label={t('comfort.setback.label')}
          value={general.setback_profile}
          onChange={(v) => setGen('setback_profile', v)}
          options={setbackOptions(t)}
          tip={t('comfort.setback.tip')}
        />
      </FieldRow>
      {mode === 'advanced' && <CoolingSetpoint general={general} setGen={setGen} />}
      {residential && (
        <div>
          <FieldLabel tip={t('comfort.hotWater.tip')}>
            {t('comfort.hotWater.label')}
          </FieldLabel>
          <SegmentedControl
            options={hotWaterOptions(t)}
            value={general.include_dhw ? 'on' : 'off'}
            onChange={(v) => setGen('include_dhw', v === 'on')}
            fullWidth
          />
        </div>
      )}
      {mode === 'advanced' && (
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
  const t = useT();
  const inverted = general.comfortT_ub <= general.comfortT_lb;
  return (
    <div>
      <NumberInput
        label={t('comfort.cooling.label')}
        value={general.comfortT_ub}
        onChange={(v) => setGen('comfortT_ub', v)}
        unit="°C" min={15} max={35} step={0.5}
        tip={t('comfort.cooling.tip')}
      />
      {inverted && (
        <p className="mt-1 text-[10px] text-amber-700">{t('comfort.cooling.inverted')}</p>
      )}
    </div>
  );
}

function AirChanges({ general, setGen }: FieldProps) {
  const t = useT();
  const format = useFormatNumber();
  const total = format(general.n_air_infiltration + general.n_air_use, 2);
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <FieldRow>
        <NumberInput
          label={t('comfort.air.infiltration.label')}
          value={general.n_air_infiltration}
          onChange={(v) => setGen('n_air_infiltration', Math.max(0, v))}
          unit="h⁻¹" min={0} max={5} step={0.05}
          tip={t('comfort.air.infiltration.tip')}
        />
        <NumberInput
          label={t('comfort.air.use.label')}
          value={general.n_air_use}
          onChange={(v) => setGen('n_air_use', Math.max(0, v))}
          unit="h⁻¹" min={0} max={5} step={0.05}
          tip={t('comfort.air.use.tip')}
        />
      </FieldRow>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{t('comfort.air.total')}</span>
        <span className="text-xs font-semibold text-foreground">{total} <span className="text-[10px] font-normal text-muted-foreground">h⁻¹</span></span>
      </div>
    </div>
  );
}

function ThermalMass({ general, setGen }: FieldProps) {
  const t = useT();
  const format = useFormatNumber();
  const totalMass = format(general.c_m * computeTotalFloorArea(general.floorArea, general.storeys) / 1000, 1);
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <div>
        <FieldLabel tip={t('comfort.mass.tip')}>
          {t('comfort.mass.label')}
        </FieldLabel>
        <SegmentedControl
          options={massClasses(t)}
          value={general.massClass}
          onChange={(v) => { setGen('massClass', v); setGen('c_m', MASS_DEFAULTS[v] ?? general.c_m); }}
          fullWidth
        />
      </div>
      <NumberInput
        label={t('comfort.mass.capacity.label')}
        value={general.c_m}
        onChange={(v) => setGen('c_m', Math.max(10, v))}
        unit="kJ/m²K" min={10} max={500} step={5}
        tip={t('comfort.mass.capacity.tip')}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{t('comfort.mass.total')}</span>
        <span className="text-xs font-semibold text-foreground">{totalMass} <span className="text-[10px] font-normal text-muted-foreground">MJ/K</span></span>
      </div>
    </div>
  );
}
