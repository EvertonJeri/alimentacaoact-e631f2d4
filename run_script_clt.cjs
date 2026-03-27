const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://dcsrekabpydnwvqhmaiw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc3Jla2FicHlkbnd2cWhtYWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDkzNzgsImV4cCI6MjA4OTQyNTM3OH0.Sga_y2pWTnBMRDoUAhiWerXQCzbYhhMb0PL6nzgdz0k');

async function run() {
  const { data: entries } = await supabase.from('time_entries').select('*, jobs!inner(*), people!inner(*)').eq('people.is_registered', true);
  console.log(entries ? entries.length : 0, 'CLT time entries found');
  
  if (!entries || entries.length === 0) return;

  const reqMap = new Map();
  entries.forEach(e => {
    const key = e.person_id + '|' + e.job_id;
    if (!reqMap.has(key)) {
        reqMap.set(key, { 
            person_id: e.person_id, 
            job_id: e.job_id, 
            job_name: e.jobs.name || '',
            dates: [] 
        });
    }
    reqMap.get(key).dates.push(e.date);
  });

  const inserts = [];
  const fcInserts = [];
  let reqsAdded = 0;

  for (const req of reqMap.values()) {
      req.dates.sort();
      const startDate = req.dates[0];
      const endDate = req.dates[req.dates.length - 1];
      
      const isSmurf = req.job_name.toLowerCase().includes('smurf');
      const isFora = !isSmurf;

      // Se for fora de SP, gera a ficha de solicitações para o CLT também
      if (isFora) {
          reqsAdded++;
          inserts.push({
              id: crypto.randomUUID(),
              person_id: req.person_id,
              job_id: req.job_id,
              start_date: startDate,
              end_date: endDate,
              meals: ['cafe', 'almoco', 'janta'],
              location: 'Fora SP'
          });

          // Controle alimentar automatico para CLTs fora de SP
          const firstDay = startDate;
          for (const d of req.dates) {
              const isFirstDay = d === firstDay;
              const mList = isFirstDay ? ['almoco', 'janta'] : ['cafe', 'almoco', 'janta'];
              for (const m of mList) {
                  fcInserts.push({
                      person_id: req.person_id,
                      job_id: req.job_id,
                      date: d,
                      meal_type: m,
                      status: 'consumed'
                  });
              }
          }
      } else {
          // Dentro de SP. O usuário disse que Só o smurf é dentro de SP.
          // CLTs dentro de SP normalmente não ganham refeição (já tem VR), mas se quiserem colocar na lista de solicitações
          reqsAdded++;
          inserts.push({
              id: crypto.randomUUID(),
              person_id: req.person_id,
              job_id: req.job_id,
              start_date: startDate,
              end_date: endDate,
              meals: ['almoco', 'janta'], // Pode ser que tenham só almoço e janta
              location: 'Dentro SP'
          });

          for (const d of req.dates) {
              for (const m of ['almoco', 'janta']) {
                  fcInserts.push({
                      person_id: req.person_id,
                      job_id: req.job_id,
                      date: d,
                      meal_type: m,
                      status: 'consumed'
                  });
              }
          }
      }
  }

  const { error } = await supabase.from('meal_requests').insert(inserts);
  if (error) console.error('Erro Request:', error);
  else console.log('Sucesso! Inseridas ' + inserts.length + ' meal requests de CLTs.');

  const BATCH_SIZE = 500;
  for (let i = 0; i < fcInserts.length; i += BATCH_SIZE) {
      const chunk = fcInserts.slice(i, i + BATCH_SIZE);
      const { error: fcError } = await supabase.from('food_control').insert(chunk);
      if (fcError) console.error('FC Insert Error:', fcError);
  }
  console.log('Final FC Inserts CLTs: ', fcInserts.length);
}
run();
