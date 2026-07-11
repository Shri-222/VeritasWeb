type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
};

const DATABASE_SETUP_MESSAGE =
  'Database setup is incomplete. Apply the latest Supabase migrations, then try again.';

const UNSAFE_URL_MESSAGE =
  'This URL is blocked because it points to a private, local, or unsafe address. Use a public http/https website.';

function apiMessage(payload: ApiErrorPayload) {
  return typeof payload.message === 'string' && payload.message.trim()
    ? payload.message
    : null;
}

export function monitorCreationErrorMessage(
  payload: ApiErrorPayload
) {
  switch (payload.code) {
    case 'MONITOR_ALREADY_EXISTS':
      return apiMessage(payload) ??
        'A monitor for this URL and frequency already exists. Use the existing monitor or choose a different frequency.';
    case 'DATABASE_MIGRATION_REQUIRED':
      return DATABASE_SETUP_MESSAGE;
    case 'UNSAFE_URL':
      return UNSAFE_URL_MESSAGE;
    case 'VALIDATION_ERROR':
      return apiMessage(payload) ?? 'Monitor input is invalid.';
    case 'INTERNAL_ERROR':
      return 'Failed to create monitor. Check server logs for details.';
    default:
      return apiMessage(payload) ?? 'Failed to create monitor. Please try again.';
  }
}

export function caseCreationErrorMessage(
  payload: ApiErrorPayload
) {
  switch (payload.code) {
    case 'CASE_ALREADY_EXISTS':
      return 'A case with this name already exists.';
    case 'DATABASE_MIGRATION_REQUIRED':
      return DATABASE_SETUP_MESSAGE;
    case 'VALIDATION_ERROR':
      return apiMessage(payload) ?? 'Case input is invalid.';
    case 'INTERNAL_ERROR':
      return 'Failed to create case. Check server logs for details.';
    default:
      return apiMessage(payload) ?? 'Failed to create case.';
  }
}
