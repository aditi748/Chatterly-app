"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ProfileModal } from "@/components/chat/ProfileModal";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function RootChatPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const [convosRes, unreadRes] = await Promise.all([
        supabase
          .from("conversations")
          .select(
            `
            id, 
            last_message_text, 
            last_message_at, 
            user1:profiles!user1_id(id, full_name, avatar_url, bio, last_seen), 
            user2:profiles!user2_id(id, full_name, avatar_url, bio, last_seen)
          `
          )
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
        supabase
          .from("messages")
          .select("conversation_id")
          .eq("is_read", false)
          .neq("user_id", userId),
      ]);

      const mapped = (convosRes.data || []).map((c: any) => {
        const other = c.user1?.id === userId ? c.user2 : c.user1;
        const unreadCount =
          unreadRes.data?.filter((m) => m.conversation_id === c.id).length || 0;
        return {
          id: c.id,
          otherId: other?.id,
          name: other?.full_name,
          avatar_url: other?.avatar_url,
          bio: other?.bio,
          last_seen_db: other?.last_seen,
          last_msg: c.last_message_text,
          last_at: c.last_message_at,
          unread_count: unreadCount,
        };
      });

      setChats(
        mapped.sort(
          (a, b) =>
            new Date(b.last_at || 0).getTime() -
            new Date(a.last_at || 0).getTime()
        )
      );
    } catch (e) {
      console.error("Fetch error:", e);
    }
  }, []);

  useEffect(() => {
    let presenceChannel: any;
    let dataChannel: any;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.replace("/auth");

      const uid = session.user.id;
      setCurrentUser(session.user);

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();
      setProfile(prof);
      await fetchChats(uid);

      // Presence logic
      presenceChannel = supabase.channel("online-status", {
        config: { presence: { key: uid } },
      });
      presenceChannel
        .on("presence", { event: "sync" }, () =>
          setPresence(presenceChannel.presenceState())
        )
        .subscribe(async (status: string) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track({
              online_at: new Date().toISOString(),
            });
            // Direct DB update to set "Online"
            await supabase
              .from("profiles")
              .update({ last_seen: new Date().toISOString() })
              .eq("id", uid);
          }
        });

      // Realtime listener for messages, conversations, and profile updates (last seen)
      dataChannel = supabase
        .channel("global-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          () => fetchChats(uid)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations" },
          () => fetchChats(uid)
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles" },
          () => fetchChats(uid)
        )
        .subscribe();
    };

    init();
    setLoading(false);

    return () => {
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (dataChannel) supabase.removeChannel(dataChannel);
    };
  }, [router, fetchChats]);

  const currentActiveChat = chats.find((c) => c.id === selectedChatId);

  if (loading || !currentUser)
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-white" />
      </div>
    );

  return (
    <main className="flex h-screen w-full bg-black text-white overflow-hidden font-sans">
      <div
        className={`${
          selectedChatId ? "hidden md:flex" : "flex"
        } w-full md:w-[380px] h-full border-r border-white/5 flex-shrink-0`}
      >
        <ChatSidebar
          chats={chats}
          selectedId={selectedChatId}
          onSelectChat={setSelectedChatId}
          profile={profile}
          onEditProfile={() => setIsProfileModalOpen(true)}
          onNewChat={() => setIsNewChatOpen(true)}
          presence={presence}
        />
      </div>
      <div
        className={`${
          !selectedChatId ? "hidden md:flex" : "flex"
        } flex-1 h-full bg-zinc-950/50`}
      >
        {selectedChatId && currentActiveChat ? (
          <ChatWindow
            chat={currentActiveChat}
            currentUser={currentUser}
            onBack={() => setSelectedChatId(null)}
            onRefresh={() => fetchChats(currentUser.id)}
            presence={presence}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center opacity-20">
            <h2 className="text-[10px] font-black tracking-[0.5em] uppercase text-zinc-500">
              Select a conversation
            </h2>
          </div>
        )}
      </div>
      <AnimatePresence>
        {isProfileModalOpen && (
          <ProfileModal
            profile={profile}
            onClose={() => setIsProfileModalOpen(false)}
            onUpdate={() => {
              fetchChats(currentUser.id);
              supabase
                .from("profiles")
                .select("*")
                .eq("id", currentUser.id)
                .single()
                .then(({ data }) => setProfile(data));
            }}
          />
        )}
        {isNewChatOpen && (
          <NewChatModal
            currentUserId={currentUser?.id}
            onClose={() => setIsNewChatOpen(false)}
            onChatCreated={(id: string) => {
              setSelectedChatId(id);
              fetchChats(currentUser.id);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
