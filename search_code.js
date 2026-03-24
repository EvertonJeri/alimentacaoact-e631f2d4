import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const search = "78/24";
const found = data.jobs.filter(j => j.name.includes(search));
console.log("Found Jobs:", found);
