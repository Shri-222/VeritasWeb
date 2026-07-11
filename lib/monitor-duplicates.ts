import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { monitorUrlComparisonValues } from './normalization.ts';

export type DuplicateMonitorRecord = {
  id: string;
  case_id?: string | null;
};

export async function findDuplicateMonitor(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    normalizedUrl: string;
    frequency: Database['public']['Tables']['monitors']['Row']['frequency'];
    excludeMonitorId?: string;
    includeCaseId?: boolean;
  }
) {
  let query = supabase
    .from('monitors')
    .select(input.includeCaseId ? 'id, case_id' : 'id')
    .eq('user_id', input.userId)
    .eq('frequency', input.frequency)
    .in(
      'normalized_url',
      monitorUrlComparisonValues(input.normalizedUrl)
    );

  if (input.excludeMonitorId) {
    query = query.neq('id', input.excludeMonitorId);
  }

  const { data, error } = await query.limit(1);

  return {
    data: (data?.[0] as DuplicateMonitorRecord | undefined) ?? null,
    error,
  };
}

export function duplicateMonitorMessage(
  duplicate: DuplicateMonitorRecord,
  requestedCaseId?: string | null
) {
  if (requestedCaseId && duplicate.case_id === requestedCaseId) {
    return 'A monitor for this URL and frequency already exists. Use the existing monitor or choose a different frequency.';
  }

  if (!requestedCaseId && !duplicate.case_id) {
    return 'A monitor for this URL and frequency already exists. Use the existing monitor or choose a different frequency.';
  }

  return 'A monitor for this URL and frequency already exists. Use the existing monitor or choose a different frequency.';
}
