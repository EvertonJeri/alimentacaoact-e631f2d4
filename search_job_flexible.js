import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const matches = data.jobs.filter(j => j.name.startsWith("78"));
console.log("Matches starting with 78:", matches);
const matches2 = data.jobs.filter(j => j.name.includes("78"));
console.log("Matches containing 78:", matches2);
const matches3 = data.jobs.filter(j => j.name.toLowerCase().includes("vitor"));
console.log("Matches containing vitor:", matches3);
