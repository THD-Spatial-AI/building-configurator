// Authoritative registry that maps dashboard data domains to source paths in the
// BUEM / EnerPlanET GeoJSON feature. When schema paths change, update them here
// and keep extraction code generic.
//
// Each path is either:
// - a dot-separated JSON path from the feature root
// - or an ordered list of fallback paths when multiple source shapes are supported
//
// The dashboard is organised into two integration-facing domains:
// - geometry      — physical building geometry and footprint sources
// - thematic      — building identity, envelope and model outputs
//
// Contract: buem-gateway schemas/v6-draft. An exported FeatureCollection omits
// properties.buem.weather, which v6-draft requires whenever heating or cooling
// is selected.

export type ModelDataPath = string | readonly string[];

export const MODEL_DATA_MAP = {

  // ── Thematic data ───────────────────────────────────────────────────────────
  // Source: BUEM GeoJSON FeatureCollection -> features[n]
  thematic: {
    // Identity available to the dashboard header and snapshot cards.
    buildingId:  'id',
    label:       ['properties.buem.building.name', 'id'],
    coordinates: 'geometry.coordinates',                                  // [lon, lat] or [lon, lat, elevation]

    // Descriptor data  (properties.buem.building.*)
    descriptor: {
      buildingTypeCode: [
        'properties.buem.building.building_type',                         // BUEM response shape
        'properties.buem.building.type',                                  // EnerPlanET topology shape
      ],
      constructionYear: [
        'properties.buem.configurator.construction_year',                 // the configurator's own keys, see buemAdapter
        'properties.buem.construction_year',                              // stored by 0.14.0
        'properties.buem.building.construction_period',                   // a year in blocks stored before 0.7.0
      ],
      country:            'properties.buem.building.country',
      floorArea:          'properties.buem.building.A_ref',               // { value, unit: "m2" }
      roomHeight: [
        'properties.buem.configurator.room_height',                       // the storeys' shared height, where one has its own
        'properties.buem.building.h_room',                                // { value, unit: "m" }: the mean BuEM takes
      ],
      storeys: [
        'properties.buem.configurator.storeys',
        'properties.buem.storeys',                                        // stored by 0.14.0
        'properties.buem.building.n_storeys',                             // deprecated in v6-draft; read from older sources, never written
      ],
      storeyList:         'properties.buem.configurator.storey_list',     // [{ storey: 1-based, modelled: boolean, dwellings?: number }], absent when all are modelled
    },

    // Building parameters beyond the descriptor, each absent unless set.
    parameters: {
      nAirInfiltration:  'properties.buem.building.thermal.n_air_infiltration', // { value, unit: "1/h" }
      nAirUse:           'properties.buem.building.thermal.n_air_use',          // { value, unit: "1/h" }
      cM:                'properties.buem.building.thermal.c_m',                // { value, unit: "kJ/(m2K)" }
      thermalClass:      'properties.buem.building.thermal.thermal_class',      // light | medium | heavy
      comfortTLb:        'properties.buem.building.thermal.comfortT_lb',        // { value, unit: "degC" }, heating setpoint
      comfortTUb:        'properties.buem.building.thermal.comfortT_ub',        // { value, unit: "degC" }, cooling setpoint
      useMilp:           'properties.buem.solver.use_milp',                     // boolean
      // The windows BuEM adds when the request has none of its own.
      windowToWallRatio: 'properties.buem.building.window_to_wall_ratio',       // 0 to <1
      windowU:           'properties.buem.building.window_U',                   // { value, unit: "W/(m2K)" }
      windowGGl:         'properties.buem.building.window_g_gl',                // 0 to 1
    },

    // Household inputs and output selection, keyed by their BuEM names.
    household: {
      residential_units: 'properties.buem.building.residential_units',
      // Only with storeys left out: the whole building's dwellings.
      residential_units_full: 'properties.buem.configurator.residential_units_full',
      num_persons:       'properties.buem.building.num_persons',
      archetype:         'properties.buem.building.archetype',
      region_code:       'properties.buem.building.region_code',
      cooking_carrier:   'properties.buem.building.cooking_carrier',
      include_dhw:       'properties.buem.building.include_dhw',
      setback_profile:   'properties.buem.building.setback_profile',
      capacity:          'properties.buem.building.capacity',
      equipment:         'properties.buem.building.equipment',
      outputs:           'properties.buem.outputs',
    },

    // Refurbishment states, kept beside the building block and never sent to
    // BuEM: { variant_code?: string, states?: { wall?: 1-3, roof?, ... } }.
    refurbishment: 'properties.buem.refurbishment',

    // Envelope element list (properties.buem.building.envelope.elements[])
    envelope: {
      elements: 'properties.buem.building.envelope.elements',
      // With storeys left out, elements above is clipped to them and this is
      // the whole envelope, kept for reopening.
      fullElements: 'properties.buem.configurator.envelope_full.elements',
    },

    // Thermal output from BUEM response.
    results: {
      heatingTotal:     'properties.buem.thermal_load_profile.summary.heating.total',
      coolingTotal:     'properties.buem.thermal_load_profile.summary.cooling.total',
      electricityTotal: 'properties.buem.thermal_load_profile.summary.electricity.total',
      dhwTotal:         'properties.buem.thermal_load_profile.summary.hot_water.total',
      kitchenTotal:     'properties.buem.thermal_load_profile.summary.kitchen.total',
      totalEnergyDemand: 'properties.buem.thermal_load_profile.summary.total_energy_demand',
      peakHeatingLoad:  'properties.buem.thermal_load_profile.summary.peak_heating_load',
      peakCoolingLoad:  'properties.buem.thermal_load_profile.summary.peak_cooling_load',
      energyIntensity:  'properties.buem.thermal_load_profile.summary.energy_intensity',
      timeseries:       'properties.buem.thermal_load_profile.timeseries',
    },
  },

  // ── Geometry data ─────────────────────────────────────────────────────────────
  // Source: separate GeoJSON building footprint layer
  geometry: {
    buildingId:        ['properties.id', 'id'],
    buildingFootprint: 'geometry',          // Polygon or MultiPolygon
    buildingHeight:    'properties.height', // metres above ground, if available
  },

} as const;
