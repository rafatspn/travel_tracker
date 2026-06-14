require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const placesRouter = require('./routes/places');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Waypoint API is running' });
});

app.use('/api/places', placesRouter);

// Fallback for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Waypoint API listening on port ${PORT}`));
});
