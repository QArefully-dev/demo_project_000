import { getDb, resetDatabase, seedDatabase } from './index.js';

const db = getDb();
resetDatabase(db);
seedDatabase(db);
console.log('Database reset and re-seeded.');
db.close();
