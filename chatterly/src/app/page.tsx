"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import ProfileModal from "@/components/chat/ProfileModal";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { AnimatePresence } from "framer-motion";
import { Loader2, MessageSquare } from "lucide-react";

export default function RootChatPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [tempChat, setTempChat] = useState<any | null>(null);
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      const { data: convos, error: convosError } = await supabase
        .from("conversations")
        .select(
          `
          id, 
          last_message_text, 
          last_message_at, 
          last_message_user_id,
          user1_id,
          user2_id,
          user1_deleted_at,
          user2_deleted_at,
          user1_archived,
          user2_archived,
          is_archived,
          user1:profiles!user1_id(id, full_name, avatar_url, bio, last_seen, email), 
          user2:profiles!user2_id(id, full_name, avatar_url, bio, last_seen, email)
        `
        )
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (convosError) throw convosError;

      const conversationIds = convos?.map((c) => c.id) || [];

      const [unreadRes, lastMessagesRes] = await Promise.all([
        supabase
          .from("messages")
          .select("conversation_id, created_at")
          .in("conversation_id", conversationIds)
          .eq("is_read", false)
          .neq("user_id", userId),
        supabase
          .from("messages")
          .select("conversation_id, is_read, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false }),
      ]);

      const mapped = (convos || []).map((c: any) => {
        const other = c.user1?.id === userId ? c.user2 : c.user1;
        const isUser1 = c.user1_id === userId;
        const deletedAt = isUser1 ? c.user1_deleted_at : c.user2_deleted_at;

        const isDeleted =
          deletedAt &&
          (!c.last_message_at ||
            new Date(c.last_message_at) <= new Date(deletedAt));

        const unreadCount =
          unreadRes.data?.filter((m) => {
            const isMatch = m.conversation_id === c.id;
            if (!deletedAt) return isMatch;
            return isMatch && new Date(m.created_at) > new Date(deletedAt);
          }).length || 0;

        const lastMsgData = lastMessagesRes.data?.find(
          (m) => m.conversation_id === c.id
        );

        // Professional fallback text for new or empty chats
        const displayMsg =
          isDeleted || !c.last_message_text
            ? "Start a conversation"
            : c.last_message_text;

        return {
          ...c,
          isDeleted,
          otherId: other?.id,
          name: other?.full_name,
          avatar_url: other?.avatar_url,
          bio: other?.bio,
          email: other?.email,
          last_seen_db: other?.last_seen,
          last_msg: displayMsg,
          // Since created_at is missing from the table, we sort by last_message_at
          last_at: c.last_message_at || null,
          last_msg_user_id: isDeleted ? null : c.last_message_user_id,
          unread_count: isDeleted ? 0 : unreadCount,
          last_msg_is_read: lastMsgData ? lastMsgData.is_read : true,
        };
      });

      setChats(
        mapped.sort((a, b) => {
          // Push chats with no messages (new chats) to the absolute top
          if (!a.last_at && b.last_at) return -1;
          if (a.last_at && !b.last_at) return 1;
          if (!a.last_at && !b.last_at) return 0;
          return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
        })
      );
    } catch (e: any) {
      console.error("Fetch Error:", e.message || e);
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
            await supabase
              .from("profiles")
              .update({ last_seen: new Date().toISOString() })
              .eq("id", uid);
          }
        });

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
        .subscribe();

      setLoading(false);
    };

    init();
    return () => {
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (dataChannel) supabase.removeChannel(dataChannel);
    };
  }, [router, fetchChats]);

  const currentActiveChat =
    chats.find((c) => c.id === selectedChatId) || tempChat;

  const visibleChats = chats.filter(
    (c) => (!c.isDeleted && c.is_archived !== true) || c.id === selectedChatId
  );

  if (loading || !currentUser)
    return (
      <div className="h-dvh w-full bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-[#6366f1]" />
      </div>
    );

  return (
    <main className="flex h-dvh w-full bg-black text-white overflow-hidden fixed inset-0">
      <div
        className={`${
          selectedChatId || tempChat ? "hidden md:flex" : "flex"
        } w-full md:w-[380px] h-full border-r border-white/5 flex-shrink-0 bg-[#111216]`}
      >
        <ChatSidebar
          chats={visibleChats}
          selectedId={selectedChatId || (tempChat ? "temp" : null)}
          onSelectChat={(id: string) => {
            setSelectedChatId(id);
            setTempChat(null);
          }}
          profile={profile}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onNewChat={() => setIsNewChatOpen(true)}
          presence={presence}
          currentUserId={currentUser.id}
          onRefresh={() => fetchChats(currentUser.id)}
        />
      </div>

      <div
        className={`${
          !(selectedChatId || tempChat) ? "hidden md:flex" : "flex"
        } flex-1 h-full bg-[#08080a] overflow-hidden relative`}
      >
        {(selectedChatId || tempChat) && currentActiveChat ? (
          <ChatWindow
            chat={currentActiveChat}
            currentUser={currentUser}
            onBack={() => {
              setSelectedChatId(null);
              setTempChat(null);
            }}
            onRefresh={() => fetchChats(currentUser.id)}
            presence={presence}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="absolute w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="flex flex-col items-center gap-5">
              <div className="w-16 h-16 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/10">
                <MessageSquare className="w-8 h-8 text-white stroke-[2.5px]" />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-zinc-200 font-medium text-sm tracking-wide">
                  Select a conversation
                </h2>
                <p className="text-zinc-600 text-[11px] font-medium tracking-widest uppercase">
                  To start chatting
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isProfileModalOpen && (
          <ProfileModal
            profile={profile}
            isOpen={isProfileModalOpen}
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
            isOpen={isNewChatOpen}
            currentUserId={currentUser?.id}
            onClose={() => setIsNewChatOpen(false)}
            onChatCreated={(id, newUser) => {
              if (id) {
                setSelectedChatId(id);
                setTempChat(null);
              } else if (newUser) {
                setSelectedChatId(null);
                setTempChat({
                  id: null,
                  otherId: newUser.id,
                  name: newUser.full_name,
                  avatar_url: newUser.avatar_url,
                  email: newUser.email,
                  is_temp: true,
                });
              }
              fetchChats(currentUser.id);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
