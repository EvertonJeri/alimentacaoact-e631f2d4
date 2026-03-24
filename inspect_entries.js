import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
console.log("Total entries:", data.entries.length);
console.log("First 5 entries:", data.entries.slice(0, 5));
