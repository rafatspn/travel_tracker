import React, { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const raw = await searchPlaces(query);
        setResults(raw.map((r) => classifyResult(r, countryMeta)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query, countryMeta]);

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
          placeholder="Search any country, state or city…"
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
