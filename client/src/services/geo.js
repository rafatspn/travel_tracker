import axios from 'axios';

const REST_COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,ccn3,flag';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Fetches country reference data from the free REST Countries API and builds
 * lookup tables we need to translate between the different code systems used
 * by world-atlas (numeric ISO codes), geoBoundaries (alpha-3) and Nominatim
 * (alpha-2).
 */
export async function fetchCountryMeta() {
  const { data } = await axios.get(REST_COUNTRIES_URL);

  const byNumeric = {};
  const byAlpha2 = {};
  const byAlpha3 = {};

  data.forEach((c) => {
    const entry = {
      cca2: c.cca2,
      cca3: c.cca3,
      name: c.name?.common,
      flag: c.flag,
    };
    if (c.ccn3) byNumeric[parseInt(c.ccn3, 10)] = entry;
    if (c.cca2) byAlpha2[c.cca2] = entry;
    if (c.cca3) byAlpha3[c.cca3] = entry;
  });

  return { byNumeric, byAlpha2, byAlpha3 };
}

/**
 * Searches OpenStreetMap's free Nominatim geocoder for a place name.
 * Returns the raw Nominatim results.
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];

  const { data } = await axios.get(NOMINATIM_URL, {
    params: {
      q: query,
      format: 'json',
      addressdetails: 1,
      limit: 6,
      'accept-language': 'en',
    },
  });

  return data;
}

const STATE_TYPES = new Set(['state', 'province', 'region', 'state_district']);

/**
 * Turns a raw Nominatim search result into a normalised shape describing
 * whether it represents a country, a state/province, or a city - along with
 * the identifiers needed to save it to the backend.
 */
export function classifyResult(result, countryMeta) {
  const addr = result.address || {};
  const addressType = result.addresstype;
  const countryAlpha2 = (addr.country_code || '').toUpperCase();
  const countryInfo = countryMeta?.byAlpha2?.[countryAlpha2];

  const base = {
    raw: result,
    displayName: result.display_name,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    countryName: addr.country || countryInfo?.name || '',
    countryCode: countryInfo?.cca3 || countryAlpha2,
  };

  const hasSubCountryDetail = Boolean(
    addr.city || addr.town || addr.village || addr.municipality || addr.county
  );

  if (addressType === 'country' || (addr.country && !addr.state && !hasSubCountryDetail)) {
    return { kind: 'country', ...base, name: base.countryName };
  }

  if (STATE_TYPES.has(addressType) || (addr.state && !hasSubCountryDetail)) {
    const name = addr.state || addr.region || result.display_name.split(',')[0];
    return { kind: 'state', ...base, name, stateName: name, stateCode: name };
  }

  const name =
    addr.city || addr.town || addr.village || addr.municipality || addr.county ||
    result.display_name.split(',')[0];

  return {
    kind: 'city',
    ...base,
    name,
    stateName: addr.state || addr.region || null,
  };
}
