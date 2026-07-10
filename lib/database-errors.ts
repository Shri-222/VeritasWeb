export type SupabaseErrorDetails = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function logSupabaseError(
  label: string,
  error: SupabaseErrorDetails
) {
  console.error(label, {
    message: error.message ?? null,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

export function isMissingTableError(
  error: SupabaseErrorDetails | null | undefined,
  tableName: string
) {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  const table = tableName.toLowerCase();

  return (
    (error.code === 'PGRST205' || error.code === '42P01') &&
    (message.includes(table) || error.code === '42P01')
  );
}

export function isMissingColumnError(
  error: SupabaseErrorDetails | null | undefined,
  columnName: string
) {
  if (!error || error.code !== '42703') return false;
  return (error.message ?? '')
    .toLowerCase()
    .includes(columnName.toLowerCase());
}

