import fs from 'fs';
const data = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const unknownIds = ["5d01e590-55ca-4cfd-bfb7-36ba35612f75", "4aa2779f-01af-4be3-830f-a5f1203c820c"];
unknownIds.forEach(id => {
    const job = data.jobs.find(j => j.id === id);
    console.log(`ID ${id}: ${job ? job.name : 'STILL UNKNOWN'}`);
});
console.log("First job in list:", data.jobs[0]);
console.log("Last job in list:", data.jobs[data.jobs.length - 1]);
