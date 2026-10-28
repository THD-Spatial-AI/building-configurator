import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TOPICS } from '@/app/config/topics';
import { StepPanel, StepSummary, type Step } from './StepPanel';
import { comfortSummary, energyGradeStatus, occupancySummary, storeysStatus } from '../configure/building/BuildingEditor';
import { translate } from '@/app/i18n';
import type { InsulationProps } from '../configure/building/insulationSection';
import { missingDwellings } from '@/app/lib/storeys';

const steps: Step[] = [
  { key: 'data', label: 'Building data', topic: TOPICS.building, status: 'attention', content: <p>data body</p> },
  { key: 'grade', label: 'Energy grade', topic: TOPICS.building, status: 'error', content: <p>grade body</p> },
  { key: 'comfort', label: 'Heating and comfort', topic: TOPICS.heat, status: 'complete', content: <p>comfort body</p> },
];
const render = (active: string) => renderToStaticMarkup(<StepPanel steps={steps} active={active} onActive={() => {}} />);

describe('StepPanel', () => {
  it('names every step with its status and shows only the open one', () => {
    const html = render('grade');
    expect(html).toContain('aria-label="1. Building data, needs attention"');
    expect(html).toContain('aria-label="2. Energy grade, has an error"');
    expect(html).toContain('aria-label="3. Heating and comfort, complete"');
    expect(html).toMatch(/aria-current="step"[^>]*aria-label="2. Energy grade/);
    expect(html).toContain('grade body');
    expect(html).not.toContain('data body');
  });

  it('draws an incomplete step as an open node without a mark, the number in its label', () => {
    const html = renderToStaticMarkup(
      <StepPanel steps={[{ ...steps[0], status: 'incomplete' }, steps[2]]} active="data" onActive={() => {}} />,
    );
    expect(html).toContain('aria-label="1. Building data, not complete"');
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*bg-background[^"]*"><\/span><span[^>]*>1. Building data<\/span>/);
  });

  it('fills a node in its status whether its step is open or not, and rings the open one', () => {
    const node = (html: string, label: string) => html.match(new RegExp(`aria-label="${label}[^"]*"[^>]*><span aria-hidden="true" class="([^"]*)"`))?.[1] ?? '';
    const open = render('comfort');
    expect(node(open, '3. Heating')).toContain('bg-emerald-600');
    expect(node(open, '3. Heating')).toContain('ring-offset-2');
    expect(node(render('grade'), '3. Heating')).toContain('bg-emerald-600');
    expect(node(render('grade'), '3. Heating')).not.toContain('ring-offset-2');
  });

  it('offers the steps either side of the open one', () => {
    expect(render('grade')).toContain('Back: Building data');
    expect(render('grade')).toContain('Next: Heating and comfort');
    expect(render('data')).not.toContain('Back:');
    expect(render('comfort')).not.toContain('Next:');
  });
});

describe('step status', () => {
  const insulation = { levels: [{ number: 1 }], classes: { perM2: { 1: 33 }, comparing: false, onCompare: () => {} } } as unknown as InsulationProps;

  it('marks the energy grade an error once every grade failed, and for attention without levels', () => {
    expect(energyGradeStatus(insulation)).toBe('complete');
    expect(energyGradeStatus({ ...insulation, classes: { ...insulation.classes!, perM2: { 1: null } } })).toBe('error');
    expect(energyGradeStatus({ ...insulation, levels: [], classes: undefined })).toBe('attention');
  });

  it('asks attention for grades a school takes from a residential type', () => {
    expect(energyGradeStatus(insulation, 'School')).toBe('attention');
    expect(energyGradeStatus(insulation, 'Single-family House')).toBe('complete');
  });

  it('marks storeys incomplete while an included storey of a multi-family house has no dwellings', () => {
    const general = { buildingType: 'Multi-family House', storeysModelled: [1, 2], storeyDwellings: { 1: 2 } };
    expect(missingDwellings([1, 2], { 1: 2 })).toEqual([2]);
    expect(storeysStatus(general)).toBe('incomplete');
    expect(storeysStatus({ ...general, storeyDwellings: { 1: 2, 2: 1 } })).toBe('complete');
    expect(storeysStatus({ ...general, buildingType: 'Single-family House' })).toBe('complete');
  });
});

describe('a step worked through', () => {
  const t: Parameters<typeof occupancySummary>[0] = (key, values) => translate('en', key, values);

  it('shows as a card of its values with Edit', () => {
    const html = renderToStaticMarkup(
      <StepSummary step={{ ...steps[2], summary: [{ label: 'Heating setpoint', value: '18 °C' }] }} number={3} onEdit={() => {}} />,
    );
    expect(html).toContain('3. Heating and comfort');
    expect(html).toMatch(/<th scope="row"[^>]*>Heating setpoint<\/th><td[^>]*>18 °C<\/td>/);
    expect(html).toContain('aria-label="Edit Heating and comfort"');
  });

  it('shows a status in place of a value in grey, a value in bold', () => {
    const html = renderToStaticMarkup(
      <StepSummary step={{ ...steps[1], summary: [{ label: 'Energy grade', value: 'Being worked out', muted: true }, { label: 'State', value: 'Existing state' }] }} number={2} onEdit={() => {}} />,
    );
    expect(html).toMatch(/<td class="[^"]*text-muted-foreground">Being worked out<\/td>/);
    expect(html).toMatch(/<td class="[^"]*font-semibold[^"]*">Existing state<\/td>/);
  });

  it('sums up occupancy and comfort in their own labels, defaults named as such', () => {
    const general = { buildingType: 'Single-family House', storeys: 3, storeysModelled: [1, 2], residential_units: 1, num_persons: null };
    expect(occupancySummary(t, general)).toEqual([
      { label: 'Storeys', value: '2 of 3 modelled' },
      { label: 'Dwellings', value: '1' },
      { label: 'Occupants per dwelling', value: 'Default' },
    ]);
    expect(comfortSummary(t, { buildingType: 'Single-family House', comfortT_lb: 18, include_dhw: true, setback_profile: 'none' })).toEqual([
      { label: 'Heating setpoint', value: '18 °C' },
      { label: 'Hot water', value: 'Included' },
    ]);
  });
});

describe('a step asked for from outside the panel', () => {
  it('opens with its fields, not its summary, even when it starts summarised', () => {
    const summarised: Step[] = steps.map((step) => ({ ...step, summary: [{ label: 'x', value: 'y' }], startSummarised: true }));
    expect(renderToStaticMarkup(<StepPanel steps={summarised} active="comfort" onActive={() => {}} />)).not.toContain('comfort body');
    expect(renderToStaticMarkup(<StepPanel steps={summarised} active="comfort" onActive={() => {}} openFields="comfort" />)).toContain('comfort body');
  });
});
