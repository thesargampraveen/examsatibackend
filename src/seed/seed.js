// Seed a few sample exam centers so search has data.
// Run: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const ExamCenter = require('../models/ExamCenter');

const CENTERS = [
  { name: 'Modern Public School', code: 'MPS-104', city: 'Delhi', state: 'Delhi', address: 'Sector 12, R.K. Puram, New Delhi' },
  { name: 'St. Xavier Senior Secondary School', code: 'SXJ-208', city: 'Jaipur', state: 'Rajasthan', address: 'Bani Park, Jaipur' },
  { name: 'Kendriya Vidyalaya No. 2', code: 'KV2-311', city: 'Pune', state: 'Maharashtra', address: 'Ganeshkhind Road, Pune' },
  { name: 'D.A.V. Public School', code: 'DAV-415', city: 'Kota', state: 'Rajasthan', address: 'Talwandi, Kota' },
  { name: 'Narayana E-Techno School', code: 'NET-512', city: 'Hyderabad', state: 'Telangana', address: 'Kukatpally, Hyderabad' },
  { name: 'Patna Women\'s College', code: 'PWC-607', city: 'Patna', state: 'Bihar', address: 'Bailey Road, Patna' },
  { name: 'Bhopal Memorial Institute', code: 'BMI-703', city: 'Bhopal', state: 'Madhya Pradesh', address: 'Bairagarh, Bhopal' },
  { name: 'Lucknow Public College', code: 'LPC-809', city: 'Lucknow', state: 'Uttar Pradesh', address: 'Gomti Nagar, Lucknow' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    await ExamCenter.deleteMany({});
    const created = await ExamCenter.insertMany(CENTERS);
    console.log(`Seeded ${created.length} exam centers`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
