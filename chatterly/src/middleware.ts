import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Use getUser() instead of getSession() for better security in Middleware
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = new URL(request.url);

  // 1. EXEMPTION: Allow the recovery flow to proceed
  const isRecoveryPath =
    url.pathname.startsWith("/auth/update-password") ||
    url.pathname.startsWith("/auth/callback") || // Added callback route to exemption
    url.searchParams.get("type") === "recovery";

  if (isRecoveryPath) {
    return response;
  }

  const isAuthPage = url.pathname.startsWith("/auth");

  // 2. LOGGED IN: Redirect away from auth pages (Sign In/Sign Up)
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. NOT LOGGED IN: Redirect to auth from protected pages
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
