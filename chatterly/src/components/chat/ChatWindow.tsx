"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send,
  Paperclip,
  Loader2,
  ChevronLeft,
  Info,
  X,
  Trash2,
  Image as ImageIcon,
  Shield,
  Lock,
  Clock,
  User,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

export function ChatWindow({
  chat,
  currentUser,
  onBack,
  onRefresh,
  presence,
}: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isSelectionMode = selectedIds.length > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!chat?.id || !currentUser?.id) return;
    const markAsRead = async () => {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", chat.id)
        .neq("user_id", currentUser.id)
        .eq("is_read", false);
      if (onRefresh) onRefresh();
    };
    markAsRead();
  }, [chat?.id, messages.length, currentUser.id]);

  const isOnline = useMemo(
    () => presence && !!presence[chat.otherId],
    [presence, chat.otherId]
  );

  const sharedMedia = useMemo(() => {
    return messages.filter((m) => m.type === "image").map((m) => m.text);
  }, [messages]);

  const renderStatus = () => {
    if (isOnline)
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-500 font-bold tracking-tight text-[10px]">
            ONLINE
          </span>
        </div>
      );
    if (!chat.last_seen_db)
      return (
        <span className="text-zinc-600 font-bold text-[10px]">OFFLINE</span>
      );

    const lastSeenDate = new Date(chat.last_seen_db);
    const diffInMs = new Date().getTime() - lastSeenDate.getTime();
    const diffInSecs = Math.floor(diffInMs / 1000);

    let statusText = "";
    if (diffInSecs < 60) statusText = "JUST NOW";
    else if (diffInSecs < 3600)
      statusText = `${Math.floor(diffInSecs / 60)}M AGO`;
    else if (diffInSecs < 86400)
      statusText = `${Math.floor(diffInSecs / 3600)}H AGO`;
    else
      statusText = lastSeenDate.toLocaleDateString([], {
        day: "numeric",
        month: "short",
      });

    return (
      <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-wider">
        ACTIVE {statusText}
      </span>
    );
  };

  useEffect(() => {
    if (!chat?.id) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", chat.id)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    loadMessages();

    const msgChannel = supabase
      .channel(`chat_messages_${chat.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${chat.id}`,
        },
        (p) => setMessages((prev) => [...prev, p.new])
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (p) => setMessages((prev) => prev.filter((m) => m.id !== p.old.id))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [chat?.id]);

  useEffect(() => {
    if (!isSelectionMode)
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSelectionMode]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser?.id) return;
    const txt = newMessage;
    setNewMessage("");

    await Promise.all([
      supabase.from("messages").insert({
        conversation_id: chat.id,
        user_id: currentUser.id,
        text: txt,
        type: "text",
      }),
      supabase
        .from("conversations")
        .update({
          last_message_text: txt,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", chat.id),
    ]);
  };

  const handleDeleteMessages = async () => {
    if (selectedIds.length === 0) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .in("id", selectedIds);

    if (!error) {
      setMessages((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleImage = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const path = `${chat.id}/${Date.now()}_${file.name}`;
    await supabase.storage.from("chat-attachments").upload(path, file);
    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-attachments").getPublicUrl(path);

    await Promise.all([
      supabase.from("messages").insert({
        conversation_id: chat.id,
        user_id: currentUser.id,
        text: publicUrl,
        type: "image",
      }),
      supabase
        .from("conversations")
        .update({
          last_message_text: "Shared an image",
          last_message_at: new Date().toISOString(),
        })
        .eq("id", chat.id),
    ]);
    setIsUploading(false);
  };

  const getBubbleRadius = (
    isMe: boolean,
    isFirst: boolean,
    isLast: boolean
  ) => {
    const r = "20px";
    const s = "4px";
    if (isMe) {
      return `${r} ${isFirst ? r : s} ${isLast ? r : s} ${r}`;
    }
    return `${isFirst ? r : s} ${r} ${r} ${isLast ? r : s}`;
  };

  return (
    <div className="flex flex-1 h-full bg-black overflow-hidden relative text-white font-sans w-full">
      <div className="flex flex-1 flex-col min-w-0 h-full border-r border-white/5 relative w-full overflow-hidden">
        {/* Header Bar */}
        <div className="h-16 md:h-20 border-b border-white/5 flex items-center px-4 md:px-6 bg-black/80 backdrop-blur-xl z-30 overflow-hidden shrink-0">
          <AnimatePresence mode="wait">
            {isSelectionMode ? (
              <motion.div
                key="selection-bar"
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2 md:gap-4">
                  <button
                    onClick={() => setSelectedIds([])}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                  <div>
                    <span className="text-xs md:text-[13px] font-bold block">
                      {selectedIds.length} Selected
                    </span>
                    <span className="hidden md:block text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                      Tap to select
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleDeleteMessages}
                  className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-red-500 text-white rounded-xl md:rounded-2xl hover:bg-red-600 transition-all text-[10px] md:text-[11px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="chat-header"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <button
                    onClick={onBack}
                    className="md:hidden text-zinc-400 hover:text-white"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div
                    className="relative cursor-pointer"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-zinc-800 p-[1px]">
                      <div className="w-full h-full rounded-full bg-black overflow-hidden border border-black">
                        {chat.avatar_url ? (
                          <img
                            src={chat.avatar_url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs md:text-base font-bold">
                            {chat.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-[2px] border-black rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm md:text-[15px] font-bold tracking-tight mb-0.5 truncate">
                      {chat.name}
                    </h2>
                    <div>{renderStatus()}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`p-2 rounded-full transition-all text-zinc-500 hover:text-white hover:bg-white/5`}
                >
                  <Info size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Message Viewport */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-12 md:py-8 flex flex-col bg-[#050505] custom-scrollbar">
          {messages.length > 0 ? (
            <div className="flex flex-col w-full">
              {messages.map((msg, index) => {
                const isMe = msg.user_id === currentUser?.id;
                const isSelected = selectedIds.includes(msg.id);
                const prevMsg = messages[index - 1];
                const nextMsg = messages[index + 1];

                const isFirstInGroup =
                  !prevMsg || prevMsg.user_id !== msg.user_id;
                const isLastInGroup =
                  !nextMsg || nextMsg.user_id !== msg.user_id;

                return (
                  <div
                    key={msg.id}
                    onClick={() => isMe && toggleSelect(msg.id)}
                    className={`w-full flex flex-col relative group transition-all duration-300 ${
                      isMe ? "items-end" : "items-start"
                    } ${
                      isLastInGroup ? "mb-4 md:mb-6" : "mb-[2px] md:mb-[3px]"
                    } ${
                      isSelected
                        ? "scale-[0.98] opacity-80"
                        : "scale-100 opacity-100"
                    }`}
                  >
                    <motion.div
                      initial={isFirstInGroup ? { opacity: 0, y: 10 } : false}
                      animate={{
                        opacity: 1,
                        y: 0,
                        backgroundColor: isSelected
                          ? isMe
                            ? "#e4e4e7"
                            : "#27272a"
                          : isMe
                          ? "#ffffff"
                          : "#1f1f23",
                      }}
                      style={{
                        borderRadius: getBubbleRadius(
                          isMe,
                          isFirstInGroup,
                          isLastInGroup
                        ),
                      }}
                      className={`w-fit min-w-[40px] max-w-[90%] md:max-w-[70%] transition-all duration-200 border relative overflow-hidden ${
                        isSelected
                          ? isMe
                            ? "border-zinc-300 shadow-inner"
                            : "border-white/20 shadow-inner"
                          : isMe
                          ? "border-white shadow-sm"
                          : "border-white/5 shadow-sm"
                      } ${
                        msg.type === "image"
                          ? "p-1 md:p-1.5 bg-zinc-900"
                          : `px-3 md:px-4 py-2 md:py-2.5 text-[13px] md:text-[14px] leading-relaxed ${
                              isMe ? "text-black font-medium" : "text-zinc-100"
                            }`
                      }`}
                    >
                      {msg.type === "image" ? (
                        <img
                          src={msg.text}
                          className={`rounded-lg max-h-64 md:max-h-80 w-auto object-contain transition-all ${
                            isSelected ? "brightness-50" : ""
                          }`}
                          alt="Shared"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words relative z-10">
                          {msg.text}
                        </p>
                      )}
                    </motion.div>

                    {isLastInGroup && (
                      <span className="text-[8px] md:text-[9px] font-black text-zinc-700 uppercase tracking-[0.15em] mt-1.5 md:mt-2 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 md:space-y-6 px-4">
              <div className="flex flex-col items-center max-w-[240px] md:max-w-[280px] text-center">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 md:mb-6">
                  <MessageSquare size={20} className="text-zinc-700" />
                </div>
                <h3 className="text-xs md:text-[13px] font-bold text-zinc-400 mb-2 uppercase tracking-widest">
                  Conversation with {chat.name}
                </h3>
                <p className="text-[10px] md:text-[11px] text-zinc-600 font-medium leading-relaxed">
                  Messages are end-to-end encrypted. No one outside of this chat
                  can read them.
                </p>
              </div>

              <div className="flex items-center gap-2 md:gap-3 py-2 px-3 md:px-4 bg-white/[0.02] border border-white/5 rounded-full">
                <Lock size={9} className="text-zinc-700" />
                <span className="text-[8px] md:text-[9px] font-black text-zinc-700 uppercase tracking-[0.2em]">
                  Secure History
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 md:p-6 bg-black border-t border-white/5 shrink-0">
          <form
            onSubmit={handleSend}
            className="flex gap-2 md:gap-4 items-center max-w-5xl mx-auto"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImage}
              hidden
              accept="image/*"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-xl md:rounded-2xl shrink-0"
            >
              {isUploading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Paperclip size={18} />
              )}
            </button>
            <div className="flex-1 relative">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-zinc-900 border border-white/5 text-white text-sm md:text-[14px] rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 outline-none focus:border-white/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-white text-black h-11 w-11 md:h-14 md:w-14 flex items-center justify-center rounded-xl md:rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Darker Overlay for mobile/tablet */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[90] lg:hidden"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 200,
                mass: 0.8,
              }}
              className="fixed right-0 top-0 bottom-0 w-full lg:relative lg:w-[380px] h-full bg-[#080808] border-l border-white/5 flex flex-col z-[100] overflow-hidden"
            >
              <div className="h-16 md:h-20 px-4 md:px-6 border-b border-white/5 flex items-center justify-between bg-black/50 sticky top-0 z-10 backdrop-blur-md">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  Contact Info
                </h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all shadow-xl"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-8 md:p-10 flex flex-col items-center border-b border-white/5">
                  <div className="relative mb-6">
                    <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-zinc-900 p-[2px] shadow-2xl">
                      <div className="w-full h-full rounded-full bg-black overflow-hidden border-[3px] border-black">
                        {chat.avatar_url ? (
                          <img
                            src={chat.avatar_url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-3xl font-bold">
                            {chat.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                    {isOnline && (
                      <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-4 border-[#080808] rounded-full shadow-lg" />
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-1">
                    {chat.name}
                  </h2>
                  <div className="mb-8">{renderStatus()}</div>

                  <div className="flex flex-col items-center gap-1.5 px-6 py-3 bg-white/[0.03] border border-white/5 rounded-2xl w-full max-w-[200px]">
                    <Clock size={12} className="text-zinc-600" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                      Member Since
                    </span>
                    <span className="text-xs font-bold text-zinc-300 text-center">
                      {chat.created_at
                        ? new Date(chat.created_at).toLocaleDateString([], {
                            month: "long",
                            year: "numeric",
                          })
                        : "December 2025"}
                    </span>
                  </div>
                </div>

                <div className="p-8 border-b border-white/5">
                  <div className="flex items-center gap-2 mb-4">
                    <User size={14} className="text-zinc-600" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      About
                    </h4>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed italic">
                    {chat.bio || "No information shared."}
                  </p>
                </div>

                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={14} className="text-zinc-600" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Shared Media
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white/5 rounded-full text-zinc-500">
                      {sharedMedia.length}
                    </span>
                  </div>

                  {sharedMedia.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {sharedMedia.slice(0, 15).map((url, i) => (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          key={i}
                          className="aspect-square rounded-xl bg-zinc-900 overflow-hidden border border-white/5 cursor-pointer relative shadow-lg"
                          onClick={() => window.open(url, "_blank")}
                        >
                          <img
                            src={url}
                            className="w-full h-full object-cover opacity-80"
                            alt=""
                          />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                      <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">
                        No shared media
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 md:p-8 bg-black border-t border-white/5 mt-auto">
                <div className="flex items-center gap-3 px-4 py-3.5 bg-zinc-900 rounded-2xl border border-white/5">
                  <Shield size={14} className="text-zinc-700" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    End-to-End Encrypted
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
