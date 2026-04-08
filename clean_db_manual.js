
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dcsrekabpydnwvqhmaiw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc3Jla2FicHlkbnd2cWhtYWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDkzNzgsImV4cCI6MjA4OTQyNTM3OH0.Sga_y2pWTnBMRDoUAhiWerXQCzbYhhMb0PL6nzgdz0k'
);

async function clean() {
  console.log("Iniciando limpeza manual...");

  // 1. Buscar todos os profissionais
  const { data: people } = await supabase.from('people').select('*');
  if (!people) return;

  const inativos = people.filter(p => p.name.toLowerCase().includes('(inativo)'));
  const inativoIds = inativos.map(p => p.id);

  if (inativoIds.length > 0) {
    console.log(`Encontrados ${inativoIds.length} inativos. Tentando mover registros...`);
    
    // Tenta achar par ativo para cada inativo
    const normalize = (s) => s.toLowerCase().replace(/\s*\(inativo\)\s*/gi, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    for (const inativo of inativos) {
        const norm = normalize(inativo.name);
        const ativo = people.find(p => !p.name.toLowerCase().includes('(inativo)') && normalize(p.name) === norm);
        
        if (ativo) {
            console.log(`Fundindo ${inativo.name} -> ${ativo.name}`);
            // Mover registros
            await supabase.from('time_entries').update({ person_id: ativo.id }).eq('person_id', inativo.id);
            await supabase.from('meal_requests').update({ person_id: ativo.id }).eq('person_id', inativo.id);
            await supabase.from('food_control').update({ person_id: ativo.id }).eq('person_id', inativo.id);
        }
    }

    // Deletar os inativos
    const { error: delError } = await supabase.from('people').delete().in('id', inativoIds);
    if (delError) console.error("Erro ao deletar inativos:", delError);
    else console.log("Inativos removidos com sucesso.");
  }

  // 2. Limpar Órfãos (Controle Alimentar, Registros de Hora, etc)
  console.log("Limpando órfãos do Controle Alimentar...");
  const { data: currentPeople } = await supabase.from('people').select('id');
  const validIds = new Set(currentPeople.map(p => p.id));

  // Buscamos tudo das tabelas dependentes
  const { data: fc } = await supabase.from('food_control').select('id, person_id');
  const orphansFC = fc.filter(f => !validIds.has(f.person_id)).map(f => f.id);
  if (orphansFC.length > 0) {
      console.log(`Removendo ${orphansFC.length} registros órfãos do Controle Alimentar...`);
      await supabase.from('food_control').delete().in('id', orphansFC);
  }

  const { data: te } = await supabase.from('time_entries').select('id, person_id');
  const orphansTE = te.filter(t => !validIds.has(t.person_id)).map(t => t.id);
  if (orphansTE.length > 0) {
      console.log(`Removendo ${orphansTE.length} registros órfãos de Hora...`);
      await supabase.from('time_entries').delete().in('id', orphansTE);
  }

  console.log("Limpeza manual concluída.");
}

clean().catch(console.error);
