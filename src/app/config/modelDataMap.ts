// Authoritative registry that maps every UI data point to its source path in the
// BUEM GeoJSON response. When the API schema changes, update the paths here only.
//
// Format: dot-separated JSON path from the root of a GeoJSON Feature object.
// Values marked { value, unit } in the schema are noted inline.
//
// Two data classes are tracked separately:
//   energy   — from the BUEM response (POST /api/process)
//   geometry — from the separate GeoJSON building footprint layer

export const MODEL_DATA_MAP = {

  // ── Energy data ──────────────────────────────────────────────────────────────
  // Source: BUEM GeoJSON FeatureCollection → features[n]
  energy: {
    // Identity
    buildingId:         'id',
    coordinates:        'geometry.coordinates',                            // [lon, lat] or [lon, lat, elevation]

    // Building descriptor  (properties.buem.building.*)
    buildingType:       'properties.buem.building.building_type',         // e.g. "MFH", "SFH"
    constructionPeriod: 'properties.buem.building.construction_period',   // e.g. "1980-2000"
    country:            'properties.buem.building.country',               // ISO 3166-1 alpha-2
    floorArea:          'properties.buem.building.A_ref',                 // { value: number, unit: "m2" }
    roomHeight:         'properties.buem.building.h_room',                // { value: number, unit: "m" }
    storeys:            'properties.buem.building.n_storeys',

    // Envelope elements  (properties.buem.building.envelope.elements[])
    // Each element: { id, type, area, azimuth, tilt, U, g_gl? }
    envelopeElements:   'properties.buem.building.envelope.elements',

    // Thermal results summary  (properties.buem.thermal_load_profile.summary.*)
    heatingTotal:       'properties.buem.thermal_load_profile.summary.heating.total',       // { value, unit: "kWh" }
    coolingTotal:       'properties.buem.thermal_load_profile.summary.cooling.total',       // { value, unit: "kWh" }
    electricityTotal:   'properties.buem.thermal_load_profile.summary.electricity.total',   // { value, unit: "kWh" }
    peakHeatingLoad:    'properties.buem.thermal_load_profile.summary.peak_heating_load',   // { value, unit: "kW" }
    peakCoolingLoad:    'properties.buem.thermal_load_profile.summary.peak_cooling_load',   // { value, unit: "kW" }
    energyIntensity:    'properties.buem.thermal_load_profile.summary.energy_intensity',    // { value, unit: "kWh/m2" }

    // Hourly timeseries  (properties.buem.thermal_load_profile.timeseries)
    // Only present when ?include_timeseries=true was passed to the endpoint.
    // Shape: { unit: "kW", timestamps: string[], heating: number[], cooling: number[], electricity: number[] }
    timeseries:         'properties.buem.thermal_load_profile.timeseries',
  },

  // ── Geometry data ─────────────────────────────────────────────────────────────
  // Source: separate GeoJSON building footprint layer
  geometry: {
    buildingId:       'properties.id',
    buildingFootprint: 'geometry',          // Polygon or MultiPolygon
    buildingHeight:   'properties.height',  // metres above ground, if available
  },

} as const;
