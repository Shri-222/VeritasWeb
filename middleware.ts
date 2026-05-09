import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoutes = [
    '/dashboard',
    '/api/monitors',
    '/api/captures',
  ];

  const isProtectedRoute =
    protectedRoutes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

  if (isProtectedRoute && !user) {
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
  ],
};