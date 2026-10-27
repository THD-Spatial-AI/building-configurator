import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TOPICS } from '@/app/config/topics';
import { StepPanel, type Step } from './StepPanel';
import { energyGradeStatus, storeysStatus } from '../configure/building/BuildingEditor';
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

  it('marks storeys incomplete while an included storey of a multi-family house has no dwellings', () => {
    const general = { buildingType: 'Multi-family House', storeysModelled: [1, 2], storeyDwellings: { 1: 2 } };
    expect(missingDwellings([1, 2], { 1: 2 })).toEqual([2]);
    expect(storeysStatus(general)).toBe('incomplete');
    expect(storeysStatus({ ...general, storeyDwellings: { 1: 2, 2: 1 } })).toBe('complete');
    expect(storeysStatus({ ...general, buildingType: 'Single-family House' })).toBe('complete');
  });
});
