import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TOPICS } from '@/app/config/topics';
import { StepPanel, StepSummary, type Step } from './StepPanel';
import { comfortStatus, comfortSummary, energyGradeStatus, occupancySummary, resultsSummary, storeysStatus } from '../configure/building/BuildingEditor';
import { formatNumber, translate } from '@/app/i18n';
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

  it('draws an incomplete step as an outlined node with its number', () => {
    const html = renderToStaticMarkup(
      <StepPanel steps={[{ ...steps[0], status: 'incomplete' }, steps[2]]} active="comfort" onActive={() => {}} />,
    );
    expect(html).toContain('aria-label="1. Building data, not complete"');
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*border-step-line bg-background[^"]*">1<\/span><span[^>]*>1. Building data<\/span>/);
  });

  it('tints a node in its status, and fills the open one in primary', () => {
    const node = (html: string, label: string) => html.match(new RegExp(`aria-label="${label}[^"]*"[^>]*><span aria-hidden="true" class="([^"]*)"`))?.[1] ?? '';
    const html = render('grade');
    expect(node(html, '3. Heating')).toContain('bg-primary-subtle');
    expect(node(html, '1. Building data')).toContain('bg-warning-subtle');
    expect(node(html, '2. Energy grade')).toContain('bg-primary text-primary-foreground');
    expect(node(render('comfort'), '2. Energy grade')).toContain('bg-destructive');
    expect(html).not.toContain('ring-offset');
  });

  it('draws every link in the one neutral colour', () => {
    const links = render('comfort').match(/<span aria-hidden="true" class="absolute [^"]*"/g) ?? [];
    expect(links).toHaveLength(4);
    links.forEach((link) => expect(link).toContain('bg-step-line'));
  });

  it('counts the steps not complete in an amber badge that opens the first of them', () => {
    const html = render('comfort');
    expect(html).toMatch(/<button type="button" class="[^"]*bg-warning-subtle[^"]*">.*2 steps need attention<\/button>/);
    expect(html).not.toContain('Ready for simulation');
  });

  it('puts the badge centred below the step bar', () => {
    const html = render('comfort');
    expect(html).toMatch(/<\/ol><div class="[^"]*justify-center[^"]*"><button[^>]*>.*2 steps need attention<\/button><\/div><\/nav>/);
  });

  it('says one step in the singular', () => {
    const html = renderToStaticMarkup(<StepPanel steps={[steps[0], steps[2]]} active="comfort" onActive={() => {}} />);
    expect(html).toContain('1 step needs attention');
  });

  it('shows Ready for simulation once every step is complete', () => {
    const done = steps.map((step) => ({ ...step, status: 'complete' as const }));
    const html = renderToStaticMarkup(<StepPanel steps={done} active="data" onActive={() => {}} />);
    expect(html).toMatch(/<span role="status" class="[^"]*bg-success-subtle[^"]*">.*Ready for simulation<\/span>/);
    expect(html).not.toContain('need attention');
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

  it('marks heating and comfort for attention while the cooling setpoint is not above the heating one', () => {
    expect(comfortStatus({ comfortT_lb: 20, comfortT_ub: 26 })).toBe('complete');
    expect(comfortStatus({ comfortT_lb: 18, comfortT_ub: 16.5 })).toBe('attention');
    expect(comfortStatus({ comfortT_lb: 18, comfortT_ub: 18 })).toBe('attention');
  });

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
  const format: Parameters<typeof occupancySummary>[1] = (value, digits) => formatNumber('en', value, digits);

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
    const general = { buildingType: 'Single-family House', storeys: 3, storeysModelled: [1, 2], roomHeight: 2.75, residential_units: 1, num_persons: null };
    expect(occupancySummary(t, format, general)).toEqual([
      { label: 'Storeys', value: '2 of 3 modelled' },
      { label: 'Room height', value: '2.8 m' },
      { label: 'Dwellings', value: '1' },
      { label: 'Occupants per dwelling', value: 'Default' },
    ]);
    expect(comfortSummary(t, { buildingType: 'Single-family House', comfortT_lb: 18, include_dhw: true, setback_profile: 'none' })).toEqual([
      { label: 'Heating setpoint', value: '18 °C' },
      { label: 'Hot water', value: 'Included' },
    ]);
  });

  it('sums up the storeys with every storey modelled, and the attic where there is one', () => {
    const general = { buildingType: 'Office', storeys: 4, storeysModelled: null, roomHeight: 3, capacity: null };
    expect(occupancySummary(t, format, general, false)).toEqual([
      { label: 'Storeys', value: '4' },
      { label: 'Room height', value: '3.0 m' },
      { label: 'Attic', value: 'Not in the model' },
      { label: 'Occupants', value: 'Default' },
    ]);
    expect(occupancySummary(t, format, general).map((fact) => fact.label)).not.toContain('Attic');
  });

  it('lists the cooling setpoint with heating and comfort in Advanced, where its field is', () => {
    const general = { buildingType: 'Single-family House', comfortT_lb: 18, comfortT_ub: 26, include_dhw: true, setback_profile: 'none' };
    expect(comfortSummary(t, general, true).slice(0, 2)).toEqual([
      { label: 'Heating setpoint', value: '18 °C' },
      { label: 'Cooling setpoint', value: '26 °C' },
    ]);
    expect(comfortSummary(t, general).map((fact) => fact.label)).not.toContain('Cooling setpoint');
  });

  it('sums up the last step as one row per result and per appliance category, under headings', () => {
    const outputs = { heating: 'series', cooling: 'none', electricity: 'series', hot_water: 'summary', kitchen: 'none' };
    const equipment = {
      hob: true, oven: false,
      fridge_freezer: false, refrigerator: false, chest_freezer: false, upright_freezer: false,
      tv_1: true, tv_2: true, tv_3: false, printer: true,
    };
    const general = { buildingType: 'Single-family House', outputs, equipment, use_milp: false };
    const results = 'Results to compute';
    const appliances = 'Appliances';
    expect(resultsSummary(t, general)).toEqual([
      { section: results, label: 'Space heating', value: 'Hourly' },
      { section: results, label: 'Space cooling', value: 'Off' },
      { section: results, label: 'Electricity', value: 'Hourly' },
      { section: results, label: 'Hot water', value: 'Annual' },
      { section: results, label: 'Cooking gas', value: 'Off' },
      { section: appliances, label: 'Cooking', value: '1 installed, 5 at default' },
      { section: appliances, label: 'Cold', value: 'None installed' },
      { section: appliances, label: 'Laundry and cleaning', value: '7 at default' },
      { section: appliances, label: 'Electronics', value: '3 installed, 9 at default' },
      { section: appliances, label: 'Other', value: '6 at default' },
      { section: 'Calculation Method', label: 'Solver', value: 'Sparse' },
    ]);
  });

  it('leaves hot water, cooking gas and appliances out of a service building\'s last step', () => {
    const outputs = { heating: 'series', cooling: 'series', electricity: 'summary', hot_water: 'none', kitchen: 'none' };
    expect(resultsSummary(t, { buildingType: 'School', outputs, equipment: {}, use_milp: true }).map((fact) => fact.label))
      .toEqual(['Space heating', 'Space cooling', 'Electricity', 'Solver']);
  });

  it('draws a heading row above each new section of a summary', () => {
    const html = renderToStaticMarkup(
      <StepSummary step={{ ...steps[2], summary: [
        { section: 'Results', label: 'Space heating', value: 'Hourly' },
        { section: 'Results', label: 'Electricity', value: 'Annual' },
        { section: 'Appliances', label: 'Cooking', value: '7 at default' },
      ] }} number={5} onEdit={() => {}} />,
    );
    expect(html.match(/<th colspan="2"[^>]*>Results<\/th>/gi)).toHaveLength(1);
    expect(html.match(/<th colspan="2"[^>]*>Appliances<\/th>/gi)).toHaveLength(1);
  });
});

