import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { normalizeCaseName } from './normalization.ts';

export async function findDuplicateCase(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    normalizedName: string;
    excludeCaseId?: string;
  }
) {
  let query = supabase
    .from('cases')
    .select('id, name')
    .eq('user_id', input.userId);

  if (input.excludeCaseId) {
    query = query.neq('id', input.excludeCaseId);
  }

  const { data, error } = await query;
  const comparableName = input.normalizedName.toLowerCase();

  return {
    data: (data ?? []).find(
      (item) =>
        normalizeCaseName(item.name).toLowerCase() ===
        comparableName
    ) ?? null,
    error,
  };
}
