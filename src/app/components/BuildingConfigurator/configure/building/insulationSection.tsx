// The building editor's Insulation and windows group: TABULA's refurbishment
// state for the whole building in Basic, and per element type in Expert with
// its U-value and loss factor, plus the windows BuEM adds when there are none.

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FieldLabel, NumberInput, SelectInput } from '@/app/components/BuildingConfigurator/shared/ui';
import { variantName,
  REFURB_TYPES, customCount, type RefurbElementType, type RefurbStates,
} from '@/app/lib/refurbishment';
import type { IgnisVariantLevel } from '@/app/lib/ignisAdapter';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT, type FormatNumber, type Translate } from '@/app/i18n';

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
  /** Adds a surface the 3D data lacks, such as a wall against ground. */
  onAddSurface?: (type: RefurbElementType, values: Partial<BuildingElement>) => void;
}

const TYPE_LABELS: Record<RefurbElementType, (t: Translate) => string> = {
  wall: (t) => t('insulation.type.wall'),
  roof: (t) => t('insulation.type.roof'),
  floor: (t) => t('insulation.type.floor'),
  window: (t) => t('insulation.type.window'),
  door: (t) => t('insulation.type.door'),
};

/** The types whose loss factor is set as a group: those against ground or an unheated space. */
const LOSS_FACTOR_TYPES: RefurbElementType[] = ['wall', 'roof', 'floor'];

interface Props extends InsulationProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  mode: 'basic' | 'expert';
}

/** One line for the group's header. */
export function insulationSummary(t: Translate, format: FormatNumber, { levels, states, elements, initial, avgUValue }: InsulationProps): string {
  const present = REFURB_TYPES.filter((type) => Object.values(elements).some((el) => el.type === type));
  const custom = present.some((type) => customCount(elements, type, states[type], initial, levels) > 0);
  const uniform = present.every((type) => states[type] === states[present[0]]);
  const level = levels.find((l) => l.number === states[present[0]]);
  const label = level && variantName(t, level.label, level.number);
  const state = levels.length === 0 ? null : custom || !uniform || !label ? t('insulation.summary.mixed') : label;
  return [state, t('insulation.summary.averageU', { value: format(avgUValue, 2) })].filter(Boolean).join(' · ');
}

/** Building-wide preset; in Expert also a state, U-value and loss factor per element type. */
export function InsulationSection(props: Props) {
  const t = useT();
  const format = useFormatNumber();
  const { mode, levels, avgUValue } = props;
  return (
    <div className="flex flex-col gap-4">
      {levels.length > 0 && <BuildingPreset {...props} />}
      {mode === 'expert' && <ElementTable {...props} />}
      {mode === 'expert' && props.onAddSurface && <AddSurface onAdd={props.onAddSurface} />}
      {mode === 'expert' && <SynthesisedWindows {...props} />}
      <div className="border-t border-border/60 pt-2">
        <span className="text-[11px] text-muted-foreground">
          {t('insulation.averageU')} <span className="font-semibold text-foreground">{format(avgUValue, 2)} W/m²K</span>
        </span>
      </div>
    </div>
  );
}

function presentTypes(elements: Record<string, BuildingElement>): RefurbElementType[] {
  return REFURB_TYPES.filter((type) => Object.values(elements).some((el) => el.type === type));
}

