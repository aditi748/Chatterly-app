"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // 1. Handle Sign Out
      if (event === "SIGNED_OUT") {
        window.location.href = "/auth";
        return;
      }

      // 2. Handle Password Recovery specifically
      if (event === "PASSWORD_RECOVERY") {
        return; // Background tabs will stop here
      }

      // 3. Handle Sign In
      if (event === "SIGNED_IN" && pathname === "/auth") {
        // Robust check: Look at the URL first
        const isRecoveryURL =
          window.location.hash.includes("type=recovery") ||
          window.location.search.includes("type=recovery") ||
          window.location.search.includes("code=");

        if (isRecoveryURL) {
          return; // This is the active recovery tab, do not redirect
        }

        // 4. THE ULTIMATE FIX FOR BACKGROUND TABS:
        // If a session exists but no recovery info is in the URL,
        // we check the session metadata to see if it's a recovery session
        // before we allow a redirect to the dashboard.
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // If the user's metadata indicates a recovery or if the session
        // was just created via a recovery link, we skip the dashboard jump.
        const isRecoverySession =
          user?.recovery_sent_at &&
          new Date().getTime() - new Date(user.recovery_sent_at).getTime() <
            1000 * 60 * 10;

        if (!isRecoverySession) {
          router.push("/");
          router.refresh();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  return (
    <html lang="en">
      <body className="bg-[#0d0e12] antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
