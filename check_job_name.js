import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const jobId = "a7dbd79a-bde5-410e-bcfa-336defa1d285";
const job = data.jobs.find(j => j.id === jobId);
console.log("Job Name:", job ? job.name : "Not found");
