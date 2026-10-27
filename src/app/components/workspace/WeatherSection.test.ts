import { describe, expect, it } from 'vitest';
import { weatherChoice } from './WeatherSection';
import type { WeatherOptions } from '../../lib/services';

const options: WeatherOptions = {
  defaultProvider: 'merra-2',
  providers: { 'merra-2': [2018], 'era5-land': [2018] },
  scenarios: { 'merra-2': ['p10', 'p50', 'p90'], 'era5-land': [] },
};

describe('weatherChoice', () => {
  it('sends nothing for the host default, or without options', () => {
    expect(weatherChoice(options, { provider: '', scenario: 'p50' })).toEqual({});
    expect(weatherChoice(options, { provider: 'merra-2', scenario: 'p50' })).toEqual({});
    expect(weatherChoice(null, { provider: 'era5-land', scenario: 'p90' })).toEqual({});
  });

  it('sends a provider and scenario that differ from the default', () => {
    expect(weatherChoice(options, { provider: '', scenario: 'p90' })).toEqual({ weather_scenario: 'p90' });
    expect(weatherChoice(options, { provider: 'era5-land', scenario: 'p50' })).toEqual({ weather_provider: 'era5-land' });
  });

  it('never sends a scenario the provider has not built', () => {
    expect(weatherChoice(options, { provider: 'era5-land', scenario: 'p10' })).toEqual({ weather_provider: 'era5-land' });
  });
});
