// Single-building 3D surface viewer. Renders in free space, no basemap: the
// envelope's surfaces as pickable meshes for one building at a time. Vanilla
// Three.js, matching cityviz's approach in the same workspace rather than
// adding a React renderer on top.
//
// Selection is controlled: a click reports the surface id and the caller
// decides what is selected. The scene is rebuilt only when `surfaces` changes
// identity, so selection, highlighting and hiding never reset the camera.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPvPanel, buildSurfaceGroup, computeOrigin, type SurfacePolygon } from '@/app/lib/surfaceMesh';

interface SurfaceGeometryViewerProps {
  surfaces: SurfacePolygon[];
  /** Surface drawn with the selection glow. */
  selectedId?: string | null;
  /** Surfaces drawn red: their envelope element is incomplete. */
  invalidIds?: ReadonlySet<string>;
  /** Surfaces to render. Undefined renders all of them. */
  visibleIds?: ReadonlySet<string>;
  /** Surfaces carrying PV, drawn with an array over them. */
  pvIds?: ReadonlySet<string>;
  /** Surfaces worth putting PV on, lit while the PV planner is open. */
  candidateIds?: ReadonlySet<string>;
  /** Turns the model to face this surface. Acts whenever `focusToken` changes,
   *  so picking the same surface again re-frames it. */
  focusId?: string | null;
  focusToken?: number;
  /** `at` is the click position in client coordinates, for anchoring a popover. */
  onSelectSurface?: (id: string | null, at?: { x: number; y: number }) => void;
  /**
   * Where the selected surface currently is on screen, in client coordinates,
   * with the radius it occupies there. Fires as the camera moves, so an editor
   * anchored to it follows its surface and can stand clear of it.
   * Called outside React's render cycle — move a node, do not set state.
   */
  onSelectedAnchorMove?: (at: { x: number; y: number; radius: number }) => void;
}

