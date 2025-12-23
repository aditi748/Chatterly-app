"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
  User,
  MessageSquare,
  Calendar,
  Maximize2,
  Check,
  CheckCheck,
  Mail,
  Download,
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
  const [isZoomed, setIsZoomed] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [currentChatId, setCurrentChatId] = useState<string | null>(
    chat?.id || null
  );

  const [optimisticImage, setOptimisticImage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isSelectionMode = selectedIds.length > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get the correct delete timestamp for the current user
  const getDeleteTime = useCallback(() => {
    return chat.user1_id === currentUser?.id
      ? chat.user1_deleted_at
      : chat.user2_deleted_at;
  }, [chat, currentUser]);

  useEffect(() => {
    setCurrentChatId(chat?.id || null);
  }, [chat?.id]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const formatJoinedDate = (dateString: string) => {
    if (!dateString) return "Dec 2025";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
      }).format(date);
    } catch (e) {
      return "Dec 2025";
    }
  };

  const downloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `IMG_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(url, "_blank");
    }
  };

  const markAsRead = useCallback(async () => {
    const activeId = currentChatId;
    if (!activeId || !currentUser?.id) return;
    try {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", activeId)
        .neq("user_id", currentUser.id)
        .eq("is_read", false);

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error clearing unread:", err);
    }
  }, [currentChatId, currentUser?.id, onRefresh]);

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
        <div className="flex items-center">
          <span className="text-emerald-500 font-bold tracking-tight text-[9px]">
            ONLINE
          </span>
        </div>
      );
    if (!chat.last_seen_db)
      return (
        <span className="text-zinc-400 font-bold text-[9px]">OFFLINE</span>
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
      <span className="text-zinc-400 font-bold text-[9px] uppercase tracking-wider">
        {statusText}
      </span>
    );
  };

  useEffect(() => {
    if (currentChatId) {
      markAsRead();
    }
  }, [currentChatId, markAsRead]);

  useEffect(() => {
    const activeId = currentChatId;
    if (!activeId) {
      setMessages([]);
      return;
    }

    const deleteTime = getDeleteTime();

    const loadMessages = async () => {
      let query = supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId);

      if (deleteTime) {
        query = query.gt("created_at", deleteTime);
      }

      const { data } = await query.order("created_at", { ascending: true });
      if (data) {
        setMessages(data);
      }
    };
    loadMessages();

    const msgChannel = supabase
      .channel(`chat_messages_${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (p) => {
          const currentDeleteTime = getDeleteTime();
          if (
            currentDeleteTime &&
            new Date(p.new.created_at) <= new Date(currentDeleteTime)
          )
            return;
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === p.new.id);
            if (exists) return prev;
            return [...prev, p.new];
          });
          if (p.new.user_id !== currentUser?.id) {
            markAsRead();
          }

          if (p.new.type === "image" && p.new.user_id === currentUser?.id) {
            setOptimisticImage(null);
            setIsUploading(false);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (p) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === p.new.id ? p.new : m))
          );
        }
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
    // FIX: Ensure dependencies here match the items that can actually change and are needed.
    // Ensure 'chat' and 'currentUser' properties used are stable.
  }, [currentChatId, currentUser?.id, markAsRead, chat, getDeleteTime]);

  useEffect(() => {
    if (!isSelectionMode) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, optimisticImage, isSelectionMode]);

  const ensureConversation = async () => {
    if (currentChatId) {
      return currentChatId;
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user1_id: currentUser.id,
        user2_id: chat.otherId,
      })
      .select()
      .single();
    if (error) return null;

    setCurrentChatId(data.id);
    return data.id;
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser?.id) return;

    const txt = newMessage;
    setNewMessage("");
    try {
      const activeChatId = await ensureConversation();
      if (!activeChatId) return;

      const now = new Date().toISOString();
      await Promise.all([
        supabase.from("messages").insert({
          conversation_id: activeChatId,
          user_id: currentUser.id,
          text: txt,
          type: "text",
          is_read: false,
          created_at: now, // Ensure timestamps match
        }),
        supabase
          .from("conversations")
          .update({
            last_message_text: txt,
            last_message_at: now, // This triggers the sidebar reappear logic
            last_message_user_id: currentUser.id,
          })
          .eq("id", activeChatId),
      ]);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleDeleteChat = async () => {
    if (!currentChatId || !currentUser?.id) return;
    const isUser1 = chat.user1_id === currentUser.id;
    const columnToUpdate = isUser1 ? "user1_deleted_at" : "user2_deleted_at";
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ [columnToUpdate]: new Date().toISOString() })
        .eq("id", currentChatId);
      if (error) throw error;

      if (onBack) onBack();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error archiving/deleting chat:", err);
    }
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

  const handleContextMenu = (
    e: React.MouseEvent,
    id: string,
    isMe: boolean
  ) => {
    if (!isMe) return;
    e.preventDefault();
    toggleSelect(id);
  };

  const handleImage = async (e: any) => {
    const file = e.target.files[0];
    if (!file || !currentUser?.id) return;

    setIsUploading(true);
    const previewUrl = URL.createObjectURL(file);
    setOptimisticImage(previewUrl);
    try {
      const activeChatId = await ensureConversation();
      if (!activeChatId) throw new Error("Could not initialize conversation");
      const path = `${activeChatId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const now = new Date().toISOString();

      await Promise.all([
        supabase.from("messages").insert({
          conversation_id: activeChatId,
          user_id: currentUser.id,
          text: publicUrl,
          type: "image",
          is_read: false,
          created_at: now,
        }),
        supabase
          .from("conversations")
          .update({
            last_message_text: "Shared an image",
            last_message_at: now,
            last_message_user_id: currentUser.id,
          })
          .eq("id", activeChatId),
      ]);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Upload error:", err);
      setIsUploading(false);
      setOptimisticImage(null);
    }
  };

  const getBubbleRadius = (
    isMe: boolean,
    isFirst: boolean,
    isLast: boolean
  ) => {
    const r = "18px";
    const s = "4px";
    if (isMe) return `${r} ${isFirst ? r : s} ${isLast ? r : s} ${r}`;
    return `${isFirst ? r : s} ${r} ${r} ${isLast ? r : s}`;
  };

  return (
    <div className="flex flex-1 h-dvh bg-[#1e2229] overflow-hidden relative text-white font-sans w-full">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -80, 50, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -120, 80, 0],
            y: [0, 100, -40, 0],
            scale: [1, 1.3, 1, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[15%] -right-[10%] w-[70%] h-[70%] rounded-full bg-indigo-400/5 blur-[140px]"
        />
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      <div className="flex flex-1 flex-col min-w-0 h-full border-r border-white/5 relative z-10 w-full overflow-hidden">
        <div className="pt-8 md:pt-[env(safe-area-inset-top,12px)] border-b border-white/5 bg-[#252a33]/85 backdrop-blur-xl z-30 shrink-0 shadow-lg">
          <div className="h-14 md:h-16 flex items-center px-4 md:px-5">
            <AnimatePresence mode="wait">
              {isSelectionMode ? (
                <motion.div
                  key="selection-bar"
                  initial={{ y: -5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -5, opacity: 0 }}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedIds([])}
                      className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400"
                    >
                      <X size={18} />
                    </button>
                    <span className="text-xs font-bold text-indigo-400">
                      {selectedIds.length} Selected
                    </span>
                  </div>
                  <button
                    onClick={handleDeleteMessages}
                    className="p-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 shadow-lg shadow-red-500/5"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="chat-header"
                  initial={{ y: 5, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 5, opacity: 0 }}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onBack}
                      className="md:hidden text-zinc-300 hover:text-white mr-1"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                      <div
                        className="relative cursor-pointer shrink-0"
                        onClick={() => setSidebarOpen(true)}
                      >
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-[13px] text-white shadow-md overflow-hidden">
                          {chat.avatar_url ? (
                            <img
                              src={chat.avatar_url}
                              className="w-full h-full object-cover"
                              alt=""
                            />
                          ) : (
                            chat.name?.charAt(0)
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <h2 className="text-[13px] md:text-sm font-bold tracking-tight text-white truncate leading-none mb-1">
                          {chat.name}
                        </h2>
                        <div className="flex items-center leading-none">
                          {renderStatus()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg bg-white/5 text-zinc-300 hover:text-white transition-all border border-white/5"
                  >
                    <Info size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-10 md:py-6 flex flex-col bg-transparent custom-scrollbar scroll-smooth relative">
          {messages.length > 0 || optimisticImage ? (
            <div className="flex flex-col w-full relative z-10">
              {messages.map((msg, index) => {
                const isMe = msg.user_id === currentUser?.id;
                const isSelected = selectedIds.includes(msg.id);
                const prevMsg = messages[index - 1];
                const nextMsg = messages[index + 1];
                const msgDate = new Date(msg.created_at);
                const nextMsgDate = nextMsg
                  ? new Date(nextMsg.created_at)
                  : null;
                const isSameNextUser =
                  nextMsg && nextMsg.user_id === msg.user_id;
                const isSameNextMinute =
                  nextMsgDate &&
                  msgDate.getMinutes() === nextMsgDate.getMinutes() &&
                  msgDate.getHours() === nextMsgDate.getHours() &&
                  msgDate.getDate() === nextMsgDate.getDate();
                const isFirstInGroup =
                  !prevMsg || prevMsg.user_id !== msg.user_id;
                const shouldShowTimestamp =
                  !isSameNextUser || !isSameNextMinute;
                const isLastInVisualGroup =
                  !nextMsg || nextMsg.user_id !== msg.user_id;

                return (
                  <div
                    key={`${msg.id}-${msg.created_at}`}
                    onContextMenu={(e) => handleContextMenu(e, msg.id, isMe)}
                    className={`w-full flex relative group transition-all duration-300 ${
                      isMe ? "flex-row-reverse" : "flex-row"
                    } ${shouldShowTimestamp ? "mb-3" : "mb-[2px]"}`}
                  >
                    <AnimatePresence>
                      {isSelectionMode && isMe && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, width: 0 }}
                          animate={{ opacity: 1, scale: 1, width: "auto" }}
                          exit={{ opacity: 0, scale: 0.5, width: 0 }}
                          className="flex items-center ml-3"
                        >
                          <button
                            onClick={() => toggleSelect(msg.id)}
                            className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center
                            ${
                              isSelected
                                ? "bg-indigo-500 border-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.4)]"
                                : "border-white/20 bg-white/5 hover:border-indigo-400"
                            }`}
                          >
                            <Check
                              size={10}
                              className={`text-white transition-opacity ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                              strokeWidth={4}
                            />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div
                      className={`flex flex-col flex-1 ${
                        isMe ? "items-end" : "items-start"
                      }`}
                      onClick={() =>
                        isSelectionMode && isMe && toggleSelect(msg.id)
                      }
                    >
                      <motion.div
                        initial={
                          isFirstInGroup ? { opacity: 0, scale: 0.95 } : false
                        }
                        animate={{
                          opacity: 1,
                          scale: 1,
                          backgroundColor: isSelected
                            ? isMe
                              ? "#4f46e5"
                              : "#40495a"
                            : msg.type === "image"
                            ? "transparent"
                            : isMe
                            ? "#4f46e5"
                            : "#2d3442",
                        }}
                        style={{
                          borderRadius:
                            msg.type === "image"
                              ? "12px"
                              : getBubbleRadius(
                                  isMe,
                                  isFirstInGroup,
                                  isLastInVisualGroup
                                ),
                        }}
                        className={`w-fit min-w-[32px] max-w-[85%] md:max-w-[70%] transition-all duration-200 relative overflow-hidden shadow-sm ${
                          msg.type !== "image"
                            ? `px-4 py-2 md:py-2.5 text-[13.5px] leading-relaxed ${
                                isMe
                                  ? "text-white"
                                  : "text-slate-100 font-medium"
                              }`
                            : ""
                        }`}
                      >
                        {msg.type === "image" ? (
                          <div
                            className="relative group/img cursor-zoom-in"
                            onClick={() => setSelectedImage(msg.text)}
                          >
                            <img
                              src={msg.text}
                              className={`rounded-xl max-h-48 md:max-h-64 w-auto object-cover transition-all duration-300 group-hover/img:brightness-90 ${
                                isSelected ? "brightness-50" : ""
                              }`}
                              alt="Shared"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <div className="p-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
                                <Maximize2 size={18} className="text-white" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words relative z-10">
                            {msg.text}
                          </p>
                        )}
                      </motion.div>
                      <div
                        className={`flex items-center gap-1.5 mt-1.5 ${
                          isMe ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {shouldShowTimestamp && (
                          <span className="text-[7.5px] font-medium text-zinc-400/30 uppercase tracking-[0.12em]">
                            {msgDate.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </span>
                        )}
                        {isMe && (
                          <div className="flex items-center opacity-70">
                            {msg.is_read ? (
                              <CheckCheck size={11} className="text-sky-400" />
                            ) : (
                              <Check size={11} className="text-zinc-400" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {optimisticImage && (
                <div className="w-full flex flex-row-reverse mb-3">
                  <div className="flex flex-col items-end flex-1">
                    <div className="relative w-fit max-w-[200px] rounded-xl overflow-hidden border border-white/10 bg-[#2d3442]/50">
                      <img
                        src={optimisticImage}
                        className="max-h-40 object-cover opacity-40 grayscale-[0.5]"
                        alt="Uploading..."
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-600/80 flex items-center justify-center shadow-xl">
                          <Loader2
                            className="animate-spin text-white"
                            size={16}
                          />
                        </div>
                        <span className="text-[8px] font-bold text-white uppercase tracking-widest bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                          Sending...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} className="h-4" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="p-4 rounded-full bg-indigo-500/5 border border-indigo-500/10">
                <MessageSquare size={18} className="text-indigo-500/30" />
              </div>
              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.15em]">
                Encrypted Connection
              </p>
            </div>
          )}
        </div>

        <div className="px-4 py-4 md:px-6 md:py-4 bg-[#252a33]/85 backdrop-blur-xl border-t border-white/5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={handleSend}
            className="flex gap-2 md:gap-3 items-center max-w-4xl mx-auto"
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
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-zinc-300 hover:text-white bg-white/5 rounded-lg transition-all border border-white/5 disabled:opacity-50"
            >
              <Paperclip size={16} />
            </button>
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message..."
              className="flex-1 bg-[#2d3442] border border-white/10 text-white text-[13.5px] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/40 transition-all placeholder:text-zinc-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-indigo-600 text-white h-10 w-10 flex items-center justify-center rounded-xl hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-md shadow-indigo-600/10"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Sidebar / Info Panel */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full lg:relative lg:w-[320px] h-full bg-[#252a33] border-l border-white/5 flex flex-col z-[100] overflow-hidden shadow-2xl"
            >
              <div className="pt-8 md:pt-0 h-16 px-5 border-b border-white/5 flex items-center justify-between bg-black/5">
                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                  Contact Details
                </h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-6 flex flex-col items-center border-b border-white/5">
                  <div className="relative mb-4 group/pfp">
                    <div
                      onClick={() => setIsZoomed(true)}
                      className="w-20 h-20 rounded-2xl bg-indigo-600 p-0.5 shadow-lg cursor-zoom-in active:scale-95 transition-transform"
                    >
                      <div className="w-full h-full rounded-[14px] bg-[#252a33] overflow-hidden border-2 border-[#252a33] relative">
                        {chat.avatar_url ? (
                          <img
                            src={chat.avatar_url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-2xl font-bold">
                            {chat.name?.charAt(0)}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover/pfp:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover/pfp:opacity-100">
                          <Maximize2
                            size={16}
                            className="text-white shadow-lg"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <h2 className="text-lg font-bold tracking-tight text-white mb-0.5">
                    {chat.name}
                  </h2>
                  <div className="mb-4">{renderStatus()}</div>
                  <div className="w-full grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center text-center">
                      <Calendar size={14} className="text-indigo-400 mb-1.5" />
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">
                        Joined
                      </span>
                      <span className="text-[11px] font-bold text-slate-200">
                        {formatJoinedDate(chat.created_at)}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center text-center">
                      <Shield size={14} className="text-emerald-400 mb-1.5" />
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">
                        Privacy
                      </span>
                      <span className="text-[11px] font-bold text-slate-200">
                        Verified
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail size={12} className="text-indigo-400" />
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                      Email Address
                    </h4>
                  </div>
                  <p className="text-[13px] text-slate-300 font-medium truncate">
                    {chat.email || "No email provided"}
                  </p>
                </div>
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={12} className="text-indigo-400" />
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                      Bio
                    </h4>
                  </div>
                  <p className="text-[13px] text-slate-300 leading-relaxed italic">
                    {chat.bio || "No information shared."}
                  </p>
                </div>
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={12} className="text-indigo-400" />
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                        Media
                      </h4>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-500/10 rounded text-indigo-400">
                      {sharedMedia.length}
                    </span>
                  </div>
                  {sharedMedia.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {sharedMedia.slice(0, 12).map((url, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-lg bg-[#2d3442] overflow-hidden border border-white/5 cursor-pointer hover:border-indigo-500/50 transition-colors"
                          onClick={() => setSelectedImage(url)}
                        >
                          <img
                            src={url}
                            className="w-full h-full object-cover opacity-90"
                            alt=""
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                      <span className="text-[9px] font-bold text-zinc-600 uppercase">
                        Empty
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Trash2 size={12} className="text-red-400" />
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                      Danger Zone
                    </h4>
                  </div>
                  <button
                    onClick={handleDeleteChat}
                    className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Delete Chat For Me
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-10 bg-black/95 backdrop-blur-md"
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-6 left-6 p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white z-[310] transition-all"
              onClick={() => setSelectedImage(null)}
            >
              <X size={20} />
            </button>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative max-w-5xl max-h-full flex items-center justify-center group"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage}
                className="max-w-full max-h-[80vh] md:max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/5"
                alt="Enlarged view"
              />
              <button
                onClick={() => downloadImage(selectedImage)}
                className="absolute top-4 right-4 p-3 rounded-2xl bg-black/60 backdrop-blur-xl text-white hover:bg-indigo-600 border border-white/10 shadow-xl transition-all active:scale-90"
                title="Download to device"
              >
                <Download size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setIsZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full aspect-square rounded-3xl overflow-hidden shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsZoomed(false)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:text-white backdrop-blur-md transition-all"
              >
                <X size={20} />
              </button>
              {chat.avatar_url ? (
                <img
                  src={chat.avatar_url}
                  className="w-full h-full object-cover"
                  alt={chat.name}
                />
              ) : (
                <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-7xl font-bold text-white">
                  {chat.name?.charAt(0)}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/40 to-transparent">
                <h3 className="text-2xl font-bold text-white mb-1">
                  {chat.name}
                </h3>
                <p className="text-zinc-400 text-sm">
                  {isOnline ? "Active Now" : "Offline"}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
