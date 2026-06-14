import React from 'react';

// UN recognises 195 sovereign states; used as the denominator for "world covered".
const TOTAL_COUNTRIES = 195;

export default function Stats({ places }) {
  const countryCount = places.country.length;
  const countryPct = Math.min(100, Math.round((countryCount / TOTAL_COUNTRIES) * 100));

  const countriesWithStates = new Set(places.state.map((s) => s.countryCode)).size;

  return (
    <div className="stats">
      <div className="stat-card">
        <span className="stat-number">{countryCount}</span>
        <span className="stat-label">of {TOTAL_COUNTRIES} countries</span>
        <div className="stat-bar">
          <div className="stat-bar-fill" style={{ width: `${countryPct}%` }} />
        </div>
        <span className="stat-pct">{countryPct}% of the world</span>
      </div>

      <div className="stat-row">
        <div className="stat-card small">
          <span className="stat-number">{places.state.length}</span>
          <span className="stat-label">states / provinces</span>
        </div>
        <div className="stat-card small">
          <span className="stat-number">{places.city.length}</span>
          <span className="stat-label">cities</span>
        </div>
      </div>

      <div className="stat-card small">
        <span className="stat-number">{countriesWithStates}</span>
        <span className="stat-label">countries explored region-by-region</span>
      </div>
    </div>
  );
}
