const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function runScript() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iyfrjrudqjftkjvegevi.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.error('Please set this environment variable with your Supabase service role key');
    process.exit(1);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    
    const sql = fs.readFileSync('database-scripts/fix-infinite-recursion-final.sql', 'utf8');
    console.log('Loaded SQL script, applying database fixes...');
    
    // Execute the complete SQL as one transaction
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Database error:', error);
      process.exit(1);
    }
    
    console.log('✅ Database fix completed successfully');
    console.log('Users table RLS infinite recursion has been resolved');
  } catch (err) {
    console.error('Script error:', err);
    process.exit(1);
  }
}

runScript();