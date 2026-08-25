import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import * as topojson from 'topojson-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './WorldMap.css';

// Free, no-key-required 110m world country boundaries (TopoJSON)
const WORLD_TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COLORS = {
  visited: '#c4622d',
  visitedState: '#4f9f72',
  unvisited: '#5c8a8e',
  base: '#e8dcc2',
  border: '#1b2a3a',
  selectedBorder: '#d4a24e',
};

const cityIcon = L.divIcon({
  className: 'wp-city-marker',
  html: '<span></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const US_STATE_CODES = {
  alabama: 'al',
  alaska: 'ak',
  arizona: 'az',
  arkansas: 'ar',
  california: 'ca',
  colorado: 'co',
  connecticut: 'ct',
  delaware: 'de',
  'district of columbia': 'dc',
  florida: 'fl',
  georgia: 'ga',
  hawaii: 'hi',
  idaho: 'id',
  illinois: 'il',
  indiana: 'in',
  iowa: 'ia',
  kansas: 'ks',
  kentucky: 'ky',
  louisiana: 'la',
  maine: 'me',
  maryland: 'md',
  massachusetts: 'ma',
  michigan: 'mi',
  minnesota: 'mn',
  mississippi: 'ms',
  missouri: 'mo',
  montana: 'mt',
  nebraska: 'ne',
  nevada: 'nv',
  'new hampshire': 'nh',
  'new jersey': 'nj',
  'new mexico': 'nm',
  'new york': 'ny',
  'north carolina': 'nc',
  'north dakota': 'nd',
  ohio: 'oh',
  oklahoma: 'ok',
  oregon: 'or',
  pennsylvania: 'pa',
  'rhode island': 'ri',
  'south carolina': 'sc',
  'south dakota': 'sd',
  tennessee: 'tn',
  texas: 'tx',
  utah: 'ut',
  vermont: 'vt',
  virginia: 'va',
  washington: 'wa',
  'west virginia': 'wv',
  wisconsin: 'wi',
  wyoming: 'wy',
};
const US_STATE_NAMES_BY_CODE = Object.fromEntries(
  Object.entries(US_STATE_CODES).map(([name, code]) => [code, name])
);

function normalizeRegionKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(state|province|region|prefecture|governorate|department|territory)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function regionKeys(...values) {
  const keys = new Set();
  const add = (key) => {
    if (!key) return;
    keys.add(key);
    const stateCode = US_STATE_CODES[key];
    if (stateCode) keys.add(stateCode);
    const stateName = US_STATE_NAMES_BY_CODE[key];
    if (stateName) keys.add(stateName);
  };

  values.forEach((value) => {
    const raw = String(value || '').toLowerCase().trim();
    const normalized = normalizeRegionKey(value);
    add(raw);
    add(normalized);
    if (raw.includes('-')) {
      const suffix = raw.split('-').pop();
      add(suffix);
    }
  });
  return keys;
}

function hasVisitedRegion(featureKeys, visitedKeys) {
  for (const featureKey of featureKeys) {
    if (visitedKeys.has(featureKey)) return true;
  }

  const featureWords = [...featureKeys].filter((key) => key.length > 3);
  const visitedWords = [...visitedKeys].filter((key) => key.length > 3);
  return featureWords.some((featureKey) =>
    visitedWords.some(
      (visitedKey) => featureKey.includes(visitedKey) || visitedKey.includes(featureKey)
    )
  );
}

/** Flies to a country's outline whenever the selected country changes. */
function CountryFlyer({ geo, iso3 }) {
  const map = useMap();

  useEffect(() => {
    if (!geo || !iso3) return;
    const feature = geo.features.find((f) => f.properties.iso3 === iso3);
    if (!feature) return;
    try {
      const bounds = L.geoJSON(feature).getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [40, 40], duration: 1.1, maxZoom: 6 });
      }
    } catch {
      /* ignore malformed geometry */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso3]);

  return null;
}

