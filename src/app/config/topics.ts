// One icon and one colour per topic. Energy topics take their carrier's
// colour; building and envelope share slate and differ by icon; money is green.
// Class names are written out in full so Tailwind finds them.

import {
  Banknote, Battery, Building2, CookingPot, Droplets, Flame, Heater, Layers, Snowflake, Sun, Zap,
} from '@/app/components/icons';

export type TopicKey =
  | 'electricity' | 'pv' | 'battery' | 'heat' | 'cooling' | 'hotWater' | 'gas' | 'cooking'
  | 'building' | 'envelope' | 'costs';

export interface Topic {
  Icon: typeof Sun;
  /** Icon tile on a card that follows the host's theme. */
  tile: string;
  /** Icon tile, icon and figure on the dark demand panel. */
  onDark: { iconBg: string; iconColor: string; valueColor: string };
}

const AMBER = {
  tile: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  onDark: { iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400', valueColor: 'text-amber-300' },
};
const ORANGE = {
  tile: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  onDark: { iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', valueColor: 'text-orange-300' },
};
const BLUE = {
  tile: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  onDark: { iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400', valueColor: 'text-blue-300' },
};
const RED = {
  tile: 'bg-red-500/15 text-red-700 dark:text-red-300',
  onDark: { iconBg: 'bg-red-500/20', iconColor: 'text-red-400', valueColor: 'text-red-300' },
};
const VIOLET = {
  tile: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  onDark: { iconBg: 'bg-violet-500/20', iconColor: 'text-violet-400', valueColor: 'text-violet-300' },
};
const SLATE = {
  tile: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  onDark: { iconBg: 'bg-slate-600/50', iconColor: 'text-slate-300', valueColor: 'text-slate-200' },
};
const GREEN = {
  tile: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  onDark: { iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400', valueColor: 'text-emerald-300' },
};

export const TOPICS: Record<TopicKey, Topic> = {
  electricity: { Icon: Zap, ...AMBER },
  pv: { Icon: Sun, ...AMBER },
  battery: { Icon: Battery, ...AMBER },
  heat: { Icon: Flame, ...ORANGE },
  cooling: { Icon: Snowflake, ...BLUE },
  hotWater: { Icon: Droplets, ...RED },
  gas: { Icon: Flame, ...VIOLET },
  cooking: { Icon: CookingPot, ...VIOLET },
  building: { Icon: Building2, ...SLATE },
  envelope: { Icon: Layers, ...SLATE },
  costs: { Icon: Banknote, ...GREEN },
};

/** EnerPlanET technology types (the catalogue's `type`), mapped to their topic. */
const TECHNOLOGY_TOPICS: Record<string, Topic> = {
  pv_supply: TOPICS.pv,
  battery_storage: TOPICS.battery,
  air_source_heat_pump: { Icon: Heater, ...ORANGE },
  ground_source_heat_pump: { Icon: Heater, ...ORANGE },
  electric_boilers: { Icon: Zap, ...ORANGE },
  gas_boiler: { Icon: Flame, ...VIOLET },
  air_conditioner: TOPICS.cooling,
};

/** The topic for an EnerPlanET technology type; building slate for a type not listed. */
export function technologyTopic(type: string): Topic {
  return TECHNOLOGY_TOPICS[type] ?? TOPICS.building;
}
