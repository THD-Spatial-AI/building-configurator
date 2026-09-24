import { Analytics } from '@vercel/analytics/react';
import { useState } from 'react';
import { BuildingWorkspace, FixtureWorkspace } from './components/workspace/BuildingWorkspace';
import { SegmentedControl } from './components/BuildingConfigurator/shared/ui';

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<'workspace' | 'fixture'>('workspace');

  return (
    <>
      {/* Map canvas */}
      <div style={{
        width:    '100vw',
        height:   '100vh',
        background: '#dce5ea',
        position: 'relative',
        overflow: 'auto',
      }}>
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 6 }} className="shadow-lg rounded-[6px]">
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v as 'workspace' | 'fixture')}
            options={[
              { value: 'workspace', label: '3D workspace (Loenen)' },
              { value: 'fixture', label: '3D fixture (1 building)' },
            ]}
          />
        </div>

        {view === 'workspace' && <BuildingWorkspace />}
        {view === 'fixture' && <FixtureWorkspace />}

      </div>
      <Analytics />
    </>
  );
}
