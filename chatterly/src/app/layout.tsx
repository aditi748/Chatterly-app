"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    // --- 1. AUTH STATE LISTENER ---
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.push("/auth");
        router.refresh();
      } else if (event === "SIGNED_IN") {
        router.refresh();
      }
    });

    // --- 2. GLOBAL PRESENCE TRACKER ---
    // This marks the user as "Active" as long as the browser tab is open
    let channel: any;

    const setupPresence = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;

      channel = supabase.channel("global_user_status", {
        config: {
          presence: {
            key: userId,
          },
        },
      });

      channel.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            online_at: new Date().toISOString(),
          });
        }
      });
    };

    setupPresence();

    return () => {
      subscription.unsubscribe();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router]);

  return (
    <html lang="en">
      <body className="bg-black antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
