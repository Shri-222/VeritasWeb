import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  MISSING_SUPABASE_ENV_CODE,
  MISSING_SUPABASE_ENV_MESSAGE,
} from '@/lib/supabase/env';

const protectedPageRoutes = ['/dashboard'];

const protectedApiRoutes = [
  '/api/monitors',
  '/api/captures',
  '/api/capture-now',
  '/api/export-affidavit',
];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const hasSupabasePublicEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSupabasePublicEnv) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          code: MISSING_SUPABASE_ENV_CODE,
          message: MISSING_SUPABASE_ENV_MESSAGE,
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      new URL('/login', request.url)
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              request.cookies.set(name, value);

              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  const isProtectedApiRoute =
    protectedApiRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

  const hasBearerToken =
    request.headers
      .get('Authorization')
      ?.startsWith('Bearer ') ?? false;

  if (isProtectedApiRoute && hasBearerToken) {
    return response;
  }

  const isProtectedPageRoute =
    protectedPageRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedApiRoute && !user) {
    return NextResponse.json(
      {
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
      { status: 401 }
    );
  }

  if (isProtectedPageRoute && !user) {
    return NextResponse.redirect(
      new URL('/login', request.url)
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/monitors/:path*',
    '/api/captures/:path*',
    '/api/capture-now/:path*',
    '/api/export-affidavit/:path*',
  ],
};
