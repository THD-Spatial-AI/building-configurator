// The building editor's Insulation and windows group: TABULA's refurbishment
// state for the whole building in Basic, and per element type in Expert with
// its U-value and loss factor, plus the windows BuEM adds when there are none.

import { useEffect, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Info } from '@/app/components/icons';
import { FieldLabel, NumberInput, SelectInput } from '@/app/components/BuildingConfigurator/shared/ui';
import { variantName,
  REFURB_TYPES, customCount, type RefurbElementType, type RefurbStates,
} from '@/app/lib/refurbishment';
import type { IgnisVariantLevel } from '@/app/lib/ignisAdapter';
import { HWB_CLASSES, hwbClass } from '@/app/lib/energyClass';
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
  /** Each level's indicative energy class; absent when the host offers no preview run. */
  classes?: {
    /** Space heating per m² by level number, null where a run failed; null until compared. */
    perM2: Record<number, number | null> | null;
    comparing: boolean;
    onCompare: () => void;
  };
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

/** One line for the group's header; the average U-value in Expert only. */
export function insulationSummary(t: Translate, format: FormatNumber, { levels, states, elements, initial, avgUValue }: InsulationProps, mode: 'basic' | 'expert'): string {
  const present = REFURB_TYPES.filter((type) => Object.values(elements).some((el) => el.type === type));
  const custom = present.some((type) => customCount(elements, type, states[type], initial, levels) > 0);
  const uniform = present.every((type) => states[type] === states[present[0]]);
  const level = levels.find((l) => l.number === states[present[0]]);
  const label = level && variantName(t, level.label, level.number);
  const state = levels.length === 0 ? null : custom || !uniform || !label ? t('insulation.summary.mixed') : label;
  const averageU = mode === 'expert' ? t('insulation.summary.averageU', { value: format(avgUValue, 2) }) : null;
  return [state, averageU].filter(Boolean).join(' · ');
}

/** Building-wide preset; in Expert also a state, U-value and loss factor per element type. The average U-value is in the header (insulationSummary). */
export function InsulationSection(props: Props) {
  const { mode, levels } = props;
  return (
    <div className="flex flex-col gap-4">
      {levels.length > 0 && <BuildingPreset {...props} />}
      {mode === 'expert' && <ElementTable {...props} />}
      {mode === 'expert' && <SynthesisedWindows {...props} />}
    </div>
  );
}

/** Edits this long apart start one comparison, so a dragged slider is not three BuEM runs a step. */
const COMPARE_DELAY_MS = 1500;
const TABULA_WEBTOOL_URL = 'https://webtool.building-typology.eu/';

/**
 * The levels' classes, worked out on their own once the building stops
 * changing, then the class scale, with what the classes are behind a
 * closed toggle. A failed run
 * offers to try again rather than retrying by itself.
 */
