/**
 * Unstable surface of @thd-spatial-ai/building-configurator, published as
 * `@thd-spatial-ai/building-configurator/experimental`.
 *
 * The 3D building view: a full-screen replacement for the configurator dialog,
 * where a building's envelope is the thing being clicked. It is here rather
 * than in the main entry because its props and its layout are still moving.
 * Pin an exact version when consuming it.
 *
 * The host supplies the building and its geometry; nothing in this entry knows
 * about a particular area or dataset.
 */

export { Building3DView } from './app/components/workspace/Building3DView';

export {
  polygonArea,
  surfacesFromGeometryResponse,
  type SurfaceGeometry,
  type SurfacePolygon,
} from './app/lib/surfaceMesh';
