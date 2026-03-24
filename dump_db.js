import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env manually to avoid extra dependencies
const envContent = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL="(.+)"/)?.[1];
const SUPABASE_PUBLISHABLE_KEY = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.+)"/)?.[1];

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function dump() {
  try {
    const { data: people, error: pError } = await supabase.from('people').select('*');
    if (pError) throw pError;
    const { data: jobs, error: jError } = await supabase.from('jobs').select('*');
    if (jError) throw jError;
    const { data: entries, error: eError } = await supabase.from('time_entries').select('*');
    if (eError) throw eError;
    
    fs.writeFileSync('db_dump.json', JSON.stringify({ people, jobs, entries }, null, 2));
    console.log("Dump successful");
  } catch (err) {
    console.error("Dump failed:", err);
    process.exit(1);
  }
}

dump();
