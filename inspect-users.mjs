import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: "./.env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("Checking pg_policies for public.users:");
  const { data: policies, error } = await supabase.rpc("get_policies", {});
  if (error) {
    // If rpc doesn't exist, run a query
    const { data: pgPolicies, error: pgErr } = await supabase.from("pg_policies").select("*").catch(() => ({ data: null, error: { message: "SQL not allowed directly" } }));
    console.log("Policies via direct query:", pgPolicies, pgErr);
    
    // Let's run a raw query using supabase sql or rpc if available, or just query system tables
    // Since we don't have direct SQL exec RPC, let's try reading schema.sql policies
  } else {
    console.log("Policies:", policies);
  }
}

run().catch(console.error);