describe('a step with a summary', () => {
  const withSummary: Step[] = steps.map((step) => ({ ...step, summary: [{ label: 'x', value: 'y' }] }));

  it('opens on its overview card, whether or not it was visited before', () => {
    const html = renderToStaticMarkup(<StepPanel steps={withSummary} active="grade" onActive={() => {}} />);
    expect(html).toContain('aria-label="Edit Energy grade"');
    expect(html).not.toContain('grade body');
  });

  it('offers Done while its fields are open, not while its overview card shows', () => {
    expect(renderToStaticMarkup(<StepPanel steps={withSummary} active="grade" onActive={() => {}} openFields="grade" />)).toContain('>Done</button>');
    expect(renderToStaticMarkup(<StepPanel steps={withSummary} active="grade" onActive={() => {}} />)).not.toContain('>Done</button>');
  });

  it('opens with its fields when asked for from outside the panel', () => {
    expect(renderToStaticMarkup(<StepPanel steps={withSummary} active="comfort" onActive={() => {}} openFields="comfort" />)).toContain('comfort body');
  });
});

describe('a step without a summary', () => {
  it('shows its fields and no Done', () => {
    const html = renderToStaticMarkup(<StepPanel steps={steps} active="grade" onActive={() => {}} />);
    expect(html).toContain('grade body');
    expect(html).not.toContain('>Done</button>');
  });
});
