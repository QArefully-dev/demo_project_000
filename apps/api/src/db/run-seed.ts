import { getDb, seedDatabase } from './index.js';

const db = getDb();
seedDatabase(db);
console.log('Database seeded successfully.');
db.close();
