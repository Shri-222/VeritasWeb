import { NextResponse } from 'next/server';

export const MISSING_SUPABASE_ENV_CODE =
  'MISSING_SUPABASE_ENV';

export const MISSING_SUPABASE_ENV_MESSAGE =
  'Supabase server environment variables are not configured.';

export class MissingSupabaseEnvError extends Error {
  constructor() {
    super(MISSING_SUPABASE_ENV_MESSAGE);
    this.name = 'MissingSupabaseEnvError';
  }
}

export function assertSupabasePublicEnv() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new MissingSupabaseEnvError();
  }
}

export function assertSupabaseServerEnv() {
  assertSupabasePublicEnv();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new MissingSupabaseEnvError();
  }
}

export function isMissingSupabaseEnvError(
  error: unknown
) {
  return error instanceof MissingSupabaseEnvError;
}

export function missingSupabaseEnvResponse() {
  return NextResponse.json(
    {
      success: false,
      code: MISSING_SUPABASE_ENV_CODE,
      message: MISSING_SUPABASE_ENV_MESSAGE,
    },
    { status: 500 }
  );
}
