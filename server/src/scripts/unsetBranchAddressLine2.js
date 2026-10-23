require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Branch = require('../models/Branch');

async function run() {
  try {
    await connectDB();
    const result = await Branch.collection.updateMany(
      { 'address.line2': { $exists: true } },
      { $unset: { 'address.line2': '' } }
    );
    console.log(`Removed address.line2 from ${result.modifiedCount} branch record(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(error => {
  console.error('Branch address cleanup failed:', error.message);
  process.exitCode = 1;
});
