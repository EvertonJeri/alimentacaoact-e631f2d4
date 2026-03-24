import fs from 'fs';
const content = fs.readFileSync('db_dump.json', 'utf-8');
const index = content.indexOf('"jobs": [');
if (index !== -1) {
    const startLine = content.substring(0, index).split('\n').length;
    console.log("Jobs start on line:", startLine);
} else {
    console.log("Jobs key not found");
}
const entriesIndex = content.indexOf('"entries": [');
if (entriesIndex !== -1) {
    const startLine = content.substring(0, entriesIndex).split('\n').length;
    console.log("Entries start on line:", startLine);
}
