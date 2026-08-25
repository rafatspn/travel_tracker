import React from 'react';

// UN recognises 195 sovereign states; used as the denominator for "world covered".
const TOTAL_COUNTRIES = 195;

export default function Stats({ places, selectedCountry }) {
  const scopedStates = selectedCountry
    ? places.state.filter((s) => s.countryCode === selectedCountry.iso3)
    : places.state;
  const scopedCities = selectedCountry
    ? places.city.filter((c) => c.countryCode === selectedCountry.iso3)
    : places.city;

  const countryCount = places.country.length;
  const countryPct = Math.min(100, Math.round((countryCount / TOTAL_COUNTRIES) * 100));

  const countriesWithStates = selectedCountry
    ? scopedStates.length > 0
      ? 1
      : 0
    : new Set(places.state.map((s) => s.countryCode)).size;
  const scopeLabel = selectedCountry ? `in ${selectedCountry.name}` : null;

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
          <span className="stat-number">{scopedStates.length}</span>
          <span className="stat-label">
            states / provinces{scopeLabel ? ` ${scopeLabel}` : ''}
          </span>
        </div>
        <div className="stat-card small">
          <span className="stat-number">{scopedCities.length}</span>
          <span className="stat-label">cities{scopeLabel ? ` ${scopeLabel}` : ''}</span>
        </div>
      </div>

      <div className="stat-card small">
        <span className="stat-number">{countriesWithStates}</span>
        <span className="stat-label">countries explored region-by-region</span>
      </div>
    </div>
  );
}
