// The building editor's Insulation and windows group: TABULA's refurbishment
// state for the whole building in Basic, and per element type in Expert with
// its U-value and loss factor, plus the windows BuEM adds when there are none.

import { cn } from '@/lib/utils';
import { FieldLabel, NumberInput, SelectInput } from '@/app/components/BuildingConfigurator/shared/ui';
import {
  REFURB_TYPES, customCount, type RefurbElementType, type RefurbStates,
} from '@/app/lib/refurbishment';
import type { IgnisVariantLevel } from '@/app/lib/ignisAdapter';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';

/** What the group reads from the building model and calls back into it. */
export interface InsulationProps {
  elements: Record<string, BuildingElement>;
  /** The building's refurbishment variants 1 to 3; empty when TABULA has none for it. */
  levels: IgnisVariantLevel[];
  states: RefurbStates;
  initial: RefurbStates;
  /** City2TABULA's variant code for the building, when it has one. */
  variantCode?: string;
  avgUValue: number;
  onSetState: (types: RefurbElementType[], number: number) => void;
  onSetTypeUValue: (type: RefurbElementType, uValue: number) => void;
  onSetTypeLossFactor: (type: RefurbElementType, b: number) => void;
  /** Opens the Envelope tab, where surfaces are edited one by one. */
  onOpenEnvelope?: () => void;
}

const TYPE_LABELS: Record<RefurbElementType, string> = {
  wall: 'Walls', roof: 'Roof', floor: 'Floor', window: 'Windows', door: 'Doors',
};

/** The types whose loss factor is set as a group: those against ground or an unheated space. */
const LOSS_FACTOR_TYPES: RefurbElementType[] = ['wall', 'roof', 'floor'];

interface Props extends InsulationProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  mode: 'basic' | 'expert';
}

/** One line for the group's header. */
export function insulationSummary({ levels, states, elements, initial, avgUValue }: InsulationProps): string {
  const present = REFURB_TYPES.filter((type) => Object.values(elements).some((el) => el.type === type));
  const custom = present.some((type) => customCount(elements, type, states[type], initial, levels) > 0);
  const uniform = present.every((type) => states[type] === states[present[0]]);
  const label = levels.find((level) => level.number === states[present[0]])?.label;
  const state = levels.length === 0 ? null : custom || !uniform || !label ? 'Mixed' : label;
  return [state, `average U ${avgUValue.toFixed(2)} W/m²K`].filter(Boolean).join(' · ');
}

/** Building-wide preset; in Expert also a state, U-value and loss factor per element type. */
export function InsulationSection(props: Props) {
  const { mode, levels, onOpenEnvelope, avgUValue } = props;
  return (
    <div className="flex flex-col gap-4">
      {levels.length > 0 && <BuildingPreset {...props} />}
      {mode === 'expert' && <ElementTable {...props} />}
      {mode === 'expert' && <SynthesisedWindows {...props} />}
      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
        <span className="text-[11px] text-muted-foreground">
          Average U-value <span className="font-semibold text-foreground">{avgUValue.toFixed(2)} W/m²K</span>
        </span>
        {onOpenEnvelope && (
          <button type="button" onClick={onOpenEnvelope} className="cursor-pointer text-[11px] font-medium text-primary hover:underline">
            Edit surfaces one by one
          </button>
        )}
      </div>
    </div>
  );
}

function presentTypes(elements: Record<string, BuildingElement>): RefurbElementType[] {
  return REFURB_TYPES.filter((type) => Object.values(elements).some((el) => el.type === type));
}

