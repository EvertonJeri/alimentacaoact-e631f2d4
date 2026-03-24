import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const matches = data.jobs.filter(j => j.name.includes("78-24"));
console.log("Jobs with 78-24:", matches);
const matches2 = data.jobs.filter(j => j.name.includes("78") && j.name.includes("24"));
console.log("Jobs with both 78 and 24:", matches2);
