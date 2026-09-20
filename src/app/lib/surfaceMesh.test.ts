import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildSurfaceGroup, computeOrigin, isEnvelopeDetached, surfacesFromGeometryResponse } from './surfaceMesh';
import type { BuildingGeometry } from './enerplanetApi';
import surfaceFixture from '../../assets/data/loenen_surfaces_fixture.json';
import liveFixture from '../../assets/data/loenen_live_fixture.json';

const GEOMETRY = surfaceFixture as unknown as Record<string, BuildingGeometry>;

/** Envelope element ids per City2TABULA object_id, from the enrich capture. */
function envelopeIdsByObjectId(): Record<string, Set<string>> {
  const entries = Object.values(liveFixture.enrich.data) as Array<{
    object_id: string;
    buem: { building: { envelope: { elements: Array<{ id: string }> } } };
  }>;
  return Object.fromEntries(
    entries.map((entry) => [entry.object_id, new Set(entry.buem.building.envelope.elements.map((e) => e.id))]),
  );
}

describe('surfacesFromGeometryResponse', () => {
  it('skips a surface row that carries no geometry', () => {
    const response: BuildingGeometry[] = [{
      object_id: 'b1',
      surfaces: [
        { id: 's1', type: 'WallSurface' },
        { id: 's2', type: 'RoofSurface', geojson: { type: 'Polygon', coordinates: [[[0, 0, 0], [1, 0, 0], [1, 1, 1], [0, 0, 0]]] } },
      ],
    }];
    expect(surfacesFromGeometryResponse(response).map((s) => s.id)).toEqual(['s2']);
  });
});

describe('geometry and enrich responses', () => {
  // The whole click-to-configure path assumes a rendered surface id IS the
  // BuildingState element id. City2TABULA serves both from the same row, so a
  // mismatch here means that contract broke upstream, not that the UI drifted.
  it('agree on every surface id, for every captured building', () => {
    const envelopeIds = envelopeIdsByObjectId();
    expect(Object.keys(GEOMETRY).length).toBe(6);

    for (const [objectId, building] of Object.entries(GEOMETRY)) {
      const rendered = surfacesFromGeometryResponse([building]).map((s) => s.id);
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.filter((id) => !envelopeIds[objectId].has(id))).toEqual([]);
    }
  });
});

describe('isEnvelopeDetached', () => {
  const building = GEOMETRY['NL.IMBAG.Pand.0200100000022498-0'];
  const surfaces = surfacesFromGeometryResponse([building]);
  const realIds = envelopeIdsByObjectId()['NL.IMBAG.Pand.0200100000022498-0'];

  it('is false for a matching geometry and envelope', () => {
    expect(isEnvelopeDetached(surfaces, realIds)).toBe(false);
  });

  it('is true when every id was regenerated, as a rebuild does', () => {
    expect(isEnvelopeDetached(surfaces, new Set(['some-other-uuid']))).toBe(true);
  });

  it('is false when only some surfaces are unmatched', () => {
    const [first] = surfaces;
    expect(isEnvelopeDetached(surfaces, new Set([first.id]))).toBe(false);
  });

  it('is false with no surfaces, which is an empty response not a mismatch', () => {
    expect(isEnvelopeDetached([], new Set())).toBe(false);
  });
});

describe('buildSurfaceGroup', () => {
  const building = GEOMETRY['NL.IMBAG.Pand.0200100000022498-0'];
  const surfaces = surfacesFromGeometryResponse([building]);
  const origin = computeOrigin(surfaces);

  it('triangulates every real surface, whatever its orientation', () => {
    for (const surface of surfaces) {
      const group = buildSurfaceGroup(surface, origin);
      const mesh = group.children.find((c) => c.name === 'surface-fill') as THREE.Mesh;
      const index = mesh.geometry.getIndex();
      const positions = mesh.geometry.getAttribute('position').array;

      expect(index, `${surface.id} (${surface.type}) produced no triangles`).not.toBeNull();
      expect(index!.count % 3).toBe(0);
      expect(index!.count).toBeGreaterThan(0);
      expect([...positions].every(Number.isFinite)).toBe(true);
    }
  });

  it('places the building near the scene origin, not at CRS magnitudes', () => {
    const group = buildSurfaceGroup(surfaces[0], origin);
    const mesh = group.children.find((c) => c.name === 'surface-fill') as THREE.Mesh;
    mesh.geometry.computeBoundingSphere();
    expect(mesh.geometry.boundingSphere!.center.length()).toBeLessThan(100);
  });
});
