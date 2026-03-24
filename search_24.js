import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const matches = data.jobs.filter(j => j.name.includes("24"));
console.log("Jobs with 24 (found " + matches.length + "):", matches.slice(0, 10));
