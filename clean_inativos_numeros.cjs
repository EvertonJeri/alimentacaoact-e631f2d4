
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dcsrekabpydnwvqhmaiw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc3Jla2FicHlkbnd2cWhtYWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDkzNzgsImV4cCI6MjA4OTQyNTM3OH0.Sga_y2pWTnBMRDoUAhiWerXQCzbYhhMb0PL6nzgdz0k'
);

async function clean() {
  console.log("Iniciando LIMPEZA MANUAL DE INATIVOS COM NUMEROS...");

  const { data: people } = await supabase.from('people').select('*');
  if (!people) return;

  // Regex robusto para (inativo), (INATIVO 1), (inativo 2), etc
  const inativoRegex = /\s*\(\s*inativo\s*\d*\s*\)\s*/gi;

  const inativos = people.filter(p => p.name.match(inativoRegex) || p.name.toUpperCase() === 'TESTE');
  const inativoIds = inativos.map(p => p.id);

  if (inativoIds.length > 0) {
    console.log(`Encontrados ${inativoIds.length} inativos numéricos.`);
    
    const normalize = (s) => s.toLowerCase()
        .replace(inativoRegex, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    for (const inativo of inativos) {
        if (inativo.name.toUpperCase() === 'TESTE') continue;

        const norm = normalize(inativo.name);
        const ativo = people.find(p => !p.name.match(inativoRegex) && normalize(p.name) === norm);
        
        if (ativo) {
            console.log(`Fundindo: ${inativo.name} -> ${ativo.name}`);
            await supabase.from('time_entries').update({ person_id: ativo.id }).eq('person_id', inativo.id);
            await supabase.from('meal_requests').update({ person_id: ativo.id }).eq('person_id', inativo.id);
            await supabase.from('food_control').update({ person_id: ativo.id }).eq('person_id', inativo.id);
        } else {
            console.log(`Inativo sem par ativo: ${inativo.name}. Será apenas removido.`);
        }
    }

    const { error: delError } = await supabase.from('people').delete().in('id', inativoIds);
    if (delError) console.error("Erro ao deletar:", delError);
    else console.log("Limpou inativos numerados.");
  }

  console.log("FIM.");
}

clean().catch(console.error);
