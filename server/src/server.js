require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const port = Number(process.env.PORT) || 5000;
async function start() {
  try {
    await connectDB();
    const server = app.listen(port, () => console.log(`Bugsbon HRMS API running at http://localhost:${port}`));
    const shutdown = signal => { console.log(`${signal} received; closing server.`); server.close(async () => { const mongoose = require('mongoose'); await mongoose.disconnect(); process.exit(0); }); setTimeout(() => process.exit(1), 10000).unref(); };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) { console.error('Unable to start API:', err.message); process.exit(1); }
}
start();
