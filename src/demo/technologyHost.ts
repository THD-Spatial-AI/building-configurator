// The dev shell playing host for the Technologies tab's technology cards: it
// decides which technologies besides PV a building has and holds their values.
// A real host takes them from its own technology catalogue and stores them.
// Costs follow EnerPlanET's seed: per kW for every type, plus per kWh for storage.

import { useCallback, useMemo, useState } from 'react';
import type { TechCard, Technologies } from '../app/components/workspace/TechnologyCards';

type Values = Record<string, Record<string, number | null>>;

const INITIAL: Values = {
  battery: { power: 10, energy: 20, costPerKw: 300, costPerKwh: 600 },
  heat_pump: { size: null, cop: 3.3, cost: 900 },
};

const PRODUCTS: Record<string, { id: string; name: string; detail?: string }[]> = {
  battery: [
    { id: 'li-home', name: 'Lithium-ion home storage', detail: '10 kW · 20 kWh · 15 years' },
    { id: 'lfp', name: 'LFP storage', detail: '5 kW · 10 kWh · 20 years' },
  ],
  heat_pump: [
    { id: 'ashp', name: 'Air-source heat pump', detail: 'COP 3.3 · 18 years' },
    { id: 'ashp-hp', name: 'Air-source heat pump, high efficiency', detail: 'COP 3.8 · 18 years' },
  ],
};

/** The building's technologies other than PV, which has its own overview. */
export function useDemoTechnologies(): Technologies {
  const [values, setValues] = useState<Values>(INITIAL);
  const [products, setProducts] = useState<Record<string, string>>({ battery: 'li-home', heat_pump: 'ashp' });

  const items = useMemo<TechCard[]>(() => {
    const catalogue = (id: string) => ({
      products: PRODUCTS[id],
      productId: products[id],
      onSelect: (productId: string) => setProducts((prev) => ({ ...prev, [id]: productId })),
    });
    const cards: TechCard[] = [];
    const battery = values.battery;
    if (battery) cards.push({
      id: 'battery',
      type: 'battery_storage',
      title: 'Battery',
      subtitle: 'Stores electricity',
      figures: [{ label: 'Power', value: battery.power, unit: 'kW' }, { label: 'Energy', value: battery.energy, unit: 'kWh' }],
      investment: battery.power !== null && battery.energy !== null
        ? { amount: battery.power * (battery.costPerKw ?? 0) + battery.energy * (battery.costPerKwh ?? 0), currency: 'EUR' }
        : { amount: null, currency: 'EUR', rate: `${battery.costPerKwh} EUR/kWh` },
      catalogue: catalogue('battery'),
      fields: [
        { key: 'power', label: 'How fast can it charge?', value: battery.power, unit: 'kW', editable: true, min: 0 },
        { key: 'energy', label: 'How much can it store?', value: battery.energy, unit: 'kWh', editable: true, min: 0 },
        { key: 'costPerKwh', label: 'What does it cost per kWh?', value: battery.costPerKwh, unit: 'EUR/kWh', editable: true, min: 0, step: 50 },
      ],
    });
    const heatPump = values.heat_pump;
    if (heatPump) cards.push({
      id: 'heat_pump',
      type: 'air_source_heat_pump',
      title: 'Heat pump',
      subtitle: heatPump.size === null ? 'Air source · size open, so no total yet' : 'Air source',
      figures: [{ label: 'COP', value: heatPump.cop }, { label: 'Size', value: heatPump.size, unit: 'kW' }],
      investment: heatPump.size === null
        ? { amount: null, currency: 'EUR', rate: `${heatPump.cost} EUR/kW` }
        : { amount: heatPump.size * (heatPump.cost ?? 0), currency: 'EUR' },
      catalogue: catalogue('heat_pump'),
      fields: [
        { key: 'size', label: 'Max size', value: heatPump.size, unit: 'kW', editable: true, min: 0 },
        { key: 'cop', label: 'COP', value: heatPump.cop, editable: true, min: 1, step: 0.1 },
        { key: 'cost', label: 'What does it cost per kW?', value: heatPump.cost, unit: 'EUR/kW', editable: true, min: 0, step: 50 },
      ],
    });
    return cards;
  }, [values, products]);

  const onChange = useCallback((id: string, fieldKey: string, value: number | null) => {
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], [fieldKey]: value } }));
  }, []);

  const onRemove = useCallback((id: string) => {
    setValues((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  // Brings back a removed technology; a real host opens its own catalogue of types.
  const onAdd = useCallback(() => {
    setValues((prev) => {
      const missing = Object.keys(INITIAL).find((id) => !prev[id]);
      return missing ? { ...prev, [missing]: INITIAL[missing] } : prev;
    });
  }, []);

  return useMemo(() => ({ items, onChange, onRemove, onAdd }), [items, onChange, onRemove, onAdd]);
}
