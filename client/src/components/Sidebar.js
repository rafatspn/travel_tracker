import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchPlaces, classifyResult } from '../services/geo';
import PlaceList from './PlaceList';
import Stats from './Stats';
import './Sidebar.css';

const TABS = [
  { id: 'countries', label: 'Countries', placeType: 'country' },
  { id: 'states', label: 'States', placeType: 'state' },
  { id: 'cities', label: 'Cities', placeType: 'city' },
  { id: 'stats', label: 'Stats', placeType: null },
];

// Respect Nominatim's usage policy of ~1 request/second.
const SEARCH_DEBOUNCE_MS = 600;

export default function Sidebar({
  activeTab,
  setActiveTab,
  places,
  countryMeta,
  selectedCountry,
  onSelectCountry,
  onSearchSelect,
  onRemove,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  // States/Cities tabs first ask you to pick one of your visited countries,
  // then scope both the search and the list to that single country.
  const needsPicker = activeTab === 'states' || activeTab === 'cities';

  // Lower-case alpha-2 code of the picked country, used to scope the geocoder.
  const selectedAlpha2 = useMemo(() => {
    if (!selectedCountry?.iso3 || !countryMeta?.byAlpha3) return null;
    const a2 = countryMeta.byAlpha3[selectedCountry.iso3]?.cca2;
    return a2 ? a2.toLowerCase() : null;
  }, [selectedCountry, countryMeta]);

  // The search bar only appears once there's something to search: any place on
  // the Countries tab, or a chosen country on the States/Cities tabs.
  const canSearch = activeTab === 'countries' || (needsPicker && !!selectedCountry);

  // Reset the in-progress query whenever the search context changes so stale
  // results from a different tab/country don't linger.
  useEffect(() => {
    setQuery('');
    setResults([]);
  }, [activeTab, selectedCountry]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2 || !canSearch) {
      setResults([]);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const raw = await searchPlaces(
          query,
          needsPicker && selectedAlpha2 ? { countryCodes: [selectedAlpha2] } : {}
        );
        let classified = raw.map((r) => classifyResult(r, countryMeta));
        if (activeTab === 'states') classified = classified.filter((r) => r.kind === 'state');
        else if (activeTab === 'cities') classified = classified.filter((r) => r.kind === 'city');
        setResults(classified);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query, countryMeta, activeTab, needsPicker, canSearch, selectedAlpha2]);

  const handleSelect = (result) => {
    onSearchSelect(result);
    setQuery('');
    setResults([]);
  };

  const handlePick = (e) => {
    const iso3 = e.target.value;
    if (!iso3) {
      onSelectCountry(null);
      return;
    }
    const c = places.country.find((p) => p.countryCode === iso3);
    onSelectCountry(c ? { iso3: c.countryCode, name: c.name } : null);
  };

  // Items shown in the list below: scoped to the picked country on the
  // States/Cities tabs, the full set on the Countries tab.
  const listItems = useMemo(() => {
    if (activeTab === 'states') {
      return selectedCountry
        ? places.state.filter((p) => p.countryCode === selectedCountry.iso3)
        : [];
    }
    if (activeTab === 'cities') {
      return selectedCountry
        ? places.city.filter((p) => p.countryCode === selectedCountry.iso3)
        : [];
    }
    return places.country;
  }, [activeTab, places, selectedCountry]);

  const searchPlaceholder =
    activeTab === 'states'
      ? `Search a state in ${selectedCountry?.name || 'this country'}…`
      : activeTab === 'cities'
      ? `Search a city in ${selectedCountry?.name || 'this country'}…`
      : 'Search any country, state or city…';

  const noVisitedCountries = needsPicker && places.country.length === 0;

  return (
    <aside className="sidebar">
      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.placeType && <span className="tab-count">{places[tab.placeType].length}</span>}
          </button>
        ))}
      </nav>

      {needsPicker && (
        <div className="country-picker">
          {noVisitedCountries ? (
            <p className="picker-hint">
              Mark a country as visited first (on the Countries tab) to add its{' '}
              {activeTab === 'states' ? 'states' : 'cities'}.
            </p>
          ) : (
            <select
              value={selectedCountry?.iso3 || ''}
              onChange={handlePick}
              aria-label="Choose a visited country"
            >
              <option value="">Choose a country you&apos;ve visited…</option>
              {places.country.map((c) => (
                <option key={c.countryCode} value={c.countryCode}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {canSearch && (
        <div className="search-box">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search for a place"
          />
          {searching && <div className="search-status">Searching…</div>}
          {results.length > 0 && (
            <ul className="search-results">
              {results.map((r, i) => (
                <li key={`${r.kind}-${r.displayName}-${i}`} onClick={() => handleSelect(r)}>
                  <span className="result-name">{r.name}</span>
                  <span className={`result-kind kind-${r.kind}`}>{r.kind}</span>
                  <span className="result-sub">{r.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="tab-content">
        {activeTab === 'countries' && (
          <PlaceList items={listItems} type="country" onRemove={onRemove} />
        )}
        {activeTab === 'states' &&
          (selectedCountry ? (
            <PlaceList items={listItems} type="state" onRemove={onRemove} />
          ) : (
            <div className="empty-state">
              <p>Pick a country above</p>
              <p className="empty-hint">Choose one of your visited countries to see and add its states.</p>
            </div>
          ))}
        {activeTab === 'cities' &&
          (selectedCountry ? (
            <PlaceList items={listItems} type="city" onRemove={onRemove} />
          ) : (
            <div className="empty-state">
              <p>Pick a country above</p>
              <p className="empty-hint">Choose one of your visited countries to see and add its cities.</p>
            </div>
          ))}
        {activeTab === 'stats' && <Stats places={places} />}
      </div>
    </aside>
  );
}
