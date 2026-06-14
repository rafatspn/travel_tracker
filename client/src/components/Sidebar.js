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

export default function Sidebar({ activeTab, setActiveTab, places, countryMeta, onSearchSelect, onRemove }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  // States/Cities tabs only search inside countries the user has already
  // visited; Countries tab searches the whole world.
  const restrictToVisited = activeTab === 'states' || activeTab === 'cities';

  // Lower-case alpha-2 codes of visited countries, used to scope the geocoder.
  const visitedCountryCodes = useMemo(() => {
    if (!countryMeta?.byAlpha3) return [];
    return places.country
      .map((p) => countryMeta.byAlpha3[p.countryCode]?.cca2)
      .filter(Boolean)
      .map((c) => c.toLowerCase());
  }, [places.country, countryMeta]);

  const noVisitedCountries = restrictToVisited && visitedCountryCodes.length === 0;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2 || noVisitedCountries) {
      setResults([]);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const raw = await searchPlaces(
          query,
          restrictToVisited ? { countryCodes: visitedCountryCodes } : {}
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
  }, [query, countryMeta, activeTab, restrictToVisited, visitedCountryCodes, noVisitedCountries]);

  const handleSelect = (result) => {
    onSearchSelect(result);
    setQuery('');
    setResults([]);
  };

  return (
    <aside className="sidebar">
      <div className="search-box">
        <input
          type="text"
          placeholder={
            activeTab === 'states'
              ? 'Search a state in your visited countries…'
              : activeTab === 'cities'
              ? 'Search a city in your visited countries…'
              : 'Search any country, state or city…'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search for a place"
        />
        {searching && <div className="search-status">Searching…</div>}
        {noVisitedCountries && (
          <div className="search-status">
            Mark a country as visited first to search its{' '}
            {activeTab === 'states' ? 'states' : 'cities'}.
          </div>
        )}
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

      <div className="tab-content">
        {activeTab === 'countries' && <PlaceList items={places.country} type="country" onRemove={onRemove} />}
        {activeTab === 'states' && <PlaceList items={places.state} type="state" onRemove={onRemove} />}
        {activeTab === 'cities' && <PlaceList items={places.city} type="city" onRemove={onRemove} />}
        {activeTab === 'stats' && <Stats places={places} />}
      </div>
    </aside>
  );
}
