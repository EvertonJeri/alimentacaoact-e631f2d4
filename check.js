import { supabase } from './src/integrations/supabase/client.js'; async function check() { const {data} = await supabase.from('food_control').select('*').limit(20); console.log(data); } check();  
