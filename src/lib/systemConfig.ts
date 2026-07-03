import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type ConfigKey =
  | "absenceNotifications"
  | "weeklyReports"
  | "lateThreshold"
  | "academicPeriod"
  | "qrExpiry"
  | "minAttendance"
  | "registrationMode";

export type SystemConfig = Record<ConfigKey, string>;

export const SYSTEM_CONFIG_DEFAULTS: SystemConfig = {
  absenceNotifications: "true",
  weeklyReports: "true",
  lateThreshold: "07:35",
  academicPeriod: "2025–2026 · 2nd Semester",
  qrExpiry: "10 min",
  minAttendance: "75%",
  registrationMode: "approval",
};

function mergeWithDefaults(dbConfigs: Array<{ key: string; value: string }> | null): SystemConfig {
  const dbMap = new Map((dbConfigs ?? []).map((item) => [item.key, item.value]));
  const settings = {} as SystemConfig;
  (Object.keys(SYSTEM_CONFIG_DEFAULTS) as ConfigKey[]).forEach((key) => {
    const dbVal = dbMap.get(key);
    settings[key] = dbVal !== undefined ? dbVal : SYSTEM_CONFIG_DEFAULTS[key];
  });
  return settings;
}

/** Server-side read using a service-role Supabase client — for API routes. */
export async function getSystemConfigServer(client: SupabaseClient): Promise<SystemConfig> {
  const { data, error } = await client.from("system_config").select("key, value");
  if (error) throw error;
  return mergeWithDefaults(data as any);
}

/**
 * Browser-side read. RLS allows any authenticated user to SELECT
 * system_config ("Allow authenticated read of non-sensitive config" policy
 * in schema.sql), so this doesn't need to proxy through an admin-gated API
 * route the way the settings page's save flow does.
 */
export async function getSystemConfig(): Promise<SystemConfig> {
  const { data, error } = await supabase.from("system_config").select("key, value");
  if (error) throw error;
  return mergeWithDefaults(data as any);
}
