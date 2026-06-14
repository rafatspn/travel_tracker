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

  // Names of visited states/provinces *within the currently selected country*,
  // lower-cased for loose matching against geoBoundaries' shapeName field.
  const visitedStateNames = useMemo(() => {
    const set = new Set();
    visitedStates.forEach((s) => {
      if (s.countryCode === selectedCountry?.iso3) {
        set.add(s.name.toLowerCase().trim());
      }
    });
    return set;
  }, [visitedStates, selectedCountry]);

  const stateStyle = useCallback(
    (feature) => {
      const name = (feature.properties?.shapeName || '').toLowerCase().trim();
      const isVisited = visitedStateNames.has(name);
      return {
        fillColor: isVisited ? COLORS.visited : COLORS.base,
        fillOpacity: isVisited ? 0.8 : 0.25,
        color: COLORS.border,
        weight: 1,
        opacity: 0.9,
      };
    },
    [visitedStateNames]
  );

  const onEachState = useCallback(
    (feature, layer) => {
      layer.on({
        click: () => {
          const center = layer.getBounds().getCenter();
          onStateClick({
            countryCode: selectedCountry.iso3,
            countryName: selectedCountry.name,
            name: feature.properties?.shapeName || 'Unknown region',
            stateCode: feature.properties?.shapeISO || feature.properties?.shapeName,
            lat: center.lat,
            lng: center.lng,
          });
        },
        mouseover: (e) => e.target.setStyle({ weight: 2, fillOpacity: 0.85 }),
        mouseout: (e) => e.target.setStyle(stateStyle(feature)),
      });
      if (feature.properties?.shapeName) {
        layer.bindTooltip(feature.properties.shapeName, { sticky: true, className: 'wp-tooltip' });
      }
    },
    [onStateClick, selectedCountry, stateStyle]
  );

  const worldKey = useMemo(() => `world-${[...visitedCountries].sort().join(',')}`, [visitedCountries]);
  const stateKey = useMemo(
    () => `states-${selectedCountry?.iso3}-${[...visitedStateNames].sort().join(',')}`,
    [selectedCountry, visitedStateNames]
  );

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

        {decoratedWorldGeo && (
          <GeoJSON key={worldKey} data={decoratedWorldGeo} style={countryStyle} onEachFeature={onEachCountry} />
        )}

        {activeTab === 'states' && stateGeo && (
          <GeoJSON key={stateKey} data={stateGeo} style={stateStyle} onEachFeature={onEachState} />
        )}

        {visitedCities.map((city) => (
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

        <FlyController target={flyTarget} />
      </MapContainer>

      {selectedCountry && (
        <div className="wp-map-banner">
          <span>
            Exploring <strong>{selectedCountry.name}</strong>
            {activeTab === 'states' && stateStatus === 'loading' && ' — loading regions…'}
            {activeTab === 'states' &&
              stateStatus === 'unavailable' &&
              ' — no region data available for this country'}
          </span>
          <button onClick={onBackToWorld}>← World map</button>
        </div>
      )}

      <div className="wp-legend">
        <div className="wp-legend-item">
          <span className="wp-legend-swatch" style={{ background: COLORS.visited }} />
          Visited
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
