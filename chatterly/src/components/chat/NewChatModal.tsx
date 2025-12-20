"use client";
import React, { useState, useEffect } from "react";
import { X, Search, User, Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

export function NewChatModal({ currentUserId, onClose, onChatCreated }: any) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [globalPresence, setGlobalPresence] = useState<Record<string, any>>({});

  useEffect(() => {
    const channel = supabase.channel("global_user_status");
    channel
      .on("presence", { event: "sync" }, () => {
        setGlobalPresence(channel.presenceState());
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !searchTerm.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .neq("id", currentUserId)
        .ilike("full_name", `%${searchTerm}%`)
        .limit(10);
      if (error) throw error;
      setResults(data || []);
    } catch (error: any) {
      console.error("Search failed:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const startConversation = async (otherUser: any) => {
    if (!currentUserId) return;
    setCreating(true);
    try {
      const { data: existingChat } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(user1_id.eq.${currentUserId},user2_id.eq.${otherUser.id}),and(user1_id.eq.${otherUser.id},user2_id.eq.${currentUserId})`
        )
        .maybeSingle();
      if (existingChat) {
        onChatCreated(existingChat.id);
        onClose();
        return;
      }
      const { data: newChat, error: createError } = await supabase
        .from("conversations")
        .insert({
          user1_id: currentUserId,
          user2_id: otherUser.id,
          last_message_text: "Connection established",
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (createError) throw createError;
      onChatCreated(newChat.id);
      onClose();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-[32px] overflow-hidden p-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-light text-white">New Transmission</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSearch} className="relative mb-8">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
            size={18}
          />
          <input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Name..."
            className="w-full bg-white/[0.03] border border-white/5 py-4 pl-12 pr-4 rounded-2xl text-white outline-none focus:border-white/20 transition-all"
          />
        </form>
        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar px-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-zinc-500" />
            </div>
          ) : (
            results.map((user) => {
              const isOnline = !!globalPresence[user.id];
              return (
                <button
                  key={user.id}
                  onClick={() => startConversation(user)}
                  className="w-full p-4 flex items-center justify-between bg-white/[0.01] hover:bg-white/[0.05] border border-white/5 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-700">
                            <User size={20} />
                          </div>
                        )}
                      </div>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0d0d0d] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                        {user.full_name}
                      </p>
                      {isOnline && (
                        <p className="text-[8px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">
                          Active Now
                        </p>
                      )}
                    </div>
                  </div>
                  {creating ? (
                    <Loader2 size={18} className="animate-spin text-white" />
                  ) : (
                    <Plus
                      size={18}
                      className="text-zinc-500 group-hover:text-white transition-colors"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
