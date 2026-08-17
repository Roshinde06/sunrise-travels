require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./src/config/db');
const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// ----------------------------------------------------------------------
// Global crash handlers.
// A 502 Bad Gateway from the Vite proxy (/api -> localhost:5000) happens
// when this process is down or dies mid-request. Without these handlers,
// an unhandled promise rejection silently kills the process (Node >= 15)
// and every subsequent request fails with a proxy 502. Log the real error
// to the terminal and keep the server alive instead.
// ----------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] The request that caused this should now return a clean 500. Root cause:');
  console.error(reason instanceof Error ? reason.stack : reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Unexpected error — server kept alive. Root cause:');
  console.error(err.stack || err);
});

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Sunrise API running on http://localhost:${PORT}  (health: http://localhost:${PORT}/api/health)`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('The backend will not start, so the frontend proxy (/api -> localhost:5000) will return 502 for every API call. Check MONGODB_URI in backend/.env');
    process.exit(1);
  });
