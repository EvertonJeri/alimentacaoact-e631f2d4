const { createClient } = require('@supabase/supabase-js');
async function run() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: p } = await supabase.from('people').select('id, name').ilike('name', '%Mariana Basilio%').single();
  if (!p) { console.log('Mariana not found'); return; }
  const { data: reqs, error: fErr } = await supabase.from('meal_requests').select('*').eq('person_id', p.id);
  if (fErr) { console.log('Find error:', fErr); return; }
  for (const r of reqs) {
    const newMeals = r.meals.filter(m => m === 'almoco');
    await supabase.from('meal_requests').update({ meals: newMeals, location: 'Dentro SP' }).eq('id', r.id);
  }
  console.log('Mariana meal requests updated successfully to only lunchtime (Almoço).');
}
run();
