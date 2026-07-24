/**
 * buem-gateway API client.
 *
 * Runs BuEM for the current building and returns its load profile. The base
 * URL is configured via the VITE_BUEM_API_URL environment variable
 * (default: https://localhost:8443, buem-gateway's own local-dev default).
 *
 * Demo-only wiring: this is a direct frontend-to-service call, not the
 * target architecture. In the real system Building Configurator only
 * collects data — it flows through the EnerPlanET backend and an
 * Orchestration layer that dispatches to BuEM (and other services), not
 * through a call like this one. See buem-gateway's
 * decisions/2026-07-24-buem-gateway-standalone-repo.md for the full
 * reasoning. Kept here only to showcase the pieces working end-to-end ahead
 * of that layer existing.
 */

import type { BuildingIdentity } from './buemAdapter';
import { serializeToBuemFeature } from './buemAdapter';
import type { LoadDataPoint } from './loadProfile';

const BASE_URL = (import.meta.env.VITE_BUEM_API_URL as string | undefined) ?? 'https://localhost:8443';

/**
 * Identifies this app to the reverse proxy sitting in front of buem-gateway.
 * Prototype-stage credential only — see the orchestration-layer decision
 * note before this pattern is carried into production (same caveat as
 * ignisApi.ts's identical header).
 */
const AUTH_HEADERS: Record<string, string> = import.meta.env.VITE_BUEM_API_KEY
  ? { 'X-Api-Key': import.meta.env.VITE_BUEM_API_KEY as string }
  : {};

/** A {value, unit} measurement, as buem-gateway's response shapes them. */
interface BuemQuantity {
  value: number;
  unit: string;
}

interface BuemThermalLoadProfile {
  summary: {
    heating: { total: BuemQuantity };
    cooling?: { total: BuemQuantity };
    electricity: { total: BuemQuantity };
    peak_heating_load?: BuemQuantity;
    peak_cooling_load?: BuemQuantity;
    energy_intensity?: BuemQuantity;
  };
  timeseries?: {
    unit: string;
    timestamps: string[];
    heating: number[];
    cooling?: number[];
    electricity: number[];
  };
}

interface BuemBuildingResponse {
  id: string;
  buem: {
    thermal_load_profile: BuemThermalLoadProfile;
    model_metadata?: Record<string, unknown>;
  };
}

export interface BuemThermalSummary {
  heatingKwh: number;
  coolingKwh: number;
  electricityKwh: number;
  peakHeatingKw: number;
  peakCoolingKw: number;
  energyIntensityKwhM2: number;
}

export interface BuemSimulationResult {
  timeseries: LoadDataPoint[];
  thermalSummary: BuemThermalSummary;
}

/**
 * Runs BuEM for one building via buem-gateway's single-building endpoint
 * (POST /buem/building — no topology wrapper, since this UI only ever has
 * one building) and converts the result into the UI's LoadDataPoint /
 * thermal summary shapes.
 *
 * Returns null on any failure — unreachable service, BuEM rejected the
 * request (e.g. no TABULA match when envelope was incomplete), timeout —
 * so callers can surface a clear message without crashing. The request can
 * legitimately take several seconds: BuEM runs a real physics solve, not a
 * lookup.
 */
export async function runBuildingSimulation(
  identity: BuildingIdentity,
  elements: Record<string, any>,
  general: Record<string, any>,
  modelId: string,
  batteryConfig?: Record<string, any>,
): Promise<BuemSimulationResult | null> {
  const feature = serializeToBuemFeature(
    identity, elements, general,
    undefined, undefined, undefined, undefined,
    batteryConfig,
  );

  const request = {
    id: feature.id,
    geometry: feature.geometry,
    model_id: modelId,
    start_date: feature.properties.start_time,
    end_date: feature.properties.end_time,
    resolution: Number(feature.properties.resolution),
    buem: feature.properties.buem,
  };

  try {
    const res = await fetch(`${BASE_URL}/buem/building`, {
      method:  'POST',
      headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
      body:    JSON.stringify(request),
      signal:  AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as BuemBuildingResponse;
    return toSimulationResult(body.buem.thermal_load_profile);
  } catch {
    return null;
  }
}

function toSimulationResult(profile: BuemThermalLoadProfile): BuemSimulationResult {
  const ts = profile.timeseries;
  const timeseries: LoadDataPoint[] = ts
    ? ts.timestamps.map((timestamp, i) => ({
        timestamp,
        heating:     ts.heating[i] ?? 0,
        electricity: ts.electricity[i] ?? 0,
        // LoadDataPoint has no cooling field. Reusing "hotwater" for BuEM's
        // cooling output matches the existing thermalSummary-based fallback
        // in BuildingConfigurator.tsx's computeEnergyTotals — not a
        // physically accurate label, but the established convention.
        hotwater: ts.cooling?.[i] ?? 0,
      }))
    : [];

  return {
    timeseries,
    thermalSummary: {
      heatingKwh:           profile.summary.heating.total.value,
      coolingKwh:           profile.summary.cooling?.total.value ?? 0,
      electricityKwh:       profile.summary.electricity.total.value,
      peakHeatingKw:        profile.summary.peak_heating_load?.value ?? 0,
      peakCoolingKw:        profile.summary.peak_cooling_load?.value ?? 0,
      energyIntensityKwhM2: profile.summary.energy_intensity?.value ?? 0,
    },
  };
}
