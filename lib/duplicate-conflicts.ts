import type { SupabaseErrorDetails } from './database-errors.ts';

export type DuplicateEntity = 'monitor' | 'case';

export type DuplicateConflict = {
  code: 'MONITOR_ALREADY_EXISTS' | 'CASE_ALREADY_EXISTS';
  message: string;
  status: 409;
};

export function isUniqueViolation(
  error: SupabaseErrorDetails | null | undefined
) {
  return error?.code === '23505';
}

export function mapUniqueViolation(
  error: SupabaseErrorDetails | null | undefined,
  entity: DuplicateEntity
): DuplicateConflict | null {
  if (!isUniqueViolation(error)) return null;

  return entity === 'monitor'
    ? {
        code: 'MONITOR_ALREADY_EXISTS',
        message: 'A monitor for this URL already exists.',
        status: 409,
      }
    : {
        code: 'CASE_ALREADY_EXISTS',
        message: 'A case with this name already exists.',
        status: 409,
      };
}

