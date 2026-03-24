import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const jobId = "5d01e590-55ca-4cfd-bfb7-36ba35612f75";
const job = data.jobs.find(j => j.id === jobId);
console.log("Job Name:", job ? job.name : "Not found");
console.log("Total Jobs:", data.jobs.length);
console.log("Jobs Sample:", data.jobs.slice(0, 5));
