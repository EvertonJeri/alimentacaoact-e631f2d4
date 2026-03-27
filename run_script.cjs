const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://dcsrekabpydnwvqhmaiw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc3Jla2FicHlkbnd2cWhtYWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDkzNzgsImV4cCI6MjA4OTQyNTM3OH0.Sga_y2pWTnBMRDoUAhiWerXQCzbYhhMb0PL6nzgdz0k');

async function run() {
  const { data: requests } = await supabase.from('meal_requests').select('*, jobs(*), people(*)');
  const { data: entries } = await supabase.from('time_entries').select('*');
  const { data: fcLocal } = await supabase.from('food_control').select('*');

  const pjs = requests.filter(r => r.people && !r.people.is_registered);

  const fcInserts = [];
  const existingKeys = new Set(fcLocal.map(fc => `${fc.person_id}-${fc.job_id}-${fc.date}-${fc.meal_type}`));

  for (const r of pjs) {
      const jobName = r.jobs?.name || '';
      const isSmurf = jobName.toLowerCase().includes('smurf');
      const isFora = !isSmurf;

      if (isFora) {
          // Add cafe to request if not there
          if (!r.meals.includes('cafe')) {
             await supabase.from('meal_requests').update({ meals: ['cafe', 'almoco', 'janta'], location: 'Fora SP' }).eq('id', r.id);
          }
      }

      const personEntries = entries
         .filter(e => e.person_id === r.person_id && e.job_id === r.job_id)
         .sort((a,b) => a.date.localeCompare(b.date));
      
      if(personEntries.length > 0) {
          const firstDay = personEntries[0].date;
          for (const e of personEntries) {
              const isFirstDay = e.date === firstDay;
              
              const mList = isFora 
                 ? (isFirstDay ? ['almoco', 'janta'] : ['cafe', 'almoco', 'janta'])
                 : ['almoco', 'janta'];

              for (const m of mList) {
                  const key = `${r.person_id}-${r.job_id}-${e.date}-${m}`;
                  if (!existingKeys.has(key)) {
                      existingKeys.add(key);
                      fcInserts.push({
                          person_id: r.person_id,
                          job_id: r.job_id,
                          date: e.date,
                          meal_type: m,
                          status: 'consumed'
                      });
                  }
              }
          }
      }
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < fcInserts.length; i += BATCH_SIZE) {
      const chunk = fcInserts.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('food_control').insert(chunk);
      if (error) console.error('FC Insert Error:', error);
  }
  console.log('Final FC Inserts: ', fcInserts.length);
}
run();
