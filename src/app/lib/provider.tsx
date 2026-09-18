/**
 * Supplies the configurator's API clients from a host-provided transport.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createEnerplanetApi, type EnerplanetApi } from './enerplanetApi';
import { createIgnisApi, type IgnisApi } from './ignisApi';
import type { HttpClient } from './http';

export interface ConfiguratorApi {
  enerplanet: EnerplanetApi;
  ignis: IgnisApi;
}

const ApiContext = createContext<ConfiguratorApi | null>(null);

export interface BuildingConfiguratorProviderProps {
  /**
   * Transport to the EnerPlanET API. Hold it in a module constant or a
   * useMemo: a client rebuilt on every render rebuilds the clients below with
   * it, and the effects that load field metadata and variant lists key on
   * their identity.
   */
  http: HttpClient;
  children: ReactNode;
}

export function BuildingConfiguratorProvider({ http, children }: BuildingConfiguratorProviderProps) {
  const api = useMemo<ConfiguratorApi>(
    () => ({ enerplanet: createEnerplanetApi(http), ignis: createIgnisApi(http) }),
    [http],
  );
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useConfiguratorApi(): ConfiguratorApi {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error(
      'useConfiguratorApi called outside BuildingConfiguratorProvider. Wrap the '
      + 'configurator in <BuildingConfiguratorProvider http={client}> and pass the '
      + "host application's configured API client.",
    );
  }
  return api;
}
