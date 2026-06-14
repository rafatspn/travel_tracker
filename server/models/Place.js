const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema(
  {
    // What kind of place this is
    type: {
      type: String,
      enum: ['country', 'state', 'city'],
      required: true,
    },

    // Display name (country name, state/province name, or city name)
    name: { type: String, required: true, trim: true },

    // ISO 3166-1 alpha-3 code for the country this place belongs to (e.g. "USA")
    countryCode: { type: String, required: true, trim: true, uppercase: true },
    countryName: { type: String, required: true, trim: true },

    // Only set for type === 'state' or type === 'city'
    stateCode: { type: String, default: null, trim: true },
    stateName: { type: String, default: null, trim: true },

    // Coordinates - required for cities (used to place a marker),
    // optional for countries/states (used as a fallback "fly to" point)
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },

    visitedDate: { type: Date, default: Date.now },
    notes: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

// Prevent the exact same place from being saved twice
placeSchema.index(
  { type: 1, name: 1, countryCode: 1, stateCode: 1 },
  { unique: true }
);

module.exports = mongoose.model('Place', placeSchema);
