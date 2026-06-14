# Waypoint — Your Personal Travel Map

Waypoint is a self-hosted MERN (MongoDB, Express, React, Node) app for tracking
every **country**, **state/province**, and **city** you've visited on an
interactive world map. Click a country to mark it visited and zoom in to its
regions, click a region to mark it too, or use the search bar to jump straight
to any place on Earth and drop a pin.

Everything runs on free services and free, key-free public APIs, so you can
deploy your own copy at no cost.

## Features

- **Interactive world map** (Leaflet) — countries are shaded once you mark
  them visited.
- **Drill into states/provinces** — click a visited (or unvisited) country to
  load its regions and mark the ones you've been to.
- **City pins** — search for any city and drop a pin on the map.
- **Universal search** — one search box (powered by OpenStreetMap) finds
  countries, regions, and cities and routes the result to the right place.
- **Tabs & stats** — browse everything you've logged by category, plus a
  "percent of the world visited" tracker.
- **Persisted to MongoDB** via a small Express API, so your map is the same
  every time you open it.

## Tech stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, react-leaflet / Leaflet, topojson-client, axios |
| Backend  | Node.js, Express, Mongoose |
| Database | MongoDB (MongoDB Atlas free tier recommended) |

## Free APIs & data used

No API keys required for any of these:

- **[OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)** —
  geocoding for the search bar (finds countries, regions, cities and their
  coordinates).
- **[CARTO Voyager basemap tiles](https://carto.com/basemaps)** — the map's
  tile layer (built on OpenStreetMap data).
- **[world-atlas](https://github.com/topojson/world-atlas)** (via jsDelivr CDN)
  — 110m-resolution country boundary outlines.
- **[REST Countries](https://restcountries.com/)** — country names and
  ISO code lookups (used to translate between the numeric codes in the world
  atlas data and the alpha-3 codes geoBoundaries expects).
- **[geoBoundaries](https://www.geoboundaries.org/)** — free ADM1
  (state/province) boundary data, fetched per-country on demand.

## Project structure

```
travel-tracker/
├── server/                # Express API
│   ├── config/db.js       # MongoDB connection
│   ├── models/Place.js    # Mongoose schema for a visited place
│   ├── routes/places.js   # CRUD routes for /api/places
│   ├── server.js           # App entry point
│   └── .env.example
└── client/                # React app
    ├── public/index.html
    └── src/
        ├── App.js          # Top-level state & API wiring
        ├── components/
        │   ├── Header.js
        │   ├── WorldMap.js # Leaflet map, country/state layers, city pins
        │   ├── Sidebar.js  # Search bar + tabs
        │   ├── PlaceList.js
        │   └── Stats.js
        ├── services/
        │   ├── api.js      # axios client for the backend
        │   └── geo.js      # country metadata + Nominatim search helpers
        └── .env.example
```

## Local setup

You'll need [Node.js 18+](https://nodejs.org/) and either a local MongoDB
instance or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
cluster.

### 1. Backend

```bash
cd server
cp .env.example .env
# edit .env and set MONGO_URI (see MongoDB Atlas setup below)
npm install
npm run dev   # starts the API on http://localhost:5000
```

### 2. Frontend

In a second terminal:

```bash
cd client
cp .env.example .env
# REACT_APP_API_URL defaults to http://localhost:5000/api, which matches the
# backend above — only change it if your API runs somewhere else.
npm install
npm start     # opens http://localhost:3000
```

Open `http://localhost:3000` and start clicking on the map.

## Setting up a free MongoDB Atlas database

1. Create a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new **free (M0) cluster**.
3. Under **Database Access**, add a database user with a username and password.
4. Under **Network Access**, add an IP entry of `0.0.0.0/0` (allow access from
   anywhere) — fine for a small personal project deployed to a free host.
5. Click **Connect** on your cluster, choose **Drivers**, and copy the
   connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
   ```
6. Paste it into `server/.env` as `MONGO_URI`, adding a database name before
   the `?`, e.g. `.../waypoint?retryWrites=true&w=majority`.

## Deploying for free

### Backend → Render

1. Push this repo to GitHub.
2. On [Render](https://render.com), create a new **Web Service** from your
   repo, with:
   - **Root directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
3. Add environment variables in the Render dashboard:
   - `MONGO_URI` — your Atlas connection string
   - `CLIENT_ORIGIN` — the URL of your deployed frontend (you can update this
     after the frontend is deployed)
4. Deploy. Render gives you a URL like `https://waypoint-api.onrender.com`.

Render's free web service requires no credit card, but it spins down after 15
minutes of inactivity — the first request after a quiet period can take
30-60 seconds while it wakes back up. That's a non-issue for a personal
project; it just means the first map load of the day is slower.

### Frontend → Vercel / Cloudflare Pages / Netlify

1. Create a new project from the same GitHub repo, with:
   - **Root directory:** `client`
   - **Build command:** `npm run build`
   - **Output directory:** `build`
2. Add an environment variable:
   - `REACT_APP_API_URL` — your Render API URL plus `/api`, e.g.
     `https://waypoint-api.onrender.com/api`
3. Deploy, then go back to Render and set `CLIENT_ORIGIN` to your new
   frontend URL so CORS allows requests from it.

Any of these three work well for a CRA build and are free for personal
projects — Vercel and Cloudflare Pages are usually the quickest to set up.
Plain GitHub Pages can host the build too, but you'd need the `gh-pages`
package and a bit more manual configuration to inject the `REACT_APP_API_URL`
at build time.

## Environment variables reference

**server/.env**

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `PORT` | Port for the Express server (default `5000`) |
| `CLIENT_ORIGIN` | Frontend URL, used for CORS |

**client/.env**

| Variable | Description |
|---|---|
| `REACT_APP_API_URL` | Base URL of the backend API, including `/api` |

## Known limitations

- **State/region name matching**: visited countries and visited states are
  matched by name between two independent free datasets (Nominatim's address
  results and geoBoundaries' `shapeName`). Most major regions match cleanly,
  but unusual spellings or translations may occasionally not highlight on the
  map even though they're saved and listed in the **States** tab.
- **Small countries / territories**: geoBoundaries doesn't publish ADM1 data
  for every micro-state (e.g. Monaco, Vatican City). For these, the map shows
  "no region data available" — the country itself can still be marked
  visited.
- **Disputed territories**: a handful of features in the world boundary data
  don't have a standard ISO code and can't be marked visited from the map.
- **Nominatim rate limits**: the search bar is debounced to respect
  Nominatim's free-tier usage policy (~1 request/second). If you expect heavy
  use, consider self-hosting Nominatim or switching to a paid geocoder.

## License

MIT — do whatever you'd like with this for your own travel map.
