// Single-building 3D surface viewer — experimental concept. Renders in free
// space, no basemap: replaces the flat surface list with rotate + click-a-surface
// interaction for one building at a time. Vanilla Three.js, matching cityviz's
// approach in the same workspace rather than adding a React renderer on top.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildSurfaceGroup, computeOrigin, type SurfacePolygon } from '../../lib/surfaceMesh';

interface SurfaceGeometryViewerProps {
  surfaces: SurfacePolygon[];
  onSelectSurface?: (surface: SurfacePolygon | null) => void;
}

const HIGHLIGHT_COLOR = 0x2563eb;
// A plain DOM 'click' fires on pointerup regardless of drag distance, so an
// orbit drag that ends over a surface would otherwise select it. Only treat
// a pointerup as a selection if the pointer moved less than this.
const CLICK_DRAG_THRESHOLD_PX = 5;

export function SurfaceGeometryViewer({ surfaces, onSelectSurface }: SurfaceGeometryViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 500);
    camera.position.set(14, 11, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.5, 0);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(12, 22, 10);
    scene.add(sun);

    const origin = computeOrigin(surfaces);
    const groups = surfaces.map((surface) => buildSurfaceGroup(surface, origin));
    groups.forEach((group) => scene.add(group));

    let selectedGroup: THREE.Group | null = null;
    function setHighlight(group: THREE.Group | null) {
      for (const g of [selectedGroup, group]) {
        const mesh = g?.children.find((c) => c.name === 'surface-fill') as THREE.Mesh | undefined;
        const material = mesh?.material as THREE.MeshStandardMaterial | undefined;
        material?.emissive.setHex(g === group && group ? HIGHLIGHT_COLOR : 0x000000);
      }
      selectedGroup = group;
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function selectAt(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(groups, true).find((h) => h.object.name === 'surface-fill');
      const group = (hit?.object.parent as THREE.Group | undefined) ?? null;
      setHighlight(group);
      const id = group?.userData.id as string | undefined;
      onSelectSurface?.(id ? surfaces.find((s) => s.id === id) ?? null : null);
    }

    let pointerDown: { x: number; y: number } | null = null;
    function handlePointerDown(event: PointerEvent) {
      pointerDown = { x: event.clientX, y: event.clientY };
    }
    function handlePointerUp(event: PointerEvent) {
      if (!pointerDown) return;
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      pointerDown = null;
      if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) return;
      selectAt(event.clientX, event.clientY);
    }
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    let frameId: number;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      // Approximate compass: rotates the needle opposite the camera's orbit so it
      // keeps pointing at world north (scene -Z, per surfaceMesh's axis mapping).
      if (compassRef.current) {
        compassRef.current.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`;
      }
    }
    animate();

    function handleResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
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
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [surfaces, onSelectSurface]);

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
