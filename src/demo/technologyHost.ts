// The dev shell playing host for the Technologies tab's technology cards: it
// decides which technologies besides PV a building has and holds their values.
// A real host takes them from its own technology catalogue and stores them.

import { useCallback, useMemo, useState } from 'react';
import type { TechCard, Technologies } from '../app/components/workspace/TechnologyCards';

type Values = Record<string, Record<string, number | null>>;

const INITIAL: Values = {
  battery: { power: 10, energy: 20, cost: 600 },
  heat_pump: { size: null, cop: 3.3, cost: 1400 },
};

/** The building's technologies other than PV, which has its own overview. */
export function useDemoTechnologies(): Technologies {
  const [values, setValues] = useState<Values>(INITIAL);

  const items = useMemo<TechCard[]>(() => {
    const cards: TechCard[] = [];
    if (values.battery) cards.push({
      id: 'battery',
      title: 'Battery',
      fields: [
        { key: 'power', label: 'Max power', value: values.battery.power, unit: 'kW', editable: true, min: 0 },
        { key: 'energy', label: 'Max energy', value: values.battery.energy, unit: 'kWh', editable: true, min: 0 },
        { key: 'cost', label: 'Investment', value: values.battery.cost, unit: 'EUR/kWh', editable: true, min: 0, step: 50 },
      ],
    });
    if (values.heat_pump) cards.push({
      id: 'heat_pump',
      title: 'Air-source heat pump',
      fields: [
        { key: 'size', label: 'Max size', value: values.heat_pump.size, unit: 'kW', editable: true, min: 0 },
        { key: 'cop', label: 'COP', value: values.heat_pump.cop, editable: true, min: 1, step: 0.1 },
        { key: 'cost', label: 'Investment', value: values.heat_pump.cost, unit: 'EUR/kW', editable: true, min: 0, step: 50 },
      ],
    });
    return cards;
  }, [values]);

  const onChange = useCallback((id: string, fieldKey: string, value: number | null) => {
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], [fieldKey]: value } }));
  }, []);

  const onRemove = useCallback((id: string) => {
    setValues((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  return useMemo(() => ({ items, onChange, onRemove }), [items, onChange, onRemove]);
}
