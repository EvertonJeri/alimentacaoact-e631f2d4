import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const personId = "814da82e-ad20-4af6-8ed4-0ae538276290";
const entries = data.entries.filter(e => e.person_id === personId);
console.log("Entries for Paulo:", entries.slice(0, 5));
const jobIds = [...new Set(entries.map(e => e.job_id))];
const jobs = data.jobs.filter(j => jobIds.includes(j.id));
console.log("Jobs for Paulo:", jobs);
