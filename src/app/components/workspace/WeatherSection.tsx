// The weather a BuEM run uses: a provider, and where the host has built them
// for that provider, a low, typical or high solar year.

import { TOPICS } from '@/app/config/topics';
import { SectionCard } from '../BuildingConfigurator/shared/SectionCard';
import { SegmentedControl, SelectInput } from '../BuildingConfigurator/shared/ui';
import type { WeatherOptions, WeatherScenario } from '../../lib/services';
import type { WeatherChoice } from '../../lib/buemRun';
import { useT } from '../../i18n';

/** What the user picked; an empty provider is the host's default. */
export interface WeatherSelection {
  provider: string;
  scenario: WeatherScenario;
}

export const DEFAULT_WEATHER: WeatherSelection = { provider: '', scenario: 'p50' };

const PROVIDER_NAMES: Record<string, string> = {
  'merra-2': 'MERRA-2',
  'era5-land': 'ERA5-Land',
  'cosmo-rea6': 'COSMO-REA6',
};

const SCENARIOS: WeatherScenario[] = ['p10', 'p50', 'p90'];

/**
 * The run request's weather fields: each only where it differs from the
 * host's default, and a scenario only where the provider has it built.
 */
export function weatherChoice(options: WeatherOptions | null, selection: WeatherSelection): WeatherChoice {
  if (!options) return {};
  const provider = selection.provider || options.defaultProvider;
  const offered = options.scenarios[provider] ?? [];
  return {
    ...(provider !== options.defaultProvider ? { weather_provider: provider } : {}),
    ...(selection.scenario !== 'p50' && offered.includes(selection.scenario) ? { weather_scenario: selection.scenario } : {}),
  };
}

/** The weather choice of the Building tab; changing the provider goes back to the typical year. */
export function WeatherSection({ options, selection, onChange }: {
  options: WeatherOptions;
  selection: WeatherSelection;
  onChange: (selection: WeatherSelection) => void;
}) {
  const t = useT();
  const provider = selection.provider || options.defaultProvider;
  const offered = SCENARIOS.filter((s) => (options.scenarios[provider] ?? []).includes(s));
  return (
    <SectionCard topic={TOPICS.weather} title={t('weather.title')} info={t('help.weather')}>
      <div className="flex flex-col gap-3 p-3">
        <SelectInput
          label={t('weather.provider')}
          value={provider}
          onChange={(v) => onChange({ provider: v, scenario: 'p50' })}
          options={Object.keys(options.providers).map((name) => ({ value: name, label: PROVIDER_NAMES[name] ?? name }))}
        />
        {offered.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">{t('weather.year')}</span>
            <SegmentedControl
              fullWidth
              options={offered.map((s) => ({ value: s, label: t(`weather.scenario.${s}`) }))}
              value={selection.scenario}
              onChange={(v) => onChange({ provider: selection.provider, scenario: v as WeatherScenario })}
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
