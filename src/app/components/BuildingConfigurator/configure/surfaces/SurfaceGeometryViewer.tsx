// Single-building 3D surface viewer. Renders in free space, no basemap: the
// envelope's surfaces as pickable meshes for one building at a time. Vanilla
// Three.js, matching cityviz's approach in the same workspace rather than
// adding a React renderer on top.
//
// Selection is controlled: a click reports the surface id and the caller
// decides what is selected. The scene is rebuilt only when `surfaces` changes
// identity, so selection, highlighting and hiding never reset the camera.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPvModules, buildSurfaceGroup, computeOrigin, surfaceSides, toLocal, type SurfacePolygon } from '@/app/lib/surfaceMesh';
import { storeyAt, storeyBands, storeyLines, storeyParts } from '@/app/lib/storeys';
import { PV_PRODUCT_DRAG_TYPE } from '@/app/lib/pvProducts';
import { useFormatNumber, useT } from '@/app/i18n';

interface SurfaceGeometryViewerProps {
  surfaces: SurfacePolygon[];
  /** Surface drawn with the selection glow. */
  selectedId?: string | null;
  /** Surfaces drawn red: their envelope element is incomplete. */
  invalidIds?: ReadonlySet<string>;
  /** Surfaces to render. Undefined renders all of them. */
  visibleIds?: ReadonlySet<string>;
  /** Surfaces carrying PV, drawn with the modules in pvModules. */
  pvIds?: ReadonlySet<string>;
  /** Each PV surface's modules, four [x, y, z] corners each, from pvLayout. Hold each array stable while unchanged. */
  pvModules?: Readonly<Record<string, number[][][]>>;
  /** Surfaces suggested for PV: a light fill and a dashed outline, no modules. */
  candidateIds?: ReadonlySet<string>;
  /**
   * The surface under the pointer, or null when it leaves one, with the
   * pointer's client position. Fires on a change of surface only.
   */
  onHoverSurface?: (id: string | null, at?: { x: number; y: number }) => void;
  /** A PV product (dragged with PV_PRODUCT_DRAG_TYPE) was dropped on a surface. Without it nothing can be dropped. */
  onDropProduct?: (surfaceId: string, productId: string) => void;
  /** Turns the model to face this surface. Acts whenever `focusToken` changes,
   *  so picking the same surface again re-frames it. */
  focusId?: string | null;
  focusToken?: number;
  /** Draws a line at each floor level; storeys left out of the model (1-based) are veiled, the selected ones highlighted. */
  storeys?: { count: number; modelled: readonly number[] | null; selected?: readonly number[] };
  /** While set, a click picks the storey at the clicked height instead of a surface. */
  onSelectStorey?: (storey: number | null) => void;
  /** Draws the selected surface's side lengths, with a line and end dots per side. */
  showSides?: boolean;
  /** A surface to fill and outline, as while it is hovered in the model or a list. */
  previewId?: string | null;
  /** `at` is the click position in client coordinates. */
  onSelectSurface?: (id: string | null, at?: { x: number; y: number }) => void;
}

const HIGHLIGHT_COLOR = 0x2563eb;
const INVALID_COLOR = 0x991b1b;
/** A surface suggested for PV: a light fill inside a dashed outline. */
/** The measured sides of the selected surface and their ends. */
const SIDE_COLOR = 0xf97316;
const CANDIDATE_FILL = 0xfde047;
const CANDIDATE_EDGE_COLOR = 0x92400e;
const EDGE_COLOR = 0x1e293b;
const INVALID_EDGE_COLOR = 0xdc2626;
// A plain DOM 'click' fires on pointerup regardless of drag distance, so an
// orbit drag that ends over a surface would otherwise select it. Only treat
// a pointerup as a selection if the pointer moved less than this. A finger
// wanders further than a mouse on what the user means as a tap.
const CLICK_DRAG_THRESHOLD_PX = 5;
const TOUCH_DRAG_THRESHOLD_PX = 12;
/** How long the model takes to turn towards a surface picked from a list. */
const FLY_TO_SECONDS = 0.7;