function LevelClasses({ classes }: { classes: NonNullable<InsulationProps['classes']> }) {
  const t = useT();
  const failed = classes.perM2 !== null && Object.values(classes.perM2).every((value) => value === null);
  const compareRef = useRef(classes.onCompare);
  compareRef.current = classes.onCompare;
  const pending = classes.perM2 === null && !classes.comparing;
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => compareRef.current(), COMPARE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  if (!classes.perM2 || failed) {
    return failed && !classes.comparing ? (
      <button
        type="button"
        onClick={classes.onCompare}
        className="h-8 cursor-pointer self-start rounded-md border border-border bg-card px-3 text-[11px] font-semibold text-foreground hover:bg-muted"
      >
        {t('insulation.classes.retry')}
        <span className="ml-2 font-normal text-destructive">{t('insulation.classes.failed')}</span>
      </button>
    ) : (
      <span className="text-[11px] text-muted-foreground">{t('insulation.classes.comparing')}</span>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-1.5 overflow-hidden rounded-full" aria-hidden>
        {[...HWB_CLASSES].reverse().map((c) => <div key={c.label} className={cn('flex-1', c.badge)} />)}
      </div>
      <details className="group">
        <summary className="flex w-fit cursor-pointer select-none list-none items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <Info className="size-3.5" aria-hidden />
          {t('insulation.classes.about')}
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-1 flex flex-col gap-1.5 rounded-md bg-muted px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
          <p className="m-0">{t('insulation.classes.note')}</p>
          <p className="m-0">
            {t('insulation.classes.source')}{' '}
            <a href={TABULA_WEBTOOL_URL} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
              {t('insulation.classes.sourceLink')}
            </a>
          </p>
        </div>
      </details>
    </div>
  );
}

function presentTypes(elements: Record<string, BuildingElement>): RefurbElementType[] {
  return REFURB_TYPES.filter((type) => Object.values(elements).some((el) => el.type === type));
}

function BuildingPreset({ levels, states, initial, elements, variantCode, onSetState, classes, mode }: Props) {
  const t = useT();
  const format = useFormatNumber();
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
        {levels.map((level) => {
          const perM2 = classes?.perM2?.[level.number];
          const energyClass = typeof perM2 === 'number' ? hwbClass(perM2) : null;
          return (
            <button
              key={level.code}
              type="button"
              aria-pressed={selected === level.number}
              onClick={() => onSetState(REFURB_TYPES, level.number)}
              style={energyClass ? { '--class': energyClass.color, '--class-tint': `${energyClass.color}26` } as CSSProperties : undefined}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-[6px] border px-2 py-1.5 text-left text-[11px] font-medium leading-snug transition-colors',
                // Known classes: the box takes the class colour when selected, and
                // as a preview on hover; unselected only its badge shows it.
                energyClass
                  ? selected === level.number
                    ? 'border-2 border-[var(--class)] bg-[var(--class-tint)] text-foreground'
                    : 'border-border bg-card text-foreground hover:border-[var(--class)] hover:bg-[var(--class-tint)]'
                  : selected === level.number
                    ? 'border-2 border-[#475B7A] bg-[#E6EAF2] text-[#33415C] dark:border-[#C3CDDD] dark:bg-[#475B7A]/35 dark:text-[#C3CDDD]'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {energyClass && (
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md text-[12px] font-extrabold', energyClass.badge)}>
                  {energyClass.label}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span>{variantName(t, level.label, level.number)}</span>
                {typeof perM2 === 'number' && (
                  <span className="text-[10px] font-normal">{t('insulation.classes.perM2', { value: format(perM2, 0) })}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {classes && <LevelClasses classes={classes} />}
      {(mode === 'expert' || !uniform || custom > 0) && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          {mode === 'expert' && (variantCode ? t('insulation.preset.fromVariant', { code: variantCode }) : t('insulation.preset.fromType'))}
          {!uniform && ` ${t('insulation.preset.typesDiffer')}`}
          {custom > 0 && ` ${t('insulation.preset.customKept', { count: custom })}`}
        </p>
      )}
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

/**
 * A number BuEM fills in when it is left empty. The value it uses shows greyed
 * in the empty field, with where it comes from beneath.
 */
function OptionalNumber({ label, value, onChange, unit, min, max, step, tip, defaultValue, defaultNote }: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string; min: number; max: number; step: number; tip: string;
  defaultValue: number;
  /** Where the default comes from, with the value, e.g. "BuEM default: 20 %". */
  defaultNote: string;
}) {
  const t = useT();
  const format = useFormatNumber();
  return (
    <div>
      <NumberInput
        label={label} value={value ?? ''} placeholder={format(defaultValue, step < 1 ? 2 : 0)}
        onChange={(v) => onChange(Math.min(max, Math.max(min, v)))} unit={unit} min={min} max={max} step={step} tip={tip}
      />
      <p className="mt-1 text-[10px] text-muted-foreground">
        {value === null ? defaultNote : (
          <button type="button" className="cursor-pointer text-[10px] underline" onClick={() => onChange(null)}>{t('insulation.useDefault')}</button>
        )}
      </p>
    </div>
  );
}

// BuEM's own defaults for windows it synthesises (building_registry and
// live_synthesis in BuEM); U and g come from the TABULA archetype first.
const BUEM_WINDOW_SHARE = 0.2;
const BUEM_WINDOW_U = 2.8;
const BUEM_WINDOW_G = 0.5;

function SynthesisedWindows({ elements, general, setGen, levels, states }: Props) {
  const t = useT();
  const format = useFormatNumber();
  if (Object.values(elements).some((el) => el.type === 'window')) return null;
  const share = general.window_to_wall_ratio;
  const tabulaU = levels.find((level) => level.number === states.wall)?.data.U_Window_1;
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
          defaultValue={BUEM_WINDOW_SHARE * 100}
          defaultNote={t('insulation.default.buem', { value: `${format(BUEM_WINDOW_SHARE * 100, 0)} %` })}
        />
        <OptionalNumber
          label={t('insulation.windows.u.label')}
          value={general.window_U}
          onChange={(v) => setGen('window_U', v)}
          unit="W/m²K" min={0} max={6} step={0.1}
          tip={t('insulation.windows.u.tip')}
          defaultValue={tabulaU ?? BUEM_WINDOW_U}
          defaultNote={t(tabulaU === undefined ? 'insulation.default.buem' : 'insulation.default.tabula', { value: `${format(tabulaU ?? BUEM_WINDOW_U, 2)} W/m²K` })}
        />
        <OptionalNumber
          label={t('insulation.windows.g.label')}
          value={general.window_g_gl}
          onChange={(v) => setGen('window_g_gl', v)}
          unit={t('insulation.unitShare')} min={0} max={1} step={0.05}
          tip={t('insulation.windows.g.tip')}
          defaultValue={BUEM_WINDOW_G}
          defaultNote={t('insulation.default.tabulaElse', { value: format(BUEM_WINDOW_G, 2) })}
        />
      </div>
    </div>
  );
}