function BuildingPreset({ levels, states, initial, elements, variantCode, onSetState }: Props) {
  const types = presentTypes(elements);
  const custom = types.reduce((n, type) => n + customCount(elements, type, states[type], initial, levels), 0);
  const uniform = types.every((type) => states[type] === states[types[0]]);
  const selected = uniform ? states[types[0]] : null;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel tip="TABULA's refurbishment variants for this building type and age. A choice sets every element type; surfaces set one by one keep their values.">
        Set the whole building to
      </FieldLabel>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}>
        {levels.map((level) => (
          <button
            key={level.code}
            type="button"
            aria-pressed={selected === level.number}
            onClick={() => onSetState(REFURB_TYPES, level.number)}
            className={cn(
              'cursor-pointer rounded-[6px] border px-2 py-1.5 text-[11px] font-medium leading-snug transition-colors',
              selected === level.number
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {level.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        {variantCode ? `From 3D data: TABULA ${variantCode}.` : 'TABULA variants for the building type and age.'}
        {!uniform && ' Element types differ.'}
        {custom > 0 && ` ${custom} surface${custom === 1 ? '' : 's'} set one by one keep${custom === 1 ? 's' : ''} its value.`}
      </p>
    </div>
  );
}

/** Area-weighted U-value of the type's surfaces. */
function typeUValue(surfaces: BuildingElement[]): number {
  const area = surfaces.reduce((sum, el) => sum + el.area, 0);
  return area > 0 ? surfaces.reduce((sum, el) => sum + el.uValue * el.area, 0) / area : (surfaces[0]?.uValue ?? 0);
}

/** The type's loss factor when its surfaces other than party walls share one, else null. */
function typeLossFactor(surfaces: BuildingElement[]): number | null {
  const values = new Set(surfaces.filter((el) => el.bTransmission !== 0).map((el) => el.bTransmission ?? 1));
  return values.size === 1 ? [...values][0] : null;
}

function ElementTable({ elements, levels, states, initial, onSetState, onSetTypeUValue, onSetTypeLossFactor }: Props) {
  const types = presentTypes(elements);
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">Per element type</p>
      {types.map((type) => {
        const surfaces = Object.values(elements).filter((el) => el.type === type);
        const custom = customCount(elements, type, states[type], initial, levels);
        const options = [
          ...levels.map((level) => ({ value: String(level.number), label: level.label })),
          ...(custom > 0 ? [{ value: 'custom', label: 'Custom' }] : []),
        ];
        const loss = typeLossFactor(surfaces);
        return (
          <div key={type} className="flex flex-col gap-1.5 rounded-md border border-slate-200 p-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">{TYPE_LABELS[type]}</span>
              <span className="text-[10px] text-muted-foreground">
                {surfaces.length} surface{surfaces.length === 1 ? '' : 's'}
                {custom > 0 && ` · ${custom} set one by one`}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_9rem] items-end gap-2">
              {levels.length > 0 ? (
                <SelectInput
                  label="State"
                  value={custom > 0 ? 'custom' : String(states[type])}
                  onChange={(v) => { if (v !== 'custom') onSetState([type], Number(v)); }}
                  options={options}
                />
              ) : <span />}
              <NumberInput
                label="U-value"
                value={Number(typeUValue(surfaces).toFixed(3))}
                onChange={(v) => onSetTypeUValue(type, Math.max(0, v))}
                unit="W/m²K" min={0} max={6} step={0.01}
              />
            </div>
            {LOSS_FACTOR_TYPES.includes(type) && (
              <NumberInput
                label="Loss factor"
                value={loss ?? ''}
                onChange={(v) => onSetTypeLossFactor(type, Math.min(1, Math.max(0, v)))}
                unit="0 to 1" min={0} max={1} step={0.05}
                tip="Share of the heat loss through these surfaces that counts: 1 to outdoor air, less against ground or an unheated space (BuEM b_transmission). Empty when the surfaces differ; party walls keep 0."
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A number BuEM defaults when it is left empty. */
function OptionalNumber({ label, value, onChange, unit, min, max, step, tip }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string; min: number; max: number; step: number; tip: string;
}) {
  return (
    <div>
      <NumberInput label={label} value={value ?? ''} onChange={(v) => onChange(Math.min(max, Math.max(min, v)))} unit={unit} min={min} max={max} step={step} tip={tip} />
      <p className="mt-1 text-[10px] text-muted-foreground">
        {value === null ? 'BuEM default.' : (
          <button type="button" className="cursor-pointer text-[10px] underline" onClick={() => onChange(null)}>Use default</button>
        )}
      </p>
    </div>
  );
}

function SynthesisedWindows({ elements, general, setGen }: Props) {
  if (Object.values(elements).some((el) => el.type === 'window')) return null;
  const share = general.window_to_wall_ratio;
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">Windows BuEM adds</p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        The building has no window surfaces, so BuEM glazes a share of each exposed wall.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <OptionalNumber
          label="Window share"
          value={share === null ? null : Math.round(share * 1000) / 10}
          onChange={(v) => setGen('window_to_wall_ratio', v === null ? null : Math.min(v, 99) / 100)}
          unit="%" min={0} max={99} step={1}
          tip="Share of each exposed wall's area that is glazed."
        />
        <OptionalNumber
          label="Window U"
          value={general.window_U}
          onChange={(v) => setGen('window_U', v)}
          unit="W/m²K" min={0} max={6} step={0.1}
          tip="U-value of those windows. Default: the TABULA value for the building type, else 2.8."
        />
        <OptionalNumber
          label="Window g"
          value={general.window_g_gl}
          onChange={(v) => setGen('window_g_gl', v)}
          unit="0 to 1" min={0} max={1} step={0.05}
          tip="Share of the sunlight on those windows that enters as heat. Default: the TABULA value for the building type, else 0.5."
        />
      </div>
    </div>
  );
}
