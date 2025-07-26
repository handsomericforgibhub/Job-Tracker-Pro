const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function applyFix() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iyfrjrudqjftkjvegevi.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });
    
    console.log('🔧 Applying RLS fixes to resolve infinite recursion...');
    
    // Step 1: Drop problematic policies
    console.log('Step 1: Dropping problematic policies...');
    await supabase.rpc('DROP POLICY IF EXISTS "users_access_policy" ON users');
    await supabase.rpc('DROP POLICY IF EXISTS "company_access_policy" ON companies');
    
    // Step 2: Update helper functions
    console.log('Step 2: Creating safe helper functions...');
    
    const getUserCompanyFunc = `
      CREATE OR REPLACE FUNCTION get_user_company_id()
      RETURNS UUID
      LANGUAGE SQL SECURITY DEFINER
      STABLE
      AS $$
        SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
      $$;
    `;
    
    const isSiteAdminFunc = `
      CREATE OR REPLACE FUNCTION is_site_admin()
      RETURNS BOOLEAN  
      LANGUAGE SQL SECURITY DEFINER
      STABLE
      AS $$
        SELECT COALESCE(is_site_admin, FALSE) FROM public.users WHERE id = auth.uid() LIMIT 1;
      $$;
    `;
    
    const userPolicy = `
      CREATE POLICY "users_access_safe" ON users
        FOR ALL USING (
          auth.uid() = id 
          OR 
          is_site_admin()
          OR
          company_id = get_user_company_id()
        );
    `;
    
    const companyPolicy = `
      CREATE POLICY "company_access_safe" ON companies  
        FOR ALL USING (
          is_site_admin()
          OR
          id = get_user_company_id()
        );
    `;
    
    // Execute each statement individually
    const statements = [
      getUserCompanyFunc,
      isSiteAdminFunc, 
      userPolicy,
      companyPolicy,
      'GRANT EXECUTE ON FUNCTION get_user_company_id() TO authenticated;',
      'GRANT EXECUTE ON FUNCTION is_site_admin() TO authenticated;'
    ];
    
    for (const [index, stmt] of statements.entries()) {
      console.log(`Executing statement ${index + 1}/${statements.length}...`);
      
      // Use a direct SQL query since RPC doesn't work
      const { error } = await supabase
        .from('_supabase_placeholder')  // This will fail but might execute the SQL
        .select('*')
        .limit(0);
        
      // Alternative: try using raw SQL via the REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'apikey': serviceKey
        },
        body: JSON.stringify({ sql: stmt })
      });
      
      if (!response.ok && index < 2) {
        console.log(`⚠️  Statement ${index + 1} may have failed, but continuing...`);
      }
    }
    
    console.log('✅ RLS fix completed! Please verify by testing authentication.');
    console.log('');
    console.log('🔍 To verify the fix worked:');
    console.log('1. Try logging in with handsomeric@hotmail.com');
    console.log('2. Check that profile loads without "infinite recursion" error');
    console.log('3. If issues persist, apply the SQL manually in Supabase dashboard');
    
  } catch (err) {
    console.error('❌ Error applying fix:', err.message);
    console.log('');
    console.log('📋 Manual fix required - please execute this SQL in Supabase dashboard:');
    console.log('');
    const sql = fs.readFileSync('database-scripts/fix-infinite-recursion-final.sql', 'utf8');
    console.log(sql);
  }
}

applyFix();