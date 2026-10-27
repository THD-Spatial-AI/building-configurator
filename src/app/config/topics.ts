// One icon and one colour per topic. Energy topics take their carrier's
// colour; building and envelope share slate and differ by icon; money is green.
// Dark mode tints the same hue as the light value.
// Class names are written out in full so Tailwind finds them.

import {
  Banknote, Battery, Building2, CookingPot, Droplets, Flame, Heater, Layers, Snowflake, Sun, Zap,
} from '@/app/components/icons';

export type TopicKey =
  | 'electricity' | 'pv' | 'battery' | 'heat' | 'cooling' | 'hotWater' | 'gas' | 'cooking'
  | 'building' | 'envelope' | 'costs';

export interface Topic {
  Icon: typeof Sun;
  /** Header band or icon tile: the light background with the dark text shade. */
  tile: string;
  /** The icon on a tile or header. */
  icon: string;
  /** A solid fill, for a bar or legend swatch. */
  bar: string;
  /** The border of a card in focus. */
  border: string;
}

type Palette = Omit<Topic, 'Icon'>;

const AMBER: Palette = {
  tile: 'bg-[#FFF3D1] text-[#7A5300] dark:bg-[#C98A00]/20 dark:text-[#F2C661]',
  icon: 'text-[#C98A00] dark:text-[#F2C661]',
  bar: 'bg-[#C98A00]',
  border: 'border-[#C98A00]',
};
const ORANGE: Palette = {
  tile: 'bg-[#FDE6DA] text-[#A6431A] dark:bg-[#D2561E]/20 dark:text-[#F0996F]',
  icon: 'text-[#D2561E] dark:text-[#F0996F]',
  bar: 'bg-[#D2561E]',
  border: 'border-[#D2561E]',
};
const BLUE: Palette = {
  tile: 'bg-[#DFEBF7] text-[#245A8C] dark:bg-[#2F74B5]/25 dark:text-[#8DB9E6]',
  icon: 'text-[#2F74B5] dark:text-[#8DB9E6]',
  bar: 'bg-[#2F74B5]',
  border: 'border-[#2F74B5]',
};
const RED: Palette = {
  tile: 'bg-[#F9E1E1] text-[#8E2A2A] dark:bg-[#C23B3B]/25 dark:text-[#EE9A9A]',
  icon: 'text-[#C23B3B] dark:text-[#EE9A9A]',
  bar: 'bg-[#C23B3B]',
  border: 'border-[#C23B3B]',
};
const VIOLET: Palette = {
  tile: 'bg-[#EEE6F8] text-[#5E3A92] dark:bg-[#7A4FB5]/25 dark:text-[#C3A6EA]',
  icon: 'text-[#7A4FB5] dark:text-[#C3A6EA]',
  bar: 'bg-[#7A4FB5]',
  border: 'border-[#7A4FB5]',
};
const SLATE: Palette = {
  tile: 'bg-[#E6EAF2] text-[#33415C] dark:bg-[#475B7A]/35 dark:text-[#C3CDDD]',
  icon: 'text-[#475B7A] dark:text-[#C3CDDD]',
  bar: 'bg-[#475B7A]',
  border: 'border-[#475B7A] dark:border-[#C3CDDD]',
};
const GREEN: Palette = {
  tile: 'bg-[#E2F2E8] text-[#1F5A38] dark:bg-[#2F7A4F]/25 dark:text-[#8FD1A9]',
  icon: 'text-[#2F7A4F] dark:text-[#8FD1A9]',
  bar: 'bg-[#2F7A4F]',
  border: 'border-[#2F7A4F]',
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
