const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function fixRLSPolicies() {
    try {
        console.log('🔧 Starting RLS policy fix...')
        
        // Create Supabase client with service role key for admin operations
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY // This needs to be the service role key, not anon key
        )
        
        console.log('✅ Supabase client initialized')
        
        // Read the SQL script
        const sqlScript = fs.readFileSync(
            path.join(__dirname, '..', 'database-scripts', 'fix-job-status-history-rls.sql'),
            'utf8'
        )
        
        console.log('📜 SQL script loaded')
        
        // Execute the SQL script
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: sqlScript
        })
        
        if (error) {
            console.error('❌ Error executing SQL script:', error)
            return false
        }
        
        console.log('✅ RLS policies updated successfully')
        return true
        
    } catch (error) {
        console.error('❌ Script execution failed:', error)
        return false
    }
}

// Run the script
fixRLSPolicies().then((success) => {
    if (success) {
        console.log('🎉 RLS policy fix completed successfully!')
        process.exit(0)
    } else {
        console.error('💥 RLS policy fix failed!')
        process.exit(1)
    }
})