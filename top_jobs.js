import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const counts = {};
data.entries.forEach(e => {
    counts[e.job_id] = (counts[e.job_id] || 0) + 1;
});
const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
console.log("Top Jobs by Entry count:", sorted.slice(0, 5));
sorted.slice(0, 5).forEach(([id, count]) => {
    const job = data.jobs.find(j => j.id === id);
    console.log(`Job: ${job ? job.name : 'Unknown'} (${id}) - Count: ${count}`);
});
