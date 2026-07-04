const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Testing get_student_attendance_summary RPC...');
  const { data: vData, error: vErr } = await supabase.rpc('get_student_attendance_summary').limit(2);
  if (vErr) {
    console.error('RPC Error:', vErr);
  } else {
    console.log('View Success, count:', vData.length);
  }

  console.log('Testing qr_sessions query...');
  const { data: qData, error: qErr } = await supabase.from('qr_sessions').select('date, section, attendance_records(status)').limit(2);
  if (qErr) {
    console.error('QR Sessions Query Error:', qErr);
  } else {
    console.log('QR Sessions Query Success:', JSON.stringify(qData, null, 2));
  }
}

run();
