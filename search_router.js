import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const search = "ROUTER";
const found = data.jobs.filter(j => j.name.toLowerCase().includes(search.toLowerCase()));
console.log("Found Jobs with ROUTER:", found);
