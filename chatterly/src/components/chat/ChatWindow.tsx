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
  Pencil,
  ChevronRight,
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAllMedia, setShowAllMedia] = useState(false);
  const isSelectionMode = selectedIds.length > 0;

  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    msg: any;
  } | null>(null);

  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [floatingDate, setFloatingDate] = useState("");
  const [showFloatingDate, setShowFloatingDate] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<any>(null);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isLongPressActive = useRef(false);

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

  const handleScroll = () => {
    if (!messageContainerRef.current) return;
    const container = messageContainerRef.current;
    const scrollTop = container.scrollTop;
    const elements = container.querySelectorAll("[data-date-marker]");
    let currentVisibleDate = "";
    let isAnyInlineDateVisible = false;

    elements.forEach((el: Element) => {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const isVisible =
        rect.top >= containerRect.top && rect.bottom <= containerRect.bottom;
      if (isVisible) isAnyInlineDateVisible = true;
      if (htmlEl.offsetTop <= scrollTop + container.offsetTop + 50) {
        currentVisibleDate = htmlEl.getAttribute("data-date-marker") || "";
      }
    });

    if (currentVisibleDate && currentVisibleDate !== "Today")
      setFloatingDate(currentVisibleDate);
    if (
      isAnyInlineDateVisible ||
      scrollTop < 50 ||
      currentVisibleDate === "Today" ||
      !currentVisibleDate
    ) {
      setShowFloatingDate(false);
    } else {
      setShowFloatingDate(true);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(
        () => setShowFloatingDate(false),
        2000
      );
    }
  };

  useEffect(() => {
    if (!currentChatId || !currentUser?.id) return;
    presenceChannelRef.current = supabase.channel(
      `chat_presence_${currentChatId}`
    );
    presenceChannelRef.current
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannelRef.current.presenceState();
        const otherId = chat.otherId;
        const typingUsers = Object.values(state).flat() as any[];
        const isTyping = typingUsers.some(
          (p: any) =>
            p.user_id === otherId && p.typing_chat_id === currentChatId
        );
        setIsOtherTyping(isTyping);
      })
      .subscribe();
    return () => {
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
    };
  }, [currentChatId, currentUser?.id, chat.otherId]);

  const handleTyping = () => {
    if (!presenceChannelRef.current || !currentUser?.id) return;
    presenceChannelRef.current.track({
      user_id: currentUser.id,
      typing_chat_id: currentChatId,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(
      () => presenceChannelRef.current.untrack(),
      2500
    );
  };

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
      console.error(err);
    }
  }, [currentChatId, currentUser?.id, onRefresh]);

  const isOnline = useMemo(
    () => presence && !!presence[chat.otherId],
    [presence, chat.otherId]
  );
  const sharedMedia = useMemo(
    () => messages.filter((m) => m.type === "image").map((m) => m.text),
    [messages]
  );

  const renderStatus = () => {
    if (isOtherTyping)
      return (
        <div className="flex items-center">
          <span className="text-indigo-400 font-bold tracking-tight text-[9px] animate-pulse">
            TYPING...
          </span>
        </div>
      );
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
    const diffInSecs = Math.floor(
      (new Date().getTime() - lastSeenDate.getTime()) / 1000
    );
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
      if (deleteTime) query = query.gt("created_at", deleteTime);
      const { data } = await query.order("created_at", { ascending: true });
      if (data) setMessages(data);
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
          setMessages((prev) =>
            prev.some((m) => m.id === p.new.id) ? prev : [...prev, p.new]
          );
          if (p.new.user_id !== currentUser?.id) markAsRead();
          if (p.new.type === "image" && p.new.user_id === currentUser?.id)
            setIsUploading(false);
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
        (p) => {
          setMessages((prev) => prev.filter((m) => m.id !== p.old.id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [currentChatId, currentUser?.id, markAsRead, chat, getDeleteTime]);

  useEffect(() => {
    if (!isSelectionMode)
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isSelectionMode]);

  const ensureConversation = async () => {
    if (currentChatId) return currentChatId;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user1_id: currentUser.id, user2_id: chat.otherId })
      .select()
      .single();
    if (error) return null;
    setCurrentChatId(data.id);
    return data.id;
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser?.id) return;
    if (editingMessage) {
      const updatedText = newMessage.trim();
      if (updatedText === editingMessage.text) {
        setEditingMessage(null);
        setNewMessage("");
        return;
      }
      const msgId = editingMessage.id;
      setNewMessage("");
      setEditingMessage(null);
      try {
        await supabase
          .from("messages")
          .update({ text: updatedText, is_edited: true })
          .eq("id", msgId);
      } catch (err) {
        console.error(err);
      }
      return;
    }
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
          created_at: now,
        }),
        supabase
          .from("conversations")
          .update({
            last_message_text: txt,
            last_message_at: now,
            last_message_user_id: currentUser.id,
          })
          .eq("id", activeChatId),
      ]);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
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

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleContextMenu = (e: React.MouseEvent, msg: any) => {
    if (msg.user_id !== currentUser?.id) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msg });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: any) => {
    if (msg.user_id !== currentUser?.id) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isLongPressActive.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      setContextMenu({
        x: window.innerWidth / 2 - 60,
        y: window.innerHeight / 2 - 50,
        msg,
      });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 700);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isLongPressActive.current) e.preventDefault();
  };

  const startEditing = (msg: any) => {
    setEditingMessage(msg);
    setNewMessage(msg.text);
    setContextMenu(null);
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;
    setIsUploading(true);
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
      setIsUploading(false);
    }
  };

  const getBubbleRadius = (
    isMe: boolean,
    isFirst: boolean,
    isLast: boolean
  ) => {
    const r = "18px",
      s = "4px";
    return isMe
      ? `${r} ${isFirst ? r : s} ${isLast ? r : s} ${r}`
      : `${isFirst ? r : s} ${r} ${r} ${isLast ? r : s}`;
  };

  const getDateLabel = (date: Date) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (date.toDateString() === today) return "Today";
    if (date.toDateString() === yesterday) return "Yesterday";
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Improved actual download function
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `IMG_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <div
      className="flex flex-1 h-dvh bg-[#1e2229] overflow-hidden relative text-white font-sans w-full"
      onClick={() => setContextMenu(null)}
    >
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

        <div className="flex-1 overflow-hidden relative">
          <div
            className={`absolute top-4 left-0 right-0 z-50 flex justify-center pointer-events-none transition-opacity duration-300 ${
              showFloatingDate ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="px-3 py-1 rounded-full bg-[#252a33]/90 backdrop-blur-md border border-white/10 text-[10px] font-bold text-zinc-200 uppercase tracking-widest shadow-2xl">
              {floatingDate}
            </span>
          </div>
          <div
            ref={messageContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto px-4 py-4 md:px-10 md:py-6 flex flex-col bg-transparent custom-scrollbar scroll-smooth"
          >
            {messages.length > 0 ? (
              <div className="flex flex-col w-full relative z-10">
                {messages.map((msg, index) => {
                  const isMe = msg.user_id === currentUser?.id;
                  const isSelected = selectedIds.includes(msg.id);
                  const prevMsg = messages[index - 1],
                    nextMsg = messages[index + 1];
                  const msgDate = new Date(msg.created_at);
                  const nextMsgDate = nextMsg
                    ? new Date(nextMsg.created_at)
                    : null;
                  const isSameNextUser =
                    nextMsg && nextMsg.user_id === msg.user_id;
                  const isFirstInGroup =
                    !prevMsg || prevMsg.user_id !== msg.user_id;
                  const shouldShowTimestamp =
                    !isSameNextUser ||
                    (nextMsgDate &&
                      msgDate.getMinutes() !== nextMsgDate.getMinutes());
                  const isLastInVisualGroup =
                    !nextMsg || nextMsg.user_id !== msg.user_id;
                  const label = getDateLabel(msgDate);
                  const showInlineDate =
                    !prevMsg ||
                    new Date(prevMsg.created_at).toDateString() !==
                      msgDate.toDateString();
                  return (
                    <React.Fragment key={`${msg.id}-${msg.created_at}`}>
                      {showInlineDate && (
                        <div
                          data-date-marker={label}
                          className="flex justify-center my-6"
                        >
                          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            {label}
                          </span>
                        </div>
                      )}
                      <div
                        onContextMenu={(e) => handleContextMenu(e, msg)}
                        onTouchStart={(e) => handleTouchStart(e, msg)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className={`w-full flex relative group transition-all duration-300 ${
                          isMe ? "flex-row-reverse" : "flex-row"
                        } ${shouldShowTimestamp ? "mb-3" : "mb-[2px]"}`}
                      >
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
                              isFirstInGroup
                                ? { opacity: 0, scale: 0.95 }
                                : false
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
                                    <Maximize2
                                      size={18}
                                      className="text-white"
                                    />
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
                            {msg.is_edited && (
                              <span className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-0.5">
                                • <span className="italic">Edited</span>
                              </span>
                            )}
                            {isMe && (
                              <div className="flex items-center opacity-70">
                                {msg.is_read ? (
                                  <CheckCheck
                                    size={11}
                                    className="text-sky-400"
                                  />
                                ) : (
                                  <Check size={11} className="text-zinc-400" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
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
        </div>

        <div className="px-4 py-4 md:px-6 md:py-4 bg-[#252a33]/85 backdrop-blur-xl border-t border-white/5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {editingMessage && (
            <div className="flex items-center justify-between px-3 py-2 bg-indigo-500/10 border-l-2 border-indigo-500 mb-2 rounded-r-lg">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  Editing Message
                </span>
                <p className="text-[11px] text-slate-300 truncate italic">
                  {editingMessage.text}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingMessage(null);
                  setNewMessage("");
                }}
                className="p-1 hover:bg-white/10 rounded-full text-zinc-400"
              >
                <X size={14} />
              </button>
            </div>
          )}
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
              {isUploading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Paperclip size={16} />
              )}
            </button>
            <input
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder={editingMessage ? "Edit message..." : "Message..."}
              className="flex-1 bg-[#2d3442] border border-white/10 text-white text-[13.5px] rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/40 transition-all placeholder:text-zinc-500"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-indigo-600 text-white h-10 w-10 flex items-center justify-center rounded-xl hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-md shadow-indigo-600/10"
            >
              {editingMessage ? <Check size={16} /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>

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
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                        Member Since
                      </span>
                      <span className="text-[11px] font-bold text-white">
                        {formatJoinedDate(chat.created_at)}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center text-center">
                      <Shield size={14} className="text-emerald-400 mb-1.5" />
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                        Status
                      </span>
                      <span className="text-[11px] font-bold text-white">
                        Verified
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-5 border-b border-white/5">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 mb-4 px-1">
                    Contact Information
                  </h4>
                  <div className="space-y-1">
                    <div className="flex flex-col gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-indigo-400" />
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                          Username
                        </span>
                      </div>
                      <span className="text-[12px] font-medium text-white truncate pl-5">
                        @{chat.name?.toLowerCase().replace(/\s+/g, "_")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-indigo-400" />
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                          Email Address
                        </span>
                      </div>
                      <span className="text-[12px] font-medium text-white truncate pl-5 group-hover:text-indigo-400 group-hover:underline transition-all underline-offset-4">
                        {chat.email || "No email shared"}
                      </span>
                    </div>
                  </div>
                </div>
                {sharedMedia.length > 0 && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
                        Shared Media
                      </h4>
                      <button
                        onClick={() => setShowAllMedia(true)}
                        className="p-1 hover:bg-white/10 rounded-full transition-all text-indigo-400 hover:translate-x-1"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {sharedMedia.slice(0, 6).map((url, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedImage(url)}
                          className="aspect-square rounded-lg bg-white/5 overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all relative group/m"
                        >
                          <img
                            src={url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/m:opacity-100 transition-opacity flex items-center justify-center">
                            <Maximize2 size={14} className="text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 bg-black/10 border-t border-white/5">
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.2em] text-center">
                  Secure End-to-End Encryption
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAllMedia && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-[250] bg-[#1e2229] flex flex-col"
          >
            <div className="h-16 md:h-20 flex items-center justify-between px-6 border-b border-white/5 bg-[#252a33]/80 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAllMedia(false)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3 className="text-sm font-bold tracking-widest uppercase text-zinc-300">
                  Shared Media
                </h3>
              </div>
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full uppercase">
                {sharedMedia.length} Files
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-8 px-4 md:px-16 lg:px-32">
              <div className="max-w-7xl mx-auto grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                {sharedMedia.map((url, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedImage(url)}
                    className="aspect-square rounded-2xl bg-white/5 overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all group relative"
                  >
                    <img
                      src={url}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isZoomed && chat.avatar_url && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsZoomed(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative max-w-lg w-full aspect-square"
            >
              <img
                src={chat.avatar_url}
                className="w-full h-full object-contain rounded-[32px] shadow-2xl"
                alt="Zoomed Avatar"
              />
              <button
                onClick={() => setIsZoomed(false)}
                className="absolute -top-10 right-0 p-2 text-white hover:text-indigo-400 transition-colors"
              >
                <X size={24} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[400] flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-3xl"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full flex flex-col"
            >
              {/* FIXED ACTION BAR - No Overlap */}
              <div className="h-20 md:h-28 flex items-center justify-center px-6 shrink-0 z-10">
                <div className="flex items-center gap-4 bg-white/5 backdrop-blur-2xl border border-white/10 p-2.5 rounded-[24px] shadow-2xl">
                  <button
                    onClick={() => handleDownload(selectedImage)}
                    className="p-3 hover:bg-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all hover:scale-105 active:scale-95"
                  >
                    <Download size={20} />
                  </button>
                  <div className="w-[1px] h-6 bg-white/10" />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white transition-all shadow-xl shadow-indigo-600/20 hover:scale-105 active:scale-95"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* IMAGE AREA - Contained below action bar */}
              <div className="flex-1 flex items-center justify-center p-4 md:p-12 mb-8 overflow-hidden">
                <motion.img
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  src={selectedImage}
                  className="max-w-[90%] max-h-[60vh] md:max-h-[70vh] object-contain rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/5 bg-black/20"
                  alt="Zoomed View"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="fixed z-[500] min-w-[120px] bg-[#2d3442]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => startEditing(contextMenu.msg)}
              className="w-full px-4 py-2 flex items-center gap-2.5 text-slate-200 hover:bg-white/10 transition-colors text-[11px] font-bold uppercase tracking-widest"
            >
              <Pencil size={14} className="text-indigo-400" />
              Edit
            </button>
            <button
              onClick={() => {
                toggleSelect(contextMenu.msg.id);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 flex items-center gap-2.5 text-slate-200 hover:bg-white/10 transition-colors text-[11px] font-bold uppercase tracking-widest"
            >
              <Trash2 size={14} className="text-red-400" />
              Select
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
