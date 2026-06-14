import React from 'react';

const EMPTY_COPY = {
  country: 'Click any country on the map to stamp it as visited.',
  state: 'Select a country, then click a region inside it.',
  city: 'Search for a city above and pick it from the results to drop a pin.',
};

const TYPE_LABEL = {
  country: 'countries',
  state: 'states & provinces',
  city: 'cities',
};

export default function PlaceList({ items, type, onRemove }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <p>No {TYPE_LABEL[type]} marked yet.</p>
        <p className="empty-hint">{EMPTY_COPY[type]}</p>
      </div>
    );
  }

  return (
    <ul className="place-list">
      {items.map((item) => (
        <li key={item._id} className="place-card">
          <div className="place-card-main">
            <span className="place-name">{item.name}</span>
            <span className="place-sub">
              {type === 'state' && item.countryName}
              {type === 'city' && [item.stateName, item.countryName].filter(Boolean).join(', ')}
            </span>
          </div>
          <div className="place-card-meta">
            <span className="place-date">{new Date(item.visitedDate).toLocaleDateString()}</span>
            <button
              className="place-remove"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item.name}`}
              title={`Remove ${item.name}`}
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
