"use client";
import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Loader2,
  Plus,
  Mail,
  History,
  Search,
  ArrowRight,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

interface NewChatModalProps {
  currentUserId: string;
  onClose: () => void;
  onChatCreated: (chatId: string | null, newUser?: Profile) => void;
}

export function NewChatModal({
  currentUserId,
  onClose,
  onChatCreated,
}: NewChatModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem("chat_search_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.email)
        setCurrentUserEmail(session.user.email.toLowerCase());
    };
    getUser();
  }, []);

  const saveToHistory = (email: string) => {
    const emailLower = email.toLowerCase();
    setHistory((prev) => {
      const updated = [
        emailLower,
        ...prev.filter((e) => e !== emailLower),
      ].slice(0, 5);
      localStorage.setItem("chat_search_history", JSON.stringify(updated));
      return updated;
    });
  };

  const removeFromHistory = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    const emailLower = email.toLowerCase();
    setHistory((prev) => {
      const updated = prev.filter((item) => item !== emailLower);
      localStorage.setItem("chat_search_history", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearch = async (e?: React.FormEvent, overrideEmail?: string) => {
    if (e) e.preventDefault();
    setError(null);

    const targetEmail = (overrideEmail || searchTerm).trim().toLowerCase();

    if (!targetEmail || !targetEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (targetEmail === currentUserEmail) {
      setError("Self-messaging is not enabled.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: searchError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .neq("id", currentUserId)
        .eq("email", targetEmail)
        .maybeSingle();

      if (searchError) throw searchError;

      if (data) {
        setResults([data]);
        saveToHistory(targetEmail);
      } else {
        setError("User profile not found.");
        setResults([]);
      }
    } catch (err: any) {
      setError("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelection = async (otherUser: Profile) => {
    if (!currentUserId || creating) return;
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
      } else {
        onChatCreated(null, otherUser);
      }
      onClose();
    } catch (err: any) {
      setError("Initialization error.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#0a0c10]/85 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.99 }}
        className="relative w-full max-w-[380px] bg-[#1a1d23] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
              Direct Message
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-zinc-600 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={(e) => handleSearch(e)} className="relative mb-8">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
              {loading ? (
                <Loader2 size={16} className="animate-spin text-indigo-500" />
              ) : (
                <Search size={16} />
              )}
            </div>
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter email address..."
              className="w-full bg-black/20 border border-white/5 py-3 pl-11 pr-10 rounded-xl text-sm text-white outline-none focus:border-white/20 transition-all placeholder:text-zinc-700"
            />
            {searchTerm && !loading && (
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-400 font-bold text-xs px-2"
              >
                FIND
              </button>
            )}
          </form>

          <div className="min-h-[120px] flex flex-col">
            <AnimatePresence mode="wait">
              {results.length > 0 ? (
                results.map((user) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => handleSelection(user)}
                    className="p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex-shrink-0 border border-indigo-500/10 flex items-center justify-center overflow-hidden">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <User size={18} className="text-indigo-400" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-white truncate">
                          {user.full_name || "New Connection"}
                        </span>
                        <span className="text-[11px] text-zinc-500 truncate">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-zinc-600 group-hover:text-white transition-colors"
                    />
                  </motion.div>
                ))
              ) : error ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-4 text-center"
                >
                  <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-widest">
                    {error}
                  </p>
                </motion.div>
              ) : history.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                      Recent Activity
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {history.map((email) => (
                      <div
                        key={email}
                        className="flex items-center justify-between p-3 hover:bg-white/[0.02] rounded-xl cursor-pointer group"
                        onClick={() => {
                          setSearchTerm(email);
                          handleSearch(undefined, email);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <History
                            size={14}
                            className="text-zinc-700 group-hover:text-zinc-400"
                          />
                          <span className="text-[12px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                            {email}
                          </span>
                        </div>
                        <button
                          onClick={(e) => removeFromHistory(e, email)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-white transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-12 h-12 bg-white/[0.02] rounded-2xl flex items-center justify-center mb-3">
                    <UserPlus size={20} className="text-zinc-700" />
                  </div>
                  <h3 className="text-zinc-400 text-xs font-semibold mb-1">
                    Start a Conversation
                  </h3>
                  <p className="text-zinc-600 text-[10px] leading-relaxed max-w-[180px]">
                    Enter a verified email address to initiate a secure chat
                    session.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