/** Imperatively pans/zooms the map whenever `target` changes. */
function FlyController({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    if (target.type === 'bounds' && target.bounds) {
      map.flyToBounds(target.bounds, { padding: [40, 40], duration: 1.1, maxZoom: 6 });
    } else if (target.type === 'point' && target.center) {
      map.flyTo(target.center, target.zoom || 8, { duration: 1.1 });
    } else if (target.type === 'world') {
      map.flyTo([20, 0], 2, { duration: 1.1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return null;
}

export default function WorldMap({
  visitedCountries, // Set<string> of ISO alpha-3 codes
  visitedStates, // array of place docs with type 'state'
  visitedCities, // array of place docs with type 'city'
  countryMeta, // { byNumeric, byAlpha2, byAlpha3 }
  selectedCountry, // { iso3, name } | null
  activeTab, // which sidebar tab is active: drives what map clicks select
  flyTarget,
  onCountryClick,
  onStateClick,
  onCityRemove,
  onBackToWorld,
}) {
  const [worldGeo, setWorldGeo] = useState(null);
  const [stateGeo, setStateGeo] = useState(null);
  const [stateStatus, setStateStatus] = useState('idle'); // idle | loading | ready | unavailable

  // Load the world country outlines once.
  useEffect(() => {
    let active = true;
    fetch(WORLD_TOPOJSON_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (!active) return;
        const geo = topojson.feature(topo, topo.objects.countries);
        setWorldGeo(geo);
      })
      .catch(() => setWorldGeo(null));
    return () => {
      active = false;
    };
  }, []);

  // Attach ISO alpha-3 codes to each country feature once metadata is ready.
  const decoratedWorldGeo = useMemo(() => {
    if (!worldGeo || !countryMeta?.byNumeric) return worldGeo;
    return {
      ...worldGeo,
      features: worldGeo.features.map((f) => {
        const info = countryMeta.byNumeric[parseInt(f.id, 10)];
        return {
          ...f,
          properties: {
            ...f.properties,
            iso3: info?.cca3 || null,
          },
        };
      }),
    };
  }, [worldGeo, countryMeta]);

  // States/Cities tabs let you "drill into" a country to work with its regions.
  const drillTab = activeTab === 'states' || activeTab === 'cities';

  const visibleWorldGeo = useMemo(() => {
    if (!decoratedWorldGeo || !drillTab || !selectedCountry?.iso3) return decoratedWorldGeo;
    return {
      ...decoratedWorldGeo,
      features: decoratedWorldGeo.features.filter(
        (feature) => feature.properties?.iso3 !== selectedCountry.iso3
      ),
    };
  }, [decoratedWorldGeo, drillTab, selectedCountry]);

  // Fetch state/province boundaries (free geoBoundaries API) for the selected country.
  useEffect(() => {
    if (!selectedCountry?.iso3) {
      setStateGeo(null);
      setStateStatus('idle');
      return;
    }

    let active = true;
    setStateStatus('loading');
    setStateGeo(null);

    fetch(`https://www.geoboundaries.org/api/current/gbOpen/${selectedCountry.iso3}/ADM1/`)
      .then((r) => {
        if (!r.ok) throw new Error('No boundary metadata');
        return r.json();
      })
      .then((meta) => fetch(meta.gjDownloadURL))
      .then((r) => r.json())
      .then((geo) => {
        if (!active) return;
        setStateGeo(geo);
        setStateStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStateGeo(null);
        setStateStatus('unavailable');
      });

    return () => {
      active = false;
    };
  }, [selectedCountry]);

  const countryStyle = useCallback(
    (feature) => {
      const iso3 = feature.properties.iso3;
      const isVisited = iso3 && visitedCountries.has(iso3);
      return {
        fillColor: isVisited ? COLORS.visited : COLORS.unvisited,
        fillOpacity: isVisited ? 0.75 : 0.35,
        color: COLORS.border,
        weight: 0.6,
        opacity: 0.9,
      };
    },
    [visitedCountries]
  );

  const onEachCountry = useCallback(
    (feature, layer) => {
      layer.on({
        click: () => onCountryClick(feature, layer),
        mouseover: (e) => e.target.setStyle({ weight: 2, fillOpacity: 0.85 }),
        mouseout: (e) => e.target.setStyle(countryStyle(feature)),
      });
      if (feature.properties?.name) {
        layer.bindTooltip(feature.properties.name, { sticky: true, className: 'wp-tooltip' });
      }
    },
    [onCountryClick, countryStyle]
  );

  const selectedCountryCodes = useMemo(() => {
    if (!selectedCountry?.iso3) return new Set();
    const codes = new Set([selectedCountry.iso3.toUpperCase()]);
    const alpha2 = countryMeta?.byAlpha3?.[selectedCountry.iso3]?.cca2;
    if (alpha2) codes.add(alpha2.toUpperCase());
    return codes;
  }, [selectedCountry, countryMeta]);

  // Keys for visited states/provinces *within the currently selected country*.
  // Search results and map clicks may store slightly different identifiers, so
  // match against both the visible name and any saved region code.
  const visitedStateKeys = useMemo(() => {
    const set = new Set();
    visitedStates.forEach((s) => {
      if (selectedCountryCodes.has(String(s.countryCode || '').toUpperCase())) {
        regionKeys(s.name, s.stateCode, s.stateName).forEach((key) => set.add(key));
      }
    });
    return set;
  }, [visitedStates, selectedCountryCodes]);

  const stateStyle = useCallback(
    (feature) => {
      const featureKeys = regionKeys(
        feature.properties?.shapeName,
        feature.properties?.shapeISO,
        feature.properties?.shapeID
      );
      const isVisited = hasVisitedRegion(featureKeys, visitedStateKeys);
      return {
        fillColor: isVisited ? COLORS.visitedState : COLORS.base,
        fillOpacity: isVisited ? 0.8 : 0,
        color: COLORS.border,
        weight: 1,
        opacity: 0.9,
      };
    },
    [visitedStateKeys]
  );

  const onEachState = useCallback(
    (feature, layer) => {
      // Only the States tab toggles a region visited on click; in the Cities
      // tab the regions are shown purely as context for dropping city pins.
      if (activeTab === 'states') {
        layer.on('click', () => {
          const center = layer.getBounds().getCenter();
          onStateClick({
            countryCode: selectedCountry.iso3,
            countryName: selectedCountry.name,
            name: feature.properties?.shapeName || 'Unknown region',
            stateCode: feature.properties?.shapeISO || feature.properties?.shapeName,
            lat: center.lat,
            lng: center.lng,
          });
        });
      }
      layer.on({
        mouseover: (e) => e.target.setStyle({ weight: 2, fillOpacity: 0.85 }),
        mouseout: (e) => e.target.setStyle(stateStyle(feature)),
      });
      if (feature.properties?.shapeName) {
        layer.bindTooltip(feature.properties.shapeName, { sticky: true, className: 'wp-tooltip' });
      }
    },
    [onStateClick, selectedCountry, stateStyle, activeTab]
  );

  const worldKey = useMemo(
    () =>
      `world-${activeTab}-${selectedCountry?.iso3 || 'none'}-${[
        ...visitedCountries,
      ].sort().join(',')}`,
    [activeTab, selectedCountry, visitedCountries]
  );
  const stateKey = useMemo(
    () => `states-${activeTab}-${selectedCountry?.iso3}-${[...visitedStateKeys].sort().join(',')}`,
    [activeTab, selectedCountry, visitedStateKeys]
  );
  const visibleCities = useMemo(() => {
    if (activeTab !== 'cities') return [];
    if (!selectedCountry?.iso3) return visitedCities;
    return visitedCities.filter((city) => city.countryCode === selectedCountry.iso3);
  }, [activeTab, selectedCountry, visitedCities]);

  return (
    <div className="wp-map">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={10}
        worldCopyJump
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {visibleWorldGeo && (
          <GeoJSON key={worldKey} data={visibleWorldGeo} style={countryStyle} onEachFeature={onEachCountry} />
        )}

        {drillTab && stateGeo && (
          <GeoJSON key={stateKey} data={stateGeo} style={stateStyle} onEachFeature={onEachState} />
        )}

        {visibleCities.map((city) => (
          <Marker key={city._id} position={[city.lat, city.lng]} icon={cityIcon}>
            <Popup>
              <div className="wp-popup">
                <strong>{city.name}</strong>
                <div className="wp-popup-sub">
                  {[city.stateName, city.countryName].filter(Boolean).join(', ')}
                </div>
                <button className="wp-popup-remove" onClick={() => onCityRemove(city)}>
                  Remove pin
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        <CountryFlyer geo={decoratedWorldGeo} iso3={selectedCountry?.iso3} />
        <FlyController target={flyTarget} />
      </MapContainer>

      {selectedCountry && (
        <div className="wp-map-banner">
          <span>
            Exploring <strong>{selectedCountry.name}</strong>
            {drillTab && stateStatus === 'loading' && ' — loading regions…'}
            {drillTab &&
              stateStatus === 'unavailable' &&
              ' — no region data available for this country'}
          </span>
          <button onClick={onBackToWorld}>← World map</button>
        </div>
      )}

      <div className="wp-legend">
        <div className="wp-legend-item">
          <span
            className="wp-legend-swatch"
            style={{ background: drillTab ? COLORS.visitedState : COLORS.visited }}
          />
          {drillTab ? 'Visited state' : 'Visited'}
        </div>
        <div className="wp-legend-item">
          <span className="wp-legend-swatch" style={{ background: COLORS.unvisited }} />
          Not yet
        </div>
        <div className="wp-legend-item">
          <span className="wp-city-marker-preview" />
          City pin
        </div>
      </div>
    </div>
  );
}
