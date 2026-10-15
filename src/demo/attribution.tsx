// Credits for the bundled Loenen captures, as their licences require them to
// be visible. The full licence and change statements are in ATTRIBUTIONS.md;
// keep the two in step.

const OSM = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>';
const BAG3D = '<a href="https://docs.3dbag.nl/en/copyright/" target="_blank" rel="noreferrer">© 3DBAG by tudelft3d and 3DGI</a>';
const TABULA = '<a href="https://episcope.eu/communication/download/" target="_blank" rel="noreferrer">IEE Projects TABULA + EPISCOPE (www.episcope.eu)</a>';
const MERRA2 = '<a href="https://doi.org/10.5067/VJAFPLI1CSIV" target="_blank" rel="noreferrer">MERRA-2, NASA GMAO / GES DISC</a> (p50 typical year)';

/** OpenLayers attributions for the bundled building layer; the OSM basemap credits itself. */
export const MAP_ATTRIBUTIONS = [[
  `Building footprints ${OSM} (ODbL), via PyLovo`,
  `3D buildings ${BAG3D} (CC BY 4.0), modified by City2TABULA`,
  `Building typology ${TABULA}`,
  `Weather ${MERRA2}`,
].join(' · ')];

const linkClass = 'underline decoration-dotted underline-offset-2 hover:text-slate-700';

/** The same credits for the 3D view's attribution caption. */
export const FIXTURE_ATTRIBUTION = (
  <>
    3D buildings{' '}
    <a className={linkClass} href="https://docs.3dbag.nl/en/copyright/" target="_blank" rel="noreferrer">© 3DBAG by tudelft3d and 3DGI</a>{' '}
    (CC BY 4.0), modified by City2TABULA · Typology{' '}
    <a className={linkClass} href="https://episcope.eu/communication/download/" target="_blank" rel="noreferrer">IEE Projects TABULA + EPISCOPE</a>{' '}
    · Footprints{' '}
    <a className={linkClass} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>{' '}
    · Weather{' '}
    <a className={linkClass} href="https://doi.org/10.5067/VJAFPLI1CSIV" target="_blank" rel="noreferrer">MERRA-2, NASA GMAO</a> (p50 typical year)
  </>
);
