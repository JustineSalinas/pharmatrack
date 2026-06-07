const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking users table for admin...");
  const { data: dbAdmins, error: dbErr } = await supabase
    .from('users')
    .select('id, email, account_type, status')
    .eq('account_type', 'admin');
  
  if (dbErr) {
    console.error("Error reading users table:", dbErr.message);
  } else {
    console.log("Admins in database:", dbAdmins);
  }

  console.log("\nListing auth users matching admin emails...");
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Error reading auth users:", authErr.message);
  } else {
    const adminAuths = authUsers.users.filter(u => u.email && u.email.includes('admin'));
    console.log("Matching auth users:", adminAuths.map(u => ({ id: u.id, email: u.email, confirmed: u.email_confirmed_at })));
  }
}

check();