function BuildingPreset({ levels, states, initial, elements, variantCode, onSetState }: Props) {
  const t = useT();
  const types = presentTypes(elements);
  const custom = types.reduce((n, type) => n + customCount(elements, type, states[type], initial, levels), 0);
  const uniform = types.every((type) => states[type] === states[types[0]]);
  const selected = uniform ? states[types[0]] : null;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel tip={t('insulation.preset.tip')}>
        {t('insulation.preset.label')}
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
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {variantName(t, level.label, level.number)}
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        {variantCode ? t('insulation.preset.fromVariant', { code: variantCode }) : t('insulation.preset.fromType')}
        {!uniform && ` ${t('insulation.preset.typesDiffer')}`}
        {custom > 0 && ` ${t('insulation.preset.customKept', { count: custom })}`}
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
  const t = useT();
  const types = presentTypes(elements);
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-foreground">{t('insulation.table.title')}</p>
      {types.map((type) => {
        const surfaces = Object.values(elements).filter((el) => el.type === type);
        const custom = customCount(elements, type, states[type], initial, levels);
        const options = [
          ...levels.map((level) => ({ value: String(level.number), label: variantName(t, level.label, level.number) })),
          ...(custom > 0 ? [{ value: 'custom', label: t('insulation.table.custom') }] : []),
        ];
        const loss = typeLossFactor(surfaces);
        return (
          <div key={type} className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{TYPE_LABELS[type](t)}</span>
              <span className="text-[10px] text-muted-foreground">
                {t('insulation.table.surfaces', { count: surfaces.length })}
                {custom > 0 && ` · ${t('insulation.table.setOneByOne', { custom })}`}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_9rem] items-end gap-2">
              {levels.length > 0 ? (
                <SelectInput
                  label={t('insulation.table.state')}
                  value={custom > 0 ? 'custom' : String(states[type])}
                  onChange={(v) => { if (v !== 'custom') onSetState([type], Number(v)); }}
                  options={options}
                />
              ) : <span />}
              <NumberInput
                label={t('insulation.uValue')}
                value={Number(typeUValue(surfaces).toFixed(3))}
                onChange={(v) => onSetTypeUValue(type, Math.max(0, v))}
                unit="W/m²K" min={0} max={6} step={0.01}
              />
            </div>
            {LOSS_FACTOR_TYPES.includes(type) && (
              <NumberInput
                label={t('insulation.lossFactor')}
                value={loss ?? ''}
                onChange={(v) => onSetTypeLossFactor(type, Math.min(1, Math.max(0, v)))}
                unit={t('insulation.unitShare')} min={0} max={1} step={0.05}
                tip={t('insulation.table.lossFactorTip')}
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
  const t = useT();
  return (
    <div>
      <NumberInput label={label} value={value ?? ''} onChange={(v) => onChange(Math.min(max, Math.max(min, v)))} unit={unit} min={min} max={max} step={step} tip={tip} />
      <p className="mt-1 text-[10px] text-muted-foreground">
        {value === null ? t('insulation.buemDefault') : (
          <button type="button" className="cursor-pointer text-[10px] underline" onClick={() => onChange(null)}>{t('insulation.useDefault')}</button>
        )}
      </p>
    </div>
  );
}

function SynthesisedWindows({ elements, general, setGen }: Props) {
  const t = useT();
  if (Object.values(elements).some((el) => el.type === 'window')) return null;
  const share = general.window_to_wall_ratio;
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-foreground">{t('insulation.windows.title')}</p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        {t('insulation.windows.note')}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <OptionalNumber
          label={t('insulation.windows.share.label')}
          value={share === null ? null : Math.round(share * 1000) / 10}
          onChange={(v) => setGen('window_to_wall_ratio', v === null ? null : Math.min(v, 99) / 100)}
          unit="%" min={0} max={99} step={1}
          tip={t('insulation.windows.share.tip')}
        />
        <OptionalNumber
          label={t('insulation.windows.u.label')}
          value={general.window_U}
          onChange={(v) => setGen('window_U', v)}
          unit="W/m²K" min={0} max={6} step={0.1}
          tip={t('insulation.windows.u.tip')}
        />
        <OptionalNumber
          label={t('insulation.windows.g.label')}
          value={general.window_g_gl}
          onChange={(v) => setGen('window_g_gl', v)}
          unit={t('insulation.unitShare')} min={0} max={1} step={0.05}
          tip={t('insulation.windows.g.tip')}
        />
      </div>
    </div>
  );
}

function addableTypes(t: Translate) {
  return [
    { value: 'wall', label: t('insulation.add.type.wall') },
    { value: 'floor', label: t('insulation.add.type.floor') },
    { value: 'roof', label: t('insulation.add.type.roof') },
  ];
}

const ADD_BUTTON_LABELS: Record<string, (t: Translate) => string> = {
  wall: (t) => t('insulation.add.button.wall'),
  floor: (t) => t('insulation.add.button.floor'),
  roof: (t) => t('insulation.add.button.roof'),
};

/** A surface the 3D data lacks, for example a wall against ground or a floor over an open passage. */
function AddSurface({ onAdd }: { onAdd: NonNullable<InsulationProps['onAddSurface']> }) {
  const t = useT();
  const [type, setType] = useState<RefurbElementType>('wall');
  const [label, setLabel] = useState('');
  const [area, setArea] = useState(10);
  const [uValue, setUValue] = useState(0.5);
  const [loss, setLoss] = useState(1);
  const add = () => {
    onAdd(type, { area, uValue, bTransmission: loss, ...(label.trim() ? { label: label.trim() } : {}) });
    setLabel('');
  };
  return (
    <details className="group rounded-md border border-border">
      <summary className="cursor-pointer px-2.5 py-2 text-xs font-semibold text-foreground">{t('insulation.add.title')}</summary>
      <div className="flex flex-col gap-2 border-t border-border p-2.5">
        <p className="text-[10px] leading-snug text-muted-foreground">
          {t('insulation.add.note')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <SelectInput label={t('insulation.add.typeLabel')} value={type} onChange={(v) => setType(v as RefurbElementType)} options={addableTypes(t)} />
          <div>
            <FieldLabel>{t('insulation.add.name')}</FieldLabel>
            <div className="cfg-input-wrap">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('insulation.add.namePlaceholder')}
                className="cfg-number"
              />
            </div>
          </div>
          <NumberInput label={t('insulation.add.area')} value={area} onChange={(v) => setArea(Math.max(0, v))} unit="m²" min={0} step={1} />
          <NumberInput label={t('insulation.uValue')} value={uValue} onChange={(v) => setUValue(Math.max(0, v))} unit="W/m²K" min={0} max={6} step={0.01} />
          <NumberInput label={t('insulation.lossFactor')} value={loss} onChange={(v) => setLoss(Math.min(1, Math.max(0, v)))} unit={t('insulation.unitShare')} min={0} max={1} step={0.05} />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={area <= 0}
          className="cursor-pointer self-start rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ADD_BUTTON_LABELS[type](t)}
        </button>
      </div>
    </details>
  );
}
