// PV products from the host's technology catalogue: their module, their costs,
// the constraints the configurator shows, and which other product reaches more
// capacity on a surface. The shapes follow EnerPlanET's technology DTOs.

import { pvLayout, type PvLayout, type PvLayoutOptions, type PvModule } from './pvLayout';
import type { SurfacePolygon } from './surfaceMesh';

/** One constraint of a product; "INF" stands for an unbounded value. */
export interface TechnologyConstraint {
  key: string;
  alias?: string;
  description?: string;
  default_value: number | string | null;
  unit?: string;
  min?: number | string;
  max?: number | string;
  options?: string[];
}

/** A technology product: the catalogue's own, or a building's copy of one. */
export interface TechnologyProduct {
  id: string;
  key: string;
  /** For PV, 'pv_supply'. */
  type: string;
  manufacturer?: string;
  model?: string;
  alias?: string;
  constraints: TechnologyConstraint[];
}

/** The drag-and-drop data type that carries a product id from the catalogue to a surface. */
export const PV_PRODUCT_DRAG_TYPE = 'application/x-pv-product';

/** Asked in basic mode, in this order: cost per kWp, yearly upkeep per kWp, lifetime in years. */
const BASIC_KEYS = ['cost_energy_cap', 'cost_om_annual', 'cont_lifetime'];
/** Also shown in expert mode: what else reaches Calliope or the PV yield service. Keys nothing reads are left out. */
const EXPERT_KEYS = [
  ...BASIC_KEYS,
  'cost_interest_rate', 'cost_om_annual_investment_fraction', 'cost_om_prod', 'cont_energy_cap_max_systemwide',
  'losses', 'dc_ac_ratio', 'inv_eff', 'module_type',
];

/** The product's name as a person reads it. */
export function productName(product: TechnologyProduct): string {
  const made = [product.manufacturer, product.model].filter(Boolean).join(' ');
  return made || product.alias || product.key;
}

/** A constraint's value as a number, or undefined when it is missing, unbounded or not a number. */
export function constraintNumber(product: TechnologyProduct | undefined, key: string): number | undefined {
  const value = product?.constraints.find((c) => c.key === key)?.default_value;
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
}

/** The product's module, from module_width_m, module_height_m and module_power_kwp; the fallback without all three. */
export function productModule(product: TechnologyProduct | undefined, fallback: PvModule): PvModule {
  const width = constraintNumber(product, 'module_width_m');
  const height = constraintNumber(product, 'module_height_m');
  const kwp = constraintNumber(product, 'module_power_kwp');
  return width && height && kwp ? { width, height, kwp } : fallback;
}

/** The currency of the product's costs, from the unit of cost_energy_cap ("EUR/kW" gives "EUR"); empty without one. */
export function productCurrency(product: TechnologyProduct | undefined): string {
  return product?.constraints.find((c) => c.key === 'cost_energy_cap')?.unit?.split('/')[0].trim() ?? '';
}

/** Investment and yearly O&M in the product's currency, from its costs per kWp; undefined where it carries none. */
export function pvCosts(product: TechnologyProduct | undefined, kwp: number): { investment?: number; omPerYear?: number } {
  const perKwp = constraintNumber(product, 'cost_energy_cap');
  const omPerKwp = constraintNumber(product, 'cost_om_annual');
  return {
    investment: perKwp === undefined ? undefined : perKwp * kwp,
    omPerYear: omPerKwp === undefined ? undefined : omPerKwp * kwp,
  };
}

/** The constraints the product carries that this mode shows, in the order above. */
export function shownConstraints(product: TechnologyProduct, mode: 'basic' | 'expert'): TechnologyConstraint[] {
  const keys = mode === 'basic' ? BASIC_KEYS : EXPERT_KEYS;
  return keys.flatMap((key) => product.constraints.filter((c) => c.key === key));
}

/** How many better-fitting products are offered for one surface. */
const FITS_MORE_COUNT = 3;

/** Other products that reach more than `currentKwp` on the surface, the most first. */
export function fitsMore(
  surface: SurfacePolygon,
  options: PvLayoutOptions,
  catalogue: readonly TechnologyProduct[],
  currentId: string | undefined,
  currentKwp: number,
  fallback: PvModule,
): { product: TechnologyProduct; layout: PvLayout }[] {
  return catalogue
    .filter((product) => product.id !== currentId)
    .map((product) => ({ product, layout: pvLayout(surface, productModule(product, fallback), options) }))
    .filter(({ layout }) => layout.kwp > currentKwp + 1e-9)
    .sort((a, b) => b.layout.kwp - a.layout.kwp)
    .slice(0, FITS_MORE_COUNT);
}
