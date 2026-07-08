import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import {
  assertSupabasePublicEnv,
  isMissingSupabaseEnvError,
  missingSupabaseEnvResponse,
} from '@/lib/supabase/env';

export function apiErrorResponse(
  code: string,
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
    },
    { status }
  );
}

export function unauthorizedResponse() {
  return apiErrorResponse(
    'UNAUTHORIZED',
    'Authentication required.',
    401
  );
}

function createBearerClient(token: string) {
  assertSupabasePublicEnv();

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export type AuthenticatedApiContext = {
  user: User;
  supabase: SupabaseClient<Database>;
  errorResponse: null;
};

export type UnauthenticatedApiContext = {
  user: null;
  supabase: null;
  errorResponse: NextResponse;
};

export async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function authenticateApiRequest(
  request: NextRequest
): Promise<
  | AuthenticatedApiContext
  | UnauthenticatedApiContext
> {
  try {
    const authHeader =
      request.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const supabase = createBearerClient(token);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return {
          user: null,
          supabase: null,
          errorResponse: unauthorizedResponse(),
        };
      }

      return {
        user,
        supabase,
        errorResponse: null,
      };
    }

    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        user: null,
        supabase: null,
        errorResponse: unauthorizedResponse(),
      };
    }

    return {
      user,
      supabase,
      errorResponse: null,
    };
  } catch (error) {
    if (isMissingSupabaseEnvError(error)) {
      return {
        user: null,
        supabase: null,
        errorResponse: missingSupabaseEnvResponse(),
      };
    }

    throw error;
  }
}
