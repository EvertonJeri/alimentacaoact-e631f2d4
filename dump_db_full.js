import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL="(.+)"/)?.[1];
const SUPABASE_PUBLISHABLE_KEY = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.+)"/)?.[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function dumpAll() {
  let allPeople = [];
  let allJobs = [];
  let allEntries = [];
  
  // People
  let { data: people } = await supabase.from('people').select('*');
  allPeople = people || [];
  
  // Jobs (with pagination)
  let from = 0;
  let to = 999;
  while (true) {
    let { data, error } = await supabase.from('jobs').select('*').range(from, to);
    if (error) break;
    allJobs = allJobs.concat(data);
    if (data.length < 1000) break;
    from += 1000;
    to += 1000;
  }
  
  // Entries
  from = 0;
  to = 999;
  while (true) {
    let { data, error } = await supabase.from('time_entries').select('*').range(from, to);
    if (error) break;
    allEntries = allEntries.concat(data);
    if (data.length < 1000) break;
    from += 1000;
    to += 1000;
  }

  fs.writeFileSync('db_dump.json', JSON.stringify({ people: allPeople, jobs: allJobs, entries: allEntries }, null, 2));
  console.log(`Dump successful. Jobs: ${allJobs.length}, Entries: ${allEntries.length}`);
}

dumpAll();
