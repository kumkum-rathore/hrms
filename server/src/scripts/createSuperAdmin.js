require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
async function run() {
  const firstName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!firstName || !email || !password) throw new Error('Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD temporarily in .env.');
  if (password.length < 12 || password.length > 128) throw new Error('Password must be 12–128 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide a valid email address.');
  await connectDB();
  if (await User.exists({ role: 'SUPER_ADMIN' })) throw new Error('A Super Admin already exists; bootstrap stopped.');
  if (await User.exists({ email })) throw new Error('This email already belongs to an account.');
  const user = await User.create({ firstName, email, passwordHash: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN', status: 'ACTIVE', joiningDate: new Date() });
  console.log(`Super Admin created: ${user.email} (${user._id})`);
}
run().catch(err => { console.error('Bootstrap failed:', err.message); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect().catch(() => {}); });