export function SurfaceGeometryViewer({
  surfaces,
  selectedId = null,
  invalidIds,
  visibleIds,
  pvIds,
  pvModules,
  candidateIds,
  focusId,
  focusToken,
  storeys,
  onSelectStorey,
  previewId = null,
  showSides = false,
  onSelectSurface,
  onHoverSurface,
  onDropProduct,
}: SurfaceGeometryViewerProps) {
  const t = useT();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<THREE.Group[]>([]);
  const selectRef = useRef(onSelectSurface);
  /** A surface to turn towards, picked up by the next frame. */
  const focusRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusToken === undefined || !focusId) return;
    focusRequestRef.current = focusId;
  }, [focusToken, focusId]);

  useEffect(() => { selectRef.current = onSelectSurface; });
  const hoverRef = useRef(onHoverSurface);
  useEffect(() => { hoverRef.current = onHoverSurface; });
  const dropRef = useRef(onDropProduct);
  useEffect(() => { dropRef.current = onDropProduct; });
  const storeyPickRef = useRef({ onSelectStorey, count: storeys?.count ?? 0 });
  useEffect(() => { storeyPickRef.current = { onSelectStorey, count: storeys?.count ?? 0 }; });
  const origin = useMemo(() => computeOrigin(surfaces), [surfaces]);
  const format = useFormatNumber();
  // The selected surface's side lengths, placed over the model by the render loop.
  const sides = useMemo(() => {
    const polygon = showSides && selectedId ? surfaces.find((surface) => surface.id === selectedId) : undefined;
    return polygon ? surfaceSides(polygon) : [];
  }, [surfaces, selectedId, showSides]);
  const sidePositionsRef = useRef<THREE.Vector3[]>([]);
  const sideLabelsRef = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => { sidePositionsRef.current = sides.map((side) => toLocal(side.mid, origin)); }, [sides, origin]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // No scene background: the canvas is transparent and the container's
    // theme colour shows through, so the model follows the host's theme.
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(12, 22, 10);
    scene.add(sun);

    const groups = surfaces.map((surface) => buildSurfaceGroup(surface, origin));
    groups.forEach((group) => scene.add(group));
    groupsRef.current = groups;
    sceneRef.current = scene;

    // Framed from the geometry rather than a fixed distance: a real building is
    // anything from a garage to a terrace block, and the origin is the mean
    // vertex, not the building's centre.
    const bounds = new THREE.Box3();
    groups.forEach((group) => bounds.expandByObject(group));
    const view = bounds.getBoundingSphere(new THREE.Sphere());
    const distance = view.radius / Math.sin((camera.fov * Math.PI) / 360);
    camera.position.copy(view.center).add(new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(distance));
    camera.far = distance * 4;
    camera.updateProjectionMatrix();
    controls.target.copy(view.center);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    /** The nearest visible surface hit at a client position, if any. */
    function hitAt(clientX: number, clientY: number): THREE.Intersection | undefined {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // Raycaster ignores Object3D.visible, so a hidden group stays pickable
      // unless its hits are dropped here.
      return raycaster.intersectObjects(groups, true)
        .find((h) => h.object.name === 'surface-fill' && h.object.parent?.visible !== false);
    }
    /** The id of the surface at a client position, or null. */
    function surfaceAt(clientX: number, clientY: number): string | null {
      return ((hitAt(clientX, clientY)?.object.parent as THREE.Group | undefined)?.userData.id as string | undefined) ?? null;
    }
    function selectAt(clientX: number, clientY: number) {
      const { onSelectStorey: pickStorey, count } = storeyPickRef.current;
      if (pickStorey) {
        const hit = hitAt(clientX, clientY);
        // Local y is the storage CRS's z less the origin's (see toLocal).
        pickStorey(hit ? storeyAt(hit.point.y + origin[2], storeyBands(surfaces, count), count) : null);
        return;
      }
      selectRef.current?.(surfaceAt(clientX, clientY), { x: clientX, y: clientY });
    }

    let hovered: string | null = null;
    function handlePointerMove(event: PointerEvent) {
      if (!hoverRef.current || event.buttons !== 0 || event.pointerType !== 'mouse') return;
      const id = surfaceAt(event.clientX, event.clientY);
      if (id === hovered) return;
      hovered = id;
      hoverRef.current(id, { x: event.clientX, y: event.clientY });
    }
    function handlePointerLeave() {
      if (hovered === null) return;
      hovered = null;
      hoverRef.current?.(null);
    }

    let pointerDown: { x: number; y: number; touch: boolean } | null = null;
    function handlePointerDown(event: PointerEvent) {
      flight = null;
      pointerDown = { x: event.clientX, y: event.clientY, touch: event.pointerType !== 'mouse' };
    }
    function handlePointerUp(event: PointerEvent) {
      if (!pointerDown) return;
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      const threshold = pointerDown.touch ? TOUCH_DRAG_THRESHOLD_PX : CLICK_DRAG_THRESHOLD_PX;
      pointerDown = null;
      if (Math.hypot(dx, dy) > threshold) return;
      selectAt(event.clientX, event.clientY);
    }
    // A product dragged over the model shows the surface it would land on
    // through the hover callback, as the pointer does.
    function handleDragOver(event: DragEvent) {
      if (!dropRef.current || !event.dataTransfer?.types.includes(PV_PRODUCT_DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      const id = surfaceAt(event.clientX, event.clientY);
      if (id === hovered) return;
      hovered = id;
      hoverRef.current?.(id, { x: event.clientX, y: event.clientY });
    }
    function handleDrop(event: DragEvent) {
      const productId = event.dataTransfer?.getData(PV_PRODUCT_DRAG_TYPE);
      if (!dropRef.current || !productId) return;
      event.preventDefault();
      const id = surfaceAt(event.clientX, event.clientY);
      handlePointerLeave();
      if (id) dropRef.current(id, productId);
    }
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('dragover', handleDragOver);
    renderer.domElement.addEventListener('dragleave', handlePointerLeave);
    renderer.domElement.addEventListener('drop', handleDrop);

    /** Eases a turn around the target rather than sliding the camera through it. */
    let flight: { from: THREE.Spherical; to: THREE.Spherical; progress: number } | null = null;

    /** Where to stand to look a surface in the face: outward along its normal,
     *  at the distance the camera is already at. */
    function startFlyTo(group: THREE.Group) {
      const fill = group.children.find((c) => c.name === 'surface-fill') as THREE.Mesh | undefined;
      const normals = fill?.geometry.getAttribute('normal');
      if (!fill || !normals) return;

      const centre = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
      const normal = new THREE.Vector3(normals.getX(0), normals.getY(0), normals.getZ(0)).normalize();
      // city2tabula winding is inconsistent, so the normal may point into the
      // building. Away from the building's middle is the side to view it from.
      if (normal.dot(centre.clone().sub(controls.target)) < 0) normal.negate();

      const radius = camera.position.distanceTo(controls.target);
      const to = new THREE.Spherical().setFromVector3(normal.multiplyScalar(radius));
      // Never from underground, and never from straight overhead, where the
      // orbit loses its horizon and the building reads as a flat plan.
      to.phi = Math.min(Math.max(to.phi, 0.25), 1.45);
      to.radius = radius;

      const from = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target),
      );
      // The short way round, so a surface just behind the camera does not
      // trigger a near-full turn.
      let delta = to.theta - from.theta;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      to.theta = from.theta + delta;

      flight = { from, to, progress: 0 };
    }

    /** Advances a turn in progress. Returns false once there is nothing to do. */
    function advanceFlight(delta: number): boolean {
      if (!flight) return false;
      flight.progress = Math.min(1, flight.progress + delta / FLY_TO_SECONDS);
      // Ease in and out, so the model starts and stops gently.
      const t = flight.progress < 0.5
        ? 2 * flight.progress * flight.progress
        : 1 - 2 * (1 - flight.progress) ** 2;
      const step = new THREE.Spherical(
        THREE.MathUtils.lerp(flight.from.radius, flight.to.radius, t),
        THREE.MathUtils.lerp(flight.from.phi, flight.to.phi, t),
        THREE.MathUtils.lerp(flight.from.theta, flight.to.theta, t),
      );
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(step));
      if (flight.progress >= 1) flight = null;
      return true;
    }

    let frameId: number;
    let lastFrame = performance.now();
    function animate() {
      frameId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;

      if (focusRequestRef.current) {
        const group = groups.find((g) => g.userData.id === focusRequestRef.current);
        focusRequestRef.current = null;
        if (group) startFlyTo(group);
      }
      advanceFlight(delta);

      controls.update();
      renderer.render(scene, camera);
      // Approximate compass: rotates the needle opposite the camera's orbit so it
      // keeps pointing at world north (scene -Z, per surfaceMesh's axis mapping).
      if (compassRef.current) {
        compassRef.current.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`;
      }
      const { clientWidth: width, clientHeight: height } = renderer.domElement;
      sidePositionsRef.current.forEach((position, i) => {
        const label = sideLabelsRef.current[i];
        if (!label) return;
        const at = position.clone().project(camera);
        label.style.display = at.z > 1 ? 'none' : '';
        label.style.transform = `translate(-50%, -50%) translate(${((at.x + 1) / 2) * width}px, ${((1 - at.y) / 2) * height}px)`;
      });
    }
    animate();

    // An arrow rather than a declaration: a hoisted function could run before
    // the null check above, so TypeScript will not carry it inside one.
    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('dragover', handleDragOver);
      renderer.domElement.removeEventListener('dragleave', handlePointerLeave);
      renderer.domElement.removeEventListener('drop', handleDrop);
      controls.dispose();
      groups.forEach((group) => {
        group.children.forEach((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      });
      groupsRef.current = [];
      sceneRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [surfaces, origin]);

  // Each measured side as a bright line with a dot at either end, drawn over
  // the model so the label's start and end can be seen on a cut-up surface.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || sides.length === 0) return;
    const ends = sides.flatMap((side) => [toLocal(side.from, origin), toLocal(side.to, origin)]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: SIDE_COLOR, depthTest: false });
    const dotMaterial = new THREE.PointsMaterial({ color: SIDE_COLOR, size: 7, sizeAttenuation: false, depthTest: false });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ends), lineMaterial);
    const dots = new THREE.Points(new THREE.BufferGeometry().setFromPoints(ends), dotMaterial);
    for (const object of [lines, dots]) {
      object.renderOrder = 10;
      object.raycast = () => {};
      scene.add(object);
    }
    return () => {
      for (const object of [lines, dots]) {
        scene.remove(object);
        object.geometry.dispose();
      }
      lineMaterial.dispose();
      dotMaterial.dispose();
    };
  }, [sides, origin]);

  // The previewed surface, filled and outlined in the side colour so its
  // extent shows whichever way the building faces.
  useEffect(() => {
    const scene = sceneRef.current;
    const polygon = previewId ? surfaces.find((surface) => surface.id === previewId) : undefined;
    if (!scene || !polygon) return;
    const ends = surfaceSides(polygon).flatMap((side) => [toLocal(side.from, origin), toLocal(side.to, origin)]);
    const material = new THREE.LineBasicMaterial({ color: SIDE_COLOR, depthTest: false });
    const outline = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ends), material);
    outline.renderOrder = 10;
    outline.raycast = () => {};
    scene.add(outline);
    const built = buildSurfaceGroup(polygon, origin);
    const fill = built.children.find((c) => c.name === 'surface-fill') as THREE.Mesh | undefined;
    built.children.forEach((child) => {
      if (child !== fill) (child as THREE.Mesh).geometry.dispose();
      ((child as THREE.Mesh).material as THREE.Material).dispose();
    });
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: SIDE_COLOR, transparent: true, opacity: 0.4, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    if (fill) {
      fill.material = fillMaterial;
      fill.raycast = () => {};
      fill.renderOrder = 9;
      scene.add(fill);
    }
    return () => {
      scene.remove(outline);
      outline.geometry.dispose();
      material.dispose();
      if (fill) {
        scene.remove(fill);
        fill.geometry.dispose();
      }
      fillMaterial.dispose();
    };
  }, [surfaces, origin, previewId]);

  // Display only: the geometry has no storeys, so these follow storeyBands.
  const storeyCount = storeys?.count ?? 0;
  const leftOutKey = storeys?.modelled
    ? Array.from({ length: storeyCount }, (_, i) => i + 1).filter((s) => !storeys.modelled?.includes(s)).join(',')
    : '';
  const selectedKey = (storeys?.selected ?? []).join(',');
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || storeyCount < 2 || surfaces.length === 0) return;
    const overlay = new THREE.Group();
    const lineMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.55 });
    const points = storeyLines(surfaces, storeyCount).flat().map((p) => toLocal(p, origin));
    overlay.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), lineMaterial));
    const overMaterial = (color: number, opacity: number) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    // A left-out storey's part of each surface is drawn again over it, light;
    // the selected storeys' in the selection colour.
    const veil = overMaterial(0xffffff, 0.6);
    const picked = overMaterial(HIGHLIGHT_COLOR, 0.35);
    /** Draws each surface's part inside `chosen` over the model with `material`. */
    const drawOver = (chosen: number[], material: THREE.Material) => {
      for (const part of chosen.length > 0 ? storeyParts(surfaces, storeyCount, chosen) : []) {
        const built = buildSurfaceGroup(part, origin);
        const fill = built.children.find((c) => c.name === 'surface-fill') as THREE.Mesh | undefined;
        built.children.forEach((child) => {
          if (child !== fill) (child as THREE.Mesh).geometry.dispose();
          ((child as THREE.Mesh).material as THREE.Material).dispose();
        });
        if (!fill) continue;
        fill.material = material;
        fill.raycast = () => {};
        overlay.add(fill);
      }
    };
    drawOver(leftOutKey ? leftOutKey.split(',').map(Number) : [], veil);
    drawOver(selectedKey ? selectedKey.split(',').map(Number) : [], picked);
    scene.add(overlay);
    return () => {
      scene.remove(overlay);
      overlay.children.forEach((child) => (child as THREE.Mesh).geometry.dispose());
      [lineMaterial, veil, picked].forEach((material) => material.dispose());
    };
  }, [surfaces, origin, storeyCount, leftOutKey, selectedKey]);

  // Runs after the scene effect on the same commit, so the groups exist.
  useEffect(() => {
    for (const group of groupsRef.current) {
      const id = group.userData.id as string;
      const invalid = invalidIds?.has(id) ?? false;
      group.visible = visibleIds ? visibleIds.has(id) : true;

      const candidate = !invalid && (candidateIds?.has(id) ?? false);
      const fill = group.children.find((c) => c.name === 'surface-fill') as THREE.Mesh | undefined;
      const fillMaterial = fill?.material as THREE.MeshStandardMaterial | undefined;
      if (fill && fill.userData.baseColor === undefined) fill.userData.baseColor = fillMaterial?.color.getHex();
      fillMaterial?.color.setHex(candidate ? CANDIDATE_FILL : fill?.userData.baseColor);
      fillMaterial?.emissive.setHex(
        id === selectedId ? HIGHLIGHT_COLOR : invalid ? INVALID_COLOR : 0x000000,
      );

      // Modules kept while the scene lives and rebuilt only when the layout
      // changes: toggling visibility is cheaper.
      let panel = group.children.find((c) => c.name === 'pv-panel') as THREE.Mesh | undefined;
      const hasPv = pvIds?.has(id) ?? false;
      const modules = pvModules?.[id];
      if (hasPv && panel && panel.userData.modules !== modules) {
        group.remove(panel);
        panel.geometry.dispose();
        panel = undefined;
      }
      if (hasPv && !panel && modules) {
        panel = buildPvModules(modules, origin);
        panel.userData.modules = modules;
        group.add(panel);
      }
      if (panel) panel.visible = hasPv;

      const edges = group.children.find((c) => c.name !== 'candidate-outline' && c instanceof THREE.LineSegments) as THREE.LineSegments | undefined;
      const edgeMaterial = edges?.material as THREE.LineBasicMaterial | undefined;
      edgeMaterial?.color.setHex(invalid ? INVALID_EDGE_COLOR : EDGE_COLOR);
      if (edges) edges.visible = !candidate;

      // A solid dark copy of the edges, made the first time the surface is
      // suggested. WebGL draws every line 1 px wide, so contrast carries it.
      let outline = group.children.find((c) => c.name === 'candidate-outline') as THREE.LineSegments | undefined;
      if (candidate && !outline && edges) {
        outline = new THREE.LineSegments(edges.geometry, new THREE.LineBasicMaterial({ color: CANDIDATE_EDGE_COLOR }));
        outline.name = 'candidate-outline';
        group.add(outline);
      }
      if (outline) outline.visible = candidate;
    }
  }, [surfaces, origin, selectedId, invalidIds, visibleIds, pvIds, pvModules, candidateIds]);

  return (
    <div className="bg-muted" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
      {sides.map((side, i) => (
        <span
          key={i}
          ref={(el) => { sideLabelsRef.current[i] = el; }}
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-semibold text-background shadow-sm"
        >{format(side.length, 2)} m</span>
      ))}
      <div className="border border-border bg-card/90" style={{
        position: 'absolute', top: 12, right: 12, width: 44, height: 44, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div ref={compassRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
          <span style={{
            position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, fontWeight: 700, color: '#dc2626',
          }}>{t('envelope.compassNorth')}</span>
          <div className="border-l-[1.5px] border-muted-foreground" style={{
            position: 'absolute', top: 14, left: '50%', width: 0, height: 14,
            transform: 'translateX(-50%)',
          }} />
        </div>
      </div>
    </div>
  );
}
