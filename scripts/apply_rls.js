const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database. Applying RLS policy updates...');

    // SQL query to alter policy
    const sql = `
      -- 1. Drop existing config policy
      DROP POLICY IF EXISTS "Admin manages config" ON public.system_config;
      DROP POLICY IF EXISTS "Allow public read of non-sensitive config" ON public.system_config;
      DROP POLICY IF EXISTS "Allow authenticated read of non-sensitive config" ON public.system_config;

      -- 2. Allow authenticated users to read configurations
      CREATE POLICY "Allow authenticated read of non-sensitive config" ON public.system_config
        FOR SELECT TO authenticated
        USING (true);

      -- 3. Re-create admin all-access policy
      CREATE POLICY "Admin manages config" ON public.system_config
        FOR ALL USING (public.is_admin());

      -- 4. Purge legacy SMTP configurations
      DELETE FROM public.system_config 
        WHERE key IN ('smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPass', 'smtpFrom');
    `;

    // We split statements or run them as a transaction
    await client.query('BEGIN');
    
    await client.query('DROP POLICY IF EXISTS "Admin manages config" ON public.system_config;');
    await client.query('DROP POLICY IF EXISTS "Allow public read of non-sensitive config" ON public.system_config;');
    await client.query('DROP POLICY IF EXISTS "Allow authenticated read of non-sensitive config" ON public.system_config;');
    
    await client.query(`
      CREATE POLICY "Allow authenticated read of non-sensitive config" ON public.system_config
        FOR SELECT TO authenticated
        USING (true);
    `);
    
    await client.query(`
      CREATE POLICY "Admin manages config" ON public.system_config
        FOR ALL USING (public.is_admin());
    `);

    // Purge legacy SMTP configs from live DB
    await client.query(`
      DELETE FROM public.system_config 
        WHERE key IN ('smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPass', 'smtpFrom');
    `);
    
    await client.query('COMMIT');
    console.log('RLS policies updated successfully!');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to apply RLS policy updates:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
