import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    // FIX: Await the cookies() promise
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // The set method can sometimes fail if called in a transition
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: "", ...options });
            } catch (error) {
              // Handle potential cookie set errors
            }
          },
        },
      }
    );

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        if (type === "recovery") {
          return NextResponse.redirect(`${origin}/auth/update-password`);
        }
        return NextResponse.redirect(`${origin}${next}`);
      }

      console.error("Auth Exchange Error:", error.message);
    } catch (err) {
      console.error("Unexpected Auth Error:", err);
    }
  }

  // Return to login with error if exchange failed
  return NextResponse.redirect(`${origin}/auth?error=session_exchange_failed`);
}
