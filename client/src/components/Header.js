import React from 'react';

export default function Header({ countryCount, stateCount, cityCount }) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          ✦
        </span>
        <div>
          <h1>Waypoint</h1>
          <p>Your personal world map</p>
        </div>
      </div>

      <div className="header-stats">
        <div className="header-stat">
          <strong>{countryCount}</strong>
          <span>Countries</span>
        </div>
        <div className="header-stat">
          <strong>{stateCount}</strong>
          <span>Regions</span>
        </div>
        <div className="header-stat">
          <strong>{cityCount}</strong>
          <span>Cities</span>
        </div>
      </div>
    </header>
  );
}
