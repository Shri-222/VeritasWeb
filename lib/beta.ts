import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const BETA_LIMIT_MESSAGE = 'Your beta usage limit has been reached.';

function positiveEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getBetaLimits() {
  return {
    maxMonitors: positiveEnv('BETA_MAX_MONITORS_PER_USER', 5),
    maxCapturesPerDay: positiveEnv('BETA_MAX_CAPTURES_PER_DAY', 20),
    maxBundleCaptures: positiveEnv('BETA_MAX_BUNDLE_CAPTURES', 25),
  };
}

export async function checkMonitorBetaLimit(supabase: SupabaseClient<Database>, userId: string) {
  const limits = getBetaLimits();
  const { count, error } = await supabase.from('monitors').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (error) throw error;
  return { allowed: (count ?? 0) < limits.maxMonitors, used: count ?? 0, limit: limits.maxMonitors };
}

export async function checkDailyCaptureBetaLimit(supabase: SupabaseClient<Database>, userId: string) {
  const limits = getBetaLimits();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase.from('captures').select('id, monitors!inner(user_id)', { count: 'exact', head: true }).eq('monitors.user_id', userId).gte('captured_at', start.toISOString());
  if (error) throw error;
  return { allowed: (count ?? 0) < limits.maxCapturesPerDay, used: count ?? 0, limit: limits.maxCapturesPerDay };
}

