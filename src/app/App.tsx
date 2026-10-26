import { useEffect, useState } from 'react';
import { BuildingWorkspace, FIXTURE_OSM_ID, FixtureWorkspace, FLAT_ROOF_OSM_ID } from './components/workspace/BuildingWorkspace';
import { SegmentedControl } from './components/BuildingConfigurator/shared/ui';
import { MESSAGES, type Language } from './i18n';

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<'workspace' | 'fixture' | 'flat'>('workspace');
  // The host's language setting, played by a picker here.
  const [language, setLanguage] = useState<Language>('en');
  // The host's theme, played here: EnerPlanET sets .dark on <html> the same way.
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

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
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 6 }} className="flex items-center rounded-[6px] shadow-lg">
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v as 'workspace' | 'fixture' | 'flat')}
            options={[
              { value: 'workspace', label: '3D workspace (Loenen)' },
              { value: 'fixture', label: '3D fixture (1 building)' },
              { value: 'flat', label: '3D fixture (flat roof)' },
            ]}
          />
          <select
            aria-label="Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="ml-2 rounded-[6px] border border-border bg-card px-2 py-1 text-xs"
          >
            {(Object.keys(MESSAGES) as Language[]).map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="ml-2 cursor-pointer rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-foreground"
          >
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>

        {view === 'workspace' && <BuildingWorkspace language={language} />}
        {view === 'fixture' && <FixtureWorkspace key="fixture" osmId={FIXTURE_OSM_ID} language={language} />}
        {view === 'flat' && <FixtureWorkspace key="flat" osmId={FLAT_ROOF_OSM_ID} language={language} />}

      </div>
    </>
  );
}
