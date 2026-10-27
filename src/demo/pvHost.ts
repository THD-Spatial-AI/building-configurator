// The dev shell playing host for PV: it decides which surfaces to offer and
// what capacity they carry, offers a catalogue of demo products, and keeps the
// user's choices. A real host derives these from its own PV placement and
// technology catalogue, and stores them.

import { useCallback, useMemo, useState } from 'react';
import type { PvMode, PvSurface } from '../app/components/workspace/PvMode';
import type { PvMounting, PvOrientation } from '../app/lib/pvLayout';
import type { TechnologyProduct } from '../app/lib/pvProducts';
import type { BuildingElement } from '../app/components/BuildingConfigurator/configure/model/buildingElements';

/** Demo module density; a real host takes it from the PV type. */
const KWP_PER_M2 = 0.2;

function capacity(area: number, usableShare: number): number {
  return Number((area * usableShare * KWP_PER_M2).toFixed(1));
}

/** A demo product with the constraint keys EnerPlanET's pv_supply carries, plus a module size. */
function demoProduct(id: string, model: string, module: [number, number, number], costPerKw: number): TechnologyProduct {
  const values: [string, number | string, string?][] = [
    ['module_width_m', module[0], 'm'], ['module_height_m', module[1], 'm'], ['module_power_kwp', module[2], 'kWp'],
    ['cost_energy_cap', costPerKw, 'EUR/kW'], ['cost_om_annual', 10, 'EUR/kW/year'], ['cont_lifetime', 25, 'years'],
    ['cost_interest_rate', 0.05], ['cont_energy_cap_max_systemwide', 'INF', 'kW'],
    ['losses', 14, '%'], ['dc_ac_ratio', 1.2], ['inv_eff', 96, '%'], ['module_type', 'standard'],
  ];
  return {
    id, key: `pv_supply_${id}`, type: 'pv_supply', manufacturer: 'Demo', model,
    constraints: values.map(([key, default_value, unit]) => ({
      key, default_value, unit,
      ...(key === 'module_type' && { options: ['standard', 'premium', 'thin_film'] }),
    })),
  };
}

const CATALOGUE: TechnologyProduct[] = [
  demoProduct('mono-420', 'Mono 420 W', [1.134, 1.762, 0.42], 575),
  demoProduct('compact-300', 'Compact 300 W', [1.0, 1.5, 0.3], 610),
  demoProduct('large-550', 'Large 550 W', [1.134, 2.278, 0.55], 540),
];

/** Roofs facing east through west are suggested; the other roofs and every wall are offered without a highlight. */
function offered(elements: Record<string, BuildingElement>): Record<string, PvSurface> {
  const surfaces: Record<string, PvSurface> = {};
  for (const el of Object.values(elements)) {
    if ((el.type !== 'roof' && el.type !== 'wall') || !(el.area > 0)) continue;
    const southish = el.azimuth === -1 || (el.azimuth >= 90 && el.azimuth <= 270);
    const usableShare = el.type === 'roof' ? 0.6 : 0.4;
    surfaces[el.id] = {
      state: el.type === 'roof' && southish ? 'suggested' : 'available',
      usableShare,
      maxKwp: capacity(el.area, usableShare),
    };
  }
  return surfaces;
}

/** The building's PV, held in this component's state as a host would hold it. */
export function useDemoPvHost(elements: Record<string, BuildingElement>): PvMode {
  const initial = useMemo(() => offered(elements), [elements]);
  const [surfaces, setSurfaces] = useState(initial);
  const [catalogue, setCatalogue] = useState(CATALOGUE);
  // The building's copies, made the first time a product is used or edited here.
  const [products, setProducts] = useState<Record<string, TechnologyProduct>>({});

  const patchSurface = useCallback((surfaceId: string, patch: Partial<PvSurface>) => {
    setSurfaces((prev) => ({ ...prev, [surfaceId]: { ...prev[surfaceId], ...patch } }));
  }, []);

  const onToggle = useCallback((surfaceId: string, installed: boolean) => {
    // Switched off, a surface goes back to how it was first offered.
    patchSurface(surfaceId, { state: installed ? 'installed' : initial[surfaceId].state });
  }, [initial, patchSurface]);

  const onShareChange = useCallback((surfaceId: string, usableShare: number) => {
    patchSurface(surfaceId, { usableShare, maxKwp: capacity(elements[surfaceId].area, usableShare) });
  }, [elements, patchSurface]);

  const onMountingChange = useCallback((surfaceId: string, mounting: PvMounting, orientation: PvOrientation | undefined) => {
    patchSurface(surfaceId, { mounting, orientation });
  }, [patchSurface]);

  const onModuleCountChange = useCallback((surfaceId: string, moduleCount: number | null) => {
    patchSurface(surfaceId, { moduleCount: moduleCount ?? undefined });
  }, [patchSurface]);

  const onAssignProduct = useCallback((surfaceId: string, productId: string) => {
    patchSurface(surfaceId, { productId });
  }, [patchSurface]);

  const onConstraintChange = useCallback((productId: string, key: string, value: number | string) => {
    setProducts((prev) => {
      const base = prev[productId] ?? catalogue.find((p) => p.id === productId);
      if (!base) return prev;
      const constraints = base.constraints.map((c) => (c.key === key ? { ...c, default_value: value } : c));
      return { ...prev, [productId]: { ...base, constraints } };
    });
  }, [catalogue]);

  const onSaveAsTechnology = useCallback(async (productId: string, name: string) => {
    const base = products[productId] ?? catalogue.find((p) => p.id === productId);
    if (!base) throw new Error(`No product ${productId} to save`);
    const id = `user-${Date.now()}`;
    setCatalogue((prev) => [...prev, { ...base, id, key: `pv_supply_${id}`, manufacturer: undefined, model: undefined, alias: name }]);
    return id;
  }, [products, catalogue]);

  return useMemo(() => ({
    surfaces,
    notice: 'The simulation does not consider shading from trees or neighbouring buildings.',
    typeLabel: 'Demo PV catalogue',
    productId: 'mono-420',
    catalogue,
    products,
    onToggle,
    onShareChange,
    onMountingChange,
    onModuleCountChange,
    onAssignProduct,
    onConstraintChange,
    onSaveAsTechnology,
  }), [surfaces, catalogue, products, onToggle, onShareChange, onMountingChange, onModuleCountChange, onAssignProduct, onConstraintChange, onSaveAsTechnology]);
}
