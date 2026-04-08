
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dcsrekabpydnwvqhmaiw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjc3Jla2FicHlkbnd2cWhtYWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDkzNzgsImV4cCI6MjA4OTQyNTM3OH0.Sga_y2pWTnBMRDoUAhiWerXQCzbYhhMb0PL6nzgdz0k'
);

async function clean() {
  console.log("Iniciando LIMPEZA MANUAL FINAL...");

  // 1. Buscar todos os profissionais
  const { data: people } = await supabase.from('people').select('*');
  if (!people) {
      console.log("Sem pessoas encontradas.");
      return;
  }

  const inativos = people.filter(p => 
    p.name.toLowerCase().includes('(inativo)') || 
    p.name.toUpperCase() === 'TESTE'
  );
  const inativoIds = inativos.map(p => p.id);

  if (inativoIds.length > 0) {
    console.log(`Encontrados ${inativoIds.length} registros para remover (Inativos/Teste).`);
    
    // Tenta achar par ativo para cada inativo para não perder registros
    const normalize = (s) => s.toLowerCase()
        .replace(/\s*\(inativo\)\s*/gi, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    for (const inativo of inativos) {
        if (inativo.name.toUpperCase() === 'TESTE') {
            console.log("Removendo 'TESTE' brutalmente...");
            continue;
        }
        const norm = normalize(inativo.name);
        const ativo = people.find(p => !p.name.toLowerCase().includes('(inativo)') && normalize(p.name) === norm);
        
        if (ativo) {
            console.log(`Fundindo registros: ${inativo.name} -> ${ativo.name}`);
            await supabase.from('time_entries').update({ person_id: ativo.id }).eq('person_id', inativo.id);
            await supabase.from('meal_requests').update({ person_id: ativo.id }).eq('person_id', inativo.id);
            await supabase.from('food_control').update({ person_id: ativo.id }).eq('person_id', inativo.id);
        }
    }

    const { error: delError } = await supabase.from('people').delete().in('id', inativoIds);
    if (delError) console.error("Erro ao deletar:", delError);
    else console.log("Registros removidos.");
  }

  // 2. Limpeza de ÓRFÃOS (Quem está no controle alimentar mas sumiu da base)
  console.log("Verificando órfãos no Controle Alimentar...");
  const { data: peopleAfter } = await supabase.from('people').select('id');
  const validIds = new Set(peopleAfter.map(p => p.id));

  const { data: fc } = await supabase.from('food_control').select('id, person_id');
  if (fc) {
      const orphans = fc.filter(f => !validIds.has(f.person_id)).map(f => f.id);
      if (orphans.length > 0) {
          console.log(`Removendo ${orphans.length} registros de pessoas que já foram excluídas.`);
          await supabase.from('food_control').delete().in('id', orphans);
      }
  }

  console.log("FIM DA LIMPEZA.");
}

clean().catch(console.error);
