/**
 * Real OpenLayers map for the EnerPlanET backend integration test — plots
 * PyLovo building footprints for the fixed Loenen, Netherlands smoke area
 * (see BuEM/weather... no: see enerplanet backend's fixtures/docs/test-data.md
 * for why this exact bbox: it is the extent of the four PyLovo grids the
 * local fixtures ship, nothing resolves outside it).
 *
 * Deliberately fixed to one small bbox/zoom rather than a free-panning
 * world map: keeps OSM basemap tile requests minimal (a handful of tiles
 * once, not a scriptable stream), in line with OSM's tile usage policy, and
 * matches the data's own extent — nothing renders outside this box anyway.
 */

import { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';
import { boundingExtent } from 'ol/extent';
import { fromLonLat } from 'ol/proj';

export const LOENEN_BBOX = { xmin: 6.0162, ymin: 52.0988, xmax: 6.0384, ymax: 52.113 };

interface LoenenLiveMapProps {
  buildings: { type: 'FeatureCollection'; features: unknown[] };
  /** osm_ids with resolved City2TABULA data — styled distinctly from unresolved ones. */
  resolvedIds: Set<string>;
  /** osm_ids with at least one surface a simulation would reject (e.g. zero area) — takes priority over resolvedIds' styling. */
  problematicIds: Set<string>;
  onBuildingClick: (osmId: string) => void;
}

const RESOLVED_STYLE = new Style({
  fill: new Fill({ color: 'rgba(47, 93, 138, 0.55)' }),
  stroke: new Stroke({ color: '#2f5d8a', width: 1.5 }),
});
const UNRESOLVED_STYLE = new Style({
  fill: new Fill({ color: 'rgba(150, 150, 150, 0.35)' }),
  stroke: new Stroke({ color: '#888', width: 1 }),
});
const PROBLEMATIC_STYLE = new Style({
  fill: new Fill({ color: 'rgba(220, 38, 38, 0.55)' }),
  stroke: new Stroke({ color: '#dc2626', width: 1.5 }),
});

function styleForFeature(feature: FeatureLike, resolvedIds: Set<string>, problematicIds: Set<string>): Style {
  const osmId = String(feature.get('osm_id') ?? '');
  if (problematicIds.has(osmId)) return PROBLEMATIC_STYLE;
  return resolvedIds.has(osmId) ? RESOLVED_STYLE : UNRESOLVED_STYLE;
}

export function LoenenLiveMap({ buildings, resolvedIds, problematicIds, onBuildingClick }: LoenenLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  // The style callback below is captured once at map creation; refs keep it
  // reading the current sets instead of whatever they were at creation.
  const resolvedIdsRef = useRef(resolvedIds);
  resolvedIdsRef.current = resolvedIds;
  const problematicIdsRef = useRef(problematicIds);
  problematicIdsRef.current = problematicIds;

  // Map + basemap + view: created once, fixed to the Loenen extent.
  useEffect(() => {
    if (!containerRef.current) return;

    const source = new VectorSource();
    sourceRef.current = source;

    const vectorLayer = new VectorLayer({
      source,
      style: (feature) => styleForFeature(feature, resolvedIdsRef.current, problematicIdsRef.current),
    });

    const extent = boundingExtent([
      fromLonLat([LOENEN_BBOX.xmin, LOENEN_BBOX.ymin]),
      fromLonLat([LOENEN_BBOX.xmax, LOENEN_BBOX.ymax]),
    ]);

    const map = new Map({
      target: containerRef.current,
      layers: [new TileLayer({ source: new OSM() }), vectorLayer],
      view: new View({ minZoom: 14, maxZoom: 19 }),
    });
    map.getView().fit(extent, { size: map.getSize(), padding: [24, 24, 24, 24] });

    map.on('click', (evt) => {
      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        const osmId = feature.get('osm_id');
        if (osmId) onBuildingClick(String(osmId));
        return true;
      });
    });

    mapRef.current = map;
    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; data updates via the effect below
  }, []);

  // Building data: (re)loaded into the existing map's vector source.
  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    source.clear();
    // 4326 is true of PyLovo's generate-grid output only. City2TABULA
    // geometry (e.g. TentaCron's c2t-geometry) is EPSG:28992 and uncompliantly
    // carries no reprojection — wiring it in under this same dataProjection
    // silently places every building near 0N 0E. No proj4 is registered here.
    const features = new GeoJSON().readFeatures(buildings, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    source.addFeatures(features);
  }, [buildings]);

  // Resolved/unresolved/problematic styling: re-applied on the existing features when either set changes.
  useEffect(() => {
    sourceRef.current?.changed();
  }, [resolvedIds, problematicIds]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
