import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Header from './components/Header';
import WorldMap from './components/WorldMap';
import Sidebar from './components/Sidebar';
import api from './services/api';
import { fetchCountryMeta } from './services/geo';
import './App.css';

const EMPTY_PLACES = { country: [], state: [], city: [] };

export default function App() {
  const [places, setPlaces] = useState(EMPTY_PLACES);
  const [countryMeta, setCountryMeta] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('countries');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Initial load: visited places from our API + country reference data from REST Countries.
  useEffect(() => {
    let active = true;

    // Country reference data is best-effort: if it fails the map and saved
    // places should still load, so we keep it separate from the API call and
    // never let it surface the backend error banner.
    const metaPromise = fetchCountryMeta().catch(() => ({
      byNumeric: {},
      byAlpha2: {},
      byAlpha3: {},
    }));

    Promise.all([api.get('/places'), metaPromise])
      .then(([placesRes, meta]) => {
        if (!active) return;
        const grouped = { country: [], state: [], city: [] };
        placesRes.data.forEach((p) => {
          if (grouped[p.type]) grouped[p.type].push(p);
        });
        setPlaces(grouped);
        setCountryMeta(meta);
      })
      .catch(() => {
        if (!active) return;
        setErrorMsg('Could not reach the API. Make sure the backend server is running.');
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const visitedCountrySet = useMemo(
    () => new Set(places.country.map((p) => p.countryCode)),
    [places.country]
  );

  // --- Mutations -----------------------------------------------------------

  const handleCountryClick = useCallback(
    async (feature, layer) => {
      const iso3 = feature?.properties?.iso3;
      const name = feature?.properties?.name;

      if (!iso3) {
        showToast("Sorry, this territory isn't supported yet.");
        return;
      }

      const bounds = layer?.getBounds();
      setSelectedCountry({ iso3, name });
      if (bounds) setFlyTarget({ type: 'bounds', bounds });

      // In the States/Cities tabs a country click only drills in to reveal its
      // regions. The country stays selected and its visited status is untouched.
      if (activeTab === 'states' || activeTab === 'cities') return;

      const existing = places.country.find((p) => p.countryCode === iso3);
      try {
        if (existing) {
          await api.delete(`/places/${existing._id}`);
          setPlaces((prev) => ({
            ...prev,
            country: prev.country.filter((p) => p._id !== existing._id),
          }));
          showToast(`${name} removed from your map.`);
        } else {
          const { data } = await api.post('/places', {
            type: 'country',
            name,
            countryCode: iso3,
            countryName: name,
          });
          setPlaces((prev) => ({ ...prev, country: [data, ...prev.country] }));
          showToast(`${name} marked as visited ✓`);
        }
      } catch {
        showToast('Something went wrong updating that country.');
      }
    },
    [places.country, showToast, activeTab]
  );

  const handleStateClick = useCallback(
    async (stateData) => {
      const existing = places.state.find(
        (p) =>
          p.countryCode === stateData.countryCode &&
          p.name.toLowerCase() === stateData.name.toLowerCase()
      );

      try {
        if (existing) {
          await api.delete(`/places/${existing._id}`);
          setPlaces((prev) => ({
            ...prev,
            state: prev.state.filter((p) => p._id !== existing._id),
          }));
          showToast(`${stateData.name} removed from your map.`);
        } else {
          const { data } = await api.post('/places', {
            type: 'state',
            name: stateData.name,
            countryCode: stateData.countryCode,
            countryName: stateData.countryName,
            stateCode: stateData.stateCode,
            lat: stateData.lat,
            lng: stateData.lng,
          });
          setPlaces((prev) => ({ ...prev, state: [data, ...prev.state] }));
          showToast(`${stateData.name} marked as visited ✓`);
        }
      } catch {
        showToast('Something went wrong updating that region.');
      }
    },
    [places.state, showToast]
  );

  const handleAddCity = useCallback(
    async (cityData) => {
      try {
        const { data } = await api.post('/places', { type: 'city', ...cityData });
        setPlaces((prev) => ({ ...prev, city: [data, ...prev.city] }));
        showToast(`${cityData.name} added to your map ✓`);
      } catch (err) {
        if (err.response?.status === 409) {
          showToast(`${cityData.name} is already on your map.`);
        } else {
          showToast('Something went wrong adding that city.');
        }
      }
    },
    [showToast]
  );

  const handleRemove = useCallback(
    async (place) => {
      try {
        await api.delete(`/places/${place._id}`);
        setPlaces((prev) => ({
          ...prev,
          [place.type]: prev[place.type].filter((p) => p._id !== place._id),
        }));
      } catch {
        showToast('Could not remove that place.');
      }
    },
    [showToast]
  );

  // --- Search ----------------------------------------------------------------

  const handleSearchSelect = useCallback(
    (result) => {
      if (result.kind === 'country') {
        const existing = places.country.find((p) => p.countryCode === result.countryCode);
        if (!existing && result.countryCode) {
          api
            .post('/places', {
              type: 'country',
              name: result.countryName,
              countryCode: result.countryCode,
              countryName: result.countryName,
            })
            .then(({ data }) => {
              setPlaces((prev) => ({ ...prev, country: [data, ...prev.country] }));
              showToast(`${result.countryName} marked as visited ✓`);
            })
            .catch(() => showToast('Something went wrong updating that country.'));
        }
        setSelectedCountry({ iso3: result.countryCode, name: result.countryName });
        setFlyTarget({ type: 'point', center: [result.lat, result.lng], zoom: 5 });
      } else if (result.kind === 'state') {
        setSelectedCountry({ iso3: result.countryCode, name: result.countryName });
        setFlyTarget({ type: 'point', center: [result.lat, result.lng], zoom: 6 });
        handleStateClick({
          countryCode: result.countryCode,
          countryName: result.countryName,
          name: result.stateName,
          stateCode: result.stateCode,
          lat: result.lat,
          lng: result.lng,
        });
      } else {
        handleAddCity({
          name: result.name,
          countryCode: result.countryCode,
          countryName: result.countryName,
          stateName: result.stateName,
          lat: result.lat,
          lng: result.lng,
        });
        setFlyTarget({ type: 'point', center: [result.lat, result.lng], zoom: 9 });
      }
    },
    [places.country, handleStateClick, handleAddCity, showToast]
  );

  const handleBackToWorld = useCallback(() => {
    setSelectedCountry(null);
    setFlyTarget({ type: 'world' });
  }, []);

  if (loading) {
    return <div className="wp-loading">Charting your map…</div>;
  }

  return (
    <div className="app">
      <Header
        countryCount={places.country.length}
        stateCount={places.state.length}
        cityCount={places.city.length}
      />

      {errorMsg && <div className="wp-error-banner">{errorMsg}</div>}

      <div className="app-body">
        <WorldMap
          visitedCountries={visitedCountrySet}
          visitedStates={places.state}
          visitedCities={places.city}
          countryMeta={countryMeta}
          selectedCountry={selectedCountry}
          activeTab={activeTab}
          flyTarget={flyTarget}
          onCountryClick={handleCountryClick}
          onStateClick={handleStateClick}
          onCityRemove={handleRemove}
          onBackToWorld={handleBackToWorld}
        />
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          places={places}
          countryMeta={countryMeta}
          onSearchSelect={handleSearchSelect}
          onRemove={handleRemove}
        />
      </div>

      {toast && <div className="wp-toast">{toast}</div>}
    </div>
  );
}