const HIGHLIGHT_COLOR = 0x2563eb;
const INVALID_COLOR = 0x991b1b;
/** A surface the PV planner is offering: lit so it can be picked out at a glance. */
const CANDIDATE_COLOR = 0x92610a;
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
  candidateIds,
  focusId,
  focusToken,
  onSelectSurface,
  onSelectedAnchorMove,
}: SurfaceGeometryViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<THREE.Group[]>([]);
  const selectRef = useRef(onSelectSurface);
  const anchorMoveRef = useRef(onSelectedAnchorMove);
  /** Centre and corners of the selected surface in world space, for projecting
   *  its position and on-screen size. Null when nothing is selected. */
  const anchorRef = useRef<{ centre: THREE.Vector3; corners: THREE.Vector3[] } | null>(null);
  /** Forces the next frame to report even if the projection has not moved. */
  const anchorDirtyRef = useRef(false);
  /** A surface to turn towards, picked up by the next frame. */
  const focusRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusToken === undefined || !focusId) return;
    focusRequestRef.current = focusId;
  }, [focusToken, focusId]);

  useEffect(() => { selectRef.current = onSelectSurface; });
  useEffect(() => { anchorMoveRef.current = onSelectedAnchorMove; });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(12, 22, 10);
    scene.add(sun);

    const origin = computeOrigin(surfaces);
    const groups = surfaces.map((surface) => buildSurfaceGroup(surface, origin));
    groups.forEach((group) => scene.add(group));
    groupsRef.current = groups;

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
    function selectAt(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // Raycaster ignores Object3D.visible, so a hidden group stays pickable
      // unless its hits are dropped here.
      const hit = raycaster.intersectObjects(groups, true)
        .find((h) => h.object.name === 'surface-fill' && h.object.parent?.visible !== false);
      const group = hit?.object.parent as THREE.Group | undefined;
      selectRef.current?.((group?.userData.id as string | undefined) ?? null, { x: clientX, y: clientY });
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
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

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

    const projected = new THREE.Vector3();
    let lastAnchorX = Number.NaN;
    let lastAnchorY = Number.NaN;
    /** Projects the selected surface to the screen so an anchored editor can
     *  follow it, with the radius it covers there so the editor can clear it. */
    function reportAnchor() {
      const anchor = anchorRef.current;
      const report = anchorMoveRef.current;
      if (!anchor || !report) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const toScreen = (point: THREE.Vector3) => {
        projected.copy(point).project(camera);
        return {
          x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
          y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
          behind: projected.z > 1,
        };
      };

      const centre = toScreen(anchor.centre);
      // Behind the camera the projection mirrors, which would throw the editor
      // to the opposite edge. Leave it where it was until the surface is in front again.
      if (centre.behind) return;

      const dirty = anchorDirtyRef.current;
      if (!dirty
        && Math.abs(centre.x - lastAnchorX) < 0.5
        && Math.abs(centre.y - lastAnchorY) < 0.5) return;
      anchorDirtyRef.current = false;
      lastAnchorX = centre.x;
      lastAnchorY = centre.y;

      let radius = 0;
      for (const corner of anchor.corners) {
        const screen = toScreen(corner);
        if (screen.behind) continue;
        radius = Math.max(radius, Math.hypot(screen.x - centre.x, screen.y - centre.y));
      }
      report({ x: centre.x, y: centre.y, radius });
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
      if (advanceFlight(delta)) anchorDirtyRef.current = true;

      controls.update();
      renderer.render(scene, camera);
      reportAnchor();
      // Approximate compass: rotates the needle opposite the camera's orbit so it
      // keeps pointing at world north (scene -Z, per surfaceMesh's axis mapping).
      if (compassRef.current) {
        compassRef.current.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`;
      }
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
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [surfaces]);

  // Runs after the scene effect on the same commit, so the groups exist.
  useEffect(() => {
    anchorRef.current = null;
    for (const group of groupsRef.current) {
      const id = group.userData.id as string;
      const invalid = invalidIds?.has(id) ?? false;
      group.visible = visibleIds ? visibleIds.has(id) : true;

      const fill = group.children.find((c) => c.name === 'surface-fill') as THREE.Mesh | undefined;
      const fillMaterial = fill?.material as THREE.MeshStandardMaterial | undefined;
      fillMaterial?.emissive.setHex(
        id === selectedId ? HIGHLIGHT_COLOR
          : invalid ? INVALID_COLOR
          : candidateIds?.has(id) ? CANDIDATE_COLOR
          : 0x000000,
      );

      // The array itself, added once per surface and kept for as long as the
      // scene lives — toggling visibility is cheaper than rebuilding geometry.
      let panel = group.children.find((c) => c.name === 'pv-panel') as THREE.Mesh | undefined;
      const hasPv = pvIds?.has(id) ?? false;
      if (hasPv && !panel && fill) {
        panel = buildPvPanel(fill.geometry);
        group.add(panel);
      }
      if (panel) panel.visible = hasPv;

      const edges = group.children.find((c) => c instanceof THREE.LineSegments) as THREE.LineSegments | undefined;
      const edgeMaterial = edges?.material as THREE.LineBasicMaterial | undefined;
      edgeMaterial?.color.setHex(invalid ? INVALID_EDGE_COLOR : EDGE_COLOR);

      // The surface's middle, not the point that was clicked: it stays put as
      // the model turns, which is what an editor beside it should track.
      if (id === selectedId) {
        const box = new THREE.Box3().setFromObject(group);
        const centre = box.getCenter(new THREE.Vector3());
        const corners: THREE.Vector3[] = [];
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
          }
        }
        anchorRef.current = { centre, corners };
        anchorDirtyRef.current = true;
      }
    }
  }, [surfaces, selectedId, invalidIds, visibleIds, pvIds, candidateIds]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
      <div style={{
        position: 'absolute', top: 12, right: 12, width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(148,163,184,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div ref={compassRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
          <span style={{
            position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, fontWeight: 700, color: '#dc2626',
          }}>N</span>
          <div style={{
            position: 'absolute', top: 14, left: '50%', width: 0, height: 14,
            borderLeft: '1.5px solid #64748b', transform: 'translateX(-50%)',
          }} />
        </div>
      </div>
    </div>
  );
}
