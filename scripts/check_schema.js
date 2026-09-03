const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local or .env
const envFiles = ['.env.local', '.env'];
let env = {};
for (const f of envFiles) {
  try {
    const content = fs.readFileSync(path.join(__dirname, '..', f), 'utf-8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const eqIdx = line.indexOf('=');
      const key = line.substring(0, eqIdx).trim();
      const val = line.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  } catch {}
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || '',
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

(async () => {
  const { data, error } = await supabase.from('receiving_detail').select('*').limit(1);
  if (error) {
    console.log('Error:', error.message);
    console.log('Details:', error.details);
    console.log('Code:', error.code);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('Table exists but has no data. Checking via insert test...');
    // Try inserting a dummy to see what columns are required
    const { data: ins, error: insErr } = await supabase.from('receiving_detail').insert({}).select();
    if (insErr) {
      console.log('Insert error (reveals schema):', insErr.message);
      console.log('Details:', insErr.details);
      console.log('Code:', insErr.code);
    }
  }
})();
