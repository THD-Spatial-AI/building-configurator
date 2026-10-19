// The dev shell playing host for the Technologies tab: it decides which
// technologies a building has and holds their values. A real host takes them
// from its own technology catalogue and stores them.

import { useCallback, useMemo, useState } from 'react';
import type { PvMode } from '../app/components/workspace/PvMode';
import type { TechCard, Technologies } from '../app/components/workspace/TechnologyCards';

type Values = Record<string, Record<string, number | null>>;

const INITIAL: Values = {
  pv: { cost: 1100 },
  battery: { power: 10, energy: 20, cost: 600 },
  heat_pump: { size: null, cop: 3.3, cost: 1400 },
};

/** The building's technologies, with PV's capacity derived from the PV surfaces and its action opening PV mode. */
export function useDemoTechnologies(pv: PvMode, onEditPv: () => void): Technologies {
  const [values, setValues] = useState<Values>(INITIAL);

  const installed = Object.values(pv.surfaces).filter((surface) => surface.state === 'installed');
  const capacity = Number(installed.reduce((sum, surface) => sum + surface.maxKwp, 0).toFixed(1));

  const items = useMemo<TechCard[]>(() => {
    const cards: TechCard[] = [];
    if (values.pv) cards.push({
      id: 'pv',
      title: pv.typeLabel,
      subtitle: `${installed.length} ${installed.length === 1 ? 'surface' : 'surfaces'}`,
      fields: [
        { key: 'capacity', label: 'Capacity', value: capacity, unit: 'kWp' },
        { key: 'cost', label: 'Investment', value: values.pv.cost, unit: 'EUR/kW', editable: true, min: 0, step: 50 },
      ],
      action: { label: 'PV surfaces', onClick: onEditPv },
    });
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
  }, [values, pv.typeLabel, installed.length, capacity, onEditPv]);

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
