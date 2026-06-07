const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setPassword() {
  const email = '>admin@[REDACTED]';
  const newPassword = '>[REDACTED]';

  console.log(`Searching for auth user by email: ${email}`);
  const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("Error listing users:", listErr.message);
    process.exit(1);
  }

  const adminUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!adminUser) {
    console.error(`Admin user ${email} not found in Auth list.`);
    process.exit(1);
  }

  console.log(`Updating password for user ID: ${adminUser.id}`);
  const { error: updateErr } = await supabase.auth.admin.updateUserById(adminUser.id, {
    password: newPassword,
    email_confirm: true,
  });

  if (updateErr) {
    console.error("Error updating password:", updateErr.message);
    process.exit(1);
  }

  console.log(`Successfully set password for ${email} to ${newPassword}`);
}

setPassword();
