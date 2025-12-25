"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  User,
  LogOut,
  X,
  Mail,
  Check,
  CheckCheck,
  Edit2,
  Archive,
  ArchiveRestore,
  MessageSquarePlus,
  Image as ImageIcon,
  Camera,
  Loader2,
  ShieldCheck,
  Trash2,
  Circle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence, Transition } from "framer-motion";

export function ChatSidebar({
  chats,
  selectedId,
  onSelectChat,
  profile,
  onNewChat,
  presence,
  currentUserId,
  onRefresh,
}: any) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showZoomedAvatar, setShowZoomedAvatar] = useState(false);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isLongPress = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedBio, setEditedBio] = useState("");

  const fastTransition: Transition = {
    type: "spring",
    stiffness: 500,
    damping: 30,
    mass: 1,
  };

  useEffect(() => {
    if (profile) {
      setEditedName(profile.full_name || "");
      setEditedBio(profile.bio || "");
    }
  }, [profile]);

  useEffect(() => {
    const clearUnreadMessages = async () => {
      if (!selectedId || !currentUserId) return;
      const currentChat = chats.find((c: any) => c.id === selectedId);
      if (
        currentChat &&
        currentChat.unread_count > 0 &&
        currentChat.last_msg_user_id !== currentUserId
      ) {
        try {
          await supabase
            .from("messages")
            .update({ is_read: true })
            .eq("conversation_id", selectedId)
            .eq("is_read", false)
            .neq("user_id", currentUserId);

          if (onRefresh) onRefresh();
        } catch (err) {
          console.error("Error clearing unread:", err);
        }
      }
    };
    clearUnreadMessages();
  }, [selectedId, currentUserId, chats, onRefresh]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUserId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", currentUserId);

      if (updateError) throw updateError;
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error uploading avatar:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const updateProfile = async (field: string, value: string) => {
    if (profile && profile[field] === value) return;
    try {
      if (!currentUserId) return;
      if (field === "full_name") setEditedName(value);
      if (field === "bio") setEditedBio(value);

      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value })
        .eq("id", currentUserId);

      if (error) throw error;
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error updating profile:", err);
      if (profile) {
        if (field === "full_name") setEditedName(profile.full_name);
        if (field === "bio") setEditedBio(profile.bio);
      }
    }
  };

  const toggleSelection = (chatId: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId)
        ? prev.filter((id) => id !== chatId)
        : [...prev, chatId]
    );
  };

  const handleRightClick = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    toggleSelection(chatId);
  };

  const handleTouchStart = (e: React.TouchEvent, chatId: string) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isLongPress.current = false;

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      toggleSelection(chatId);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const touch = e.touches[0];
    const moveX = Math.abs(touch.clientX - touchStartPos.current.x);
    const moveY = Math.abs(touch.clientY - touchStartPos.current.y);

    if (moveX > 10 || moveY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, chatId: string) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;

      // If the timer was still active, it wasn't a long press
      if (!isLongPress.current) {
        if (selectedChatIds.length > 0) {
          toggleSelection(chatId);
        } else {
          onSelectChat(chatId);
        }
      }
    }
    touchStartPos.current = null;
  };

  const handleBulkArchive = async () => {
    if (selectedChatIds.length === 0) return;
    const shouldArchive = view === "active";

    try {
      if (selectedId && selectedChatIds.includes(selectedId)) {
        onSelectChat(null);
      }

      const updates = selectedChatIds.map(async (chatId) => {
        const localChat = chats.find((c: any) => c.id === chatId);
        if (!localChat) return;
        const column =
          localChat.user1_id === currentUserId
            ? "user1_archived"
            : "user2_archived";
        return supabase
          .from("conversations")
          .update({ [column]: shouldArchive })
          .eq("id", chatId);
      });

      await Promise.all(updates);
      setSelectedChatIds([]);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error archiving chats:", err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedChatIds.length === 0) return;
    if (!confirm("Delete selected chats? This will clear history for you."))
      return;
    try {
      if (selectedId && selectedChatIds.includes(selectedId)) {
        onSelectChat(null);
      }
      const deleteTime = new Date().toISOString();
      const updates = selectedChatIds.map(async (chatId) => {
        const localChat = chats.find((c: any) => c.id === chatId);
        if (!localChat) return;
        const isUser1 = localChat.user1_id === currentUserId;
        const deleteCol = isUser1 ? "user1_deleted_at" : "user2_deleted_at";
        const hideCol = isUser1 ? "user1_is_hidden" : "user2_is_hidden";
        return supabase
          .from("conversations")
          .update({ [deleteCol]: deleteTime, [hideCol]: true })
          .eq("id", chatId);
      });

      await Promise.all(updates);
      setSelectedChatIds([]);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Error deleting chats:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = "/auth";
    } catch (error) {
      console.error("Sign out failed", error);
      window.location.href = "/auth";
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  };

  const archivedCount = chats.filter((chat: any) => {
    return chat.user1_id === currentUserId
      ? chat.user1_archived
      : chat.user2_archived;
  }).length;

  const filteredChats = chats.filter((chat: any) => {
    const matchesSearch = chat.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const isUser1 = chat.user1_id === currentUserId;
    const isActuallyArchived = isUser1
      ? chat.user1_archived
      : chat.user2_archived;
    const isHiddenForMe = isUser1 ? chat.user1_is_hidden : chat.user2_is_hidden;
    if (isHiddenForMe) return false;
    const matchesView =
      view === "archived" ? !!isActuallyArchived : !isActuallyArchived;
    return matchesSearch && matchesView;
  });

  const isUserOnline = presence && !!presence[currentUserId];

  return (
    <div className="flex flex-col h-full bg-[#1e2229] border-r border-white/5 w-full select-none relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[35%] h-[35%] rounded-full bg-indigo-500/10 blur-[80px]" />
        <div className="absolute bottom-[15%] right-[-5%] w-[25%] h-[25%] rounded-full bg-indigo-600/5 blur-[70px]" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="px-5 pt-8 md:pt-10 pb-4 h-[90px] md:h-[100px] flex items-center justify-between overflow-hidden">
          <AnimatePresence mode="popLayout">
            {selectedChatIds.length === 0 ? (
              <motion.div
                key="default-header"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                transition={fastTransition}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg overflow-hidden shadow-lg shadow-indigo-500/20 relative group">
                    <svg
                      viewBox="0 0 100 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-full h-full"
                    >
                      <rect
                        width="100"
                        height="100"
                        rx="22"
                        fill="url(#sidebar-logo-grad)"
                      />
                      <text
                        x="50%"
                        y="53%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="55"
                        fontWeight="bold"
                        fontFamily="Inter, system-ui, sans-serif"
                        style={{
                          filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.2))",
                        }}
                      >
                        C
                      </text>
                      <defs>
                        <linearGradient
                          id="sidebar-logo-grad"
                          x1="0"
                          y1="0"
                          x2="100"
                          y2="100"
                          gradientUnits="userSpaceOnUse"
                        >
                          <stop stopColor="#6366f1" />
                          <stop offset="1" stopColor="#4338ca" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <h1 className="text-lg font-black tracking-tight text-white">
                    Chatterly
                  </h1>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowProfileModal(true)}
                  className="w-10 h-10 rounded-2xl border border-white/10 p-0.5 bg-white/5 overflow-hidden transition-transform shadow-xl relative"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      className="w-full h-full rounded-[14px] object-cover"
                      alt=""
                    />
                  ) : (
                    <User size={18} className="m-auto text-zinc-400" />
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="action-header"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={fastTransition}
                className="flex items-center justify-between w-full bg-[#252a33]/80 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-2 mb-2 shadow-2xl"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedChatIds([])}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    title="Cancel selection"
                  >
                    <X size={18} />
                  </button>
                  <div className="h-4 w-[1px] bg-white/10 mx-1" />
                  <div className="flex items-center justify-center px-1">
                    <span className="text-indigo-500 font-bold text-sm">
                      {selectedChatIds.length}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleBulkArchive}
                    className="p-2.5 bg-white/5 hover:bg-indigo-500 text-zinc-300 hover:text-white rounded-xl transition-all shadow-lg"
                    title={
                      view === "active"
                        ? "Archive selected"
                        : "Restore selected"
                    }
                  >
                    {view === "active" ? (
                      <Archive size={18} />
                    ) : (
                      <ArchiveRestore size={18} />
                    )}
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all shadow-lg"
                    title="Delete for me"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-4 mt-2 mb-4">
          <div className="relative group">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-500 transition-colors"
              size={14}
            />
            <input
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchTerm(e.target.value)
              }
              placeholder="Search conversations..."
              className="w-full bg-[#252a33]/60 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-[12px] outline-none text-white focus:border-indigo-500/40 transition-all"
            />
          </div>
        </div>

        <div className="px-4 mb-4 flex gap-2">
          <button
            onClick={() => {
              setView("active");
              setSelectedChatIds([]);
            }}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
              view === "active"
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "bg-white/5 text-zinc-500 hover:bg-white/10"
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => {
              setView("archived");
              setSelectedChatIds([]);
            }}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              view === "archived"
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "bg-white/5 text-zinc-500 hover:bg-white/10"
            }`}
          >
            Archived{" "}
            {archivedCount > 0 && (
              <span className="opacity-60">{archivedCount}</span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-10 space-y-1.5 custom-scrollbar relative z-10">
          <AnimatePresence initial={false}>
            {filteredChats.length > 0 ? (
              filteredChats.map((chat: any) => {
                const isSelected = selectedId === chat.id;
                const isMultiSelected = selectedChatIds.includes(chat.id);
                const isOnline = presence && !!presence[chat.otherId];
                const isMe = chat.last_msg_user_id === currentUserId;
                const hasUnread = chat.unread_count > 0 && !isSelected && !isMe;

                return (
                  <motion.button
                    layout
                    key={chat.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    onContextMenu={(e: React.MouseEvent) =>
                      handleRightClick(e, chat.id)
                    }
                    onTouchStart={(e: React.TouchEvent) =>
                      handleTouchStart(e, chat.id)
                    }
                    onTouchMove={handleTouchMove}
                    onTouchEnd={(e: React.TouchEvent) =>
                      handleTouchEnd(e, chat.id)
                    }
                    onClick={() => {
                      // Only use onClick for non-touch devices or as a fallback
                      if (selectedChatIds.length > 0) {
                        toggleSelection(chat.id);
                      } else {
                        onSelectChat(chat.id);
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-[24px] transition-all border relative flex-shrink-0 ${
                      isMultiSelected
                        ? "bg-indigo-500/20 border-indigo-500/50"
                        : isSelected
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 border-white/20 shadow-xl"
                        : "hover:bg-white/5 border-transparent text-zinc-300"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-12 h-12 rounded-[18px] overflow-hidden border ${
                          isSelected ? "border-white/40" : "border-white/5"
                        }`}
                      >
                        {chat.avatar_url ? (
                          <img
                            src={chat.avatar_url}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-sm bg-[#2d3442] text-zinc-400">
                            {chat.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                      {isMultiSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-[#1e2229] shadow-lg">
                          <Check size={10} className="text-white font-bold" />
                        </div>
                      )}
                      {isOnline && !isMultiSelected && (
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-[2.5px] rounded-full ${
                            isSelected
                              ? "border-indigo-600"
                              : "border-[#1e2229]"
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-center mb-0.5">
                        <span
                          className={`text-[13.5px] truncate font-bold ${
                            isSelected ? "text-white" : "text-slate-100"
                          }`}
                        >
                          {chat.name}
                        </span>
                        <span
                          className={`text-[10px] ${
                            isSelected ? "text-indigo-100" : "text-zinc-500"
                          }`}
                        >
                          {formatTime(chat.last_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {isMe && (
                            <span
                              className={
                                isSelected ? "text-white" : "text-blue-500"
                              }
                            >
                              {chat.last_msg_is_read ? (
                                <CheckCheck
                                  size={14}
                                  className="drop-shadow-[0_0_3px_rgba(59,130,246,0.5)]"
                                />
                              ) : (
                                <Check size={14} className="text-zinc-500" />
                              )}
                            </span>
                          )}
                          <p
                            className={`text-[11.5px] truncate ${
                              isSelected
                                ? "text-indigo-100/80"
                                : "text-zinc-500"
                            }`}
                          >
                            {chat.last_msg === "shared an image" ? (
                              <span className="flex items-center gap-1">
                                <ImageIcon size={12} /> Photo
                              </span>
                            ) : (
                              chat.last_msg || "New chat"
                            )}
                          </p>
                        </div>
                        {hasUnread && (
                          <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/50" />
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-20">
                <MessageSquarePlus size={40} className="mb-4" />
                <p className="text-xs">No conversations found</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-6 right-6 z-[100]">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-1 rounded-[22px] bg-[#1e2229]/40 backdrop-blur-md border border-white/10"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onNewChat}
              className="w-11 h-11 bg-indigo-500 text-white rounded-[18px] flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.4)] shadow-indigo-500/30 border border-white/20"
            >
              <Plus size={22} strokeWidth={3} />
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Profile and Zoom Modals are unchanged below */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isUploading && setShowProfileModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-[340px] bg-[#1a1b1e] border border-white/10 rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.7)] overflow-hidden"
            >
              <div className="h-24 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 relative">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="absolute top-3 right-3 p-1.5 bg-black/10 hover:bg-black/30 text-white rounded-full transition-all backdrop-blur-md"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 pb-8 -mt-10 relative">
                <div className="relative inline-block mb-3">
                  <div
                    onClick={() =>
                      profile?.avatar_url && setShowZoomedAvatar(true)
                    }
                    className={`w-20 h-20 rounded-[24px] border-[4px] border-[#1a1b1e] bg-[#242529] overflow-hidden shadow-2xl relative ${
                      profile?.avatar_url ? "cursor-zoom-in" : ""
                    }`}
                  >
                    {isUploading ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="animate-spin text-white size-5" />
                      </div>
                    ) : profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-black text-indigo-400 bg-indigo-500/10">
                        {profile?.full_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="absolute bottom-0 -right-1 p-1.5 bg-indigo-500 text-white rounded-lg shadow-xl hover:bg-indigo-600 transition-all border border-white/10 active:scale-95 z-10"
                  >
                    <Camera size={12} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1 px-1">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                        Profile
                      </span>
                      <button
                        onClick={() => {
                          if (isEditingName)
                            updateProfile("full_name", editedName);
                          setIsEditingName(!isEditingName);
                        }}
                        className="text-indigo-400 text-[10px] font-semibold hover:underline"
                      >
                        {isEditingName ? "Save" : "Edit"}
                      </button>
                    </div>
                    {isEditingName ? (
                      <input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            updateProfile("full_name", editedName);
                            setIsEditingName(false);
                          }
                        }}
                        className="w-full bg-white/5 border border-indigo-500/30 rounded-xl px-3 py-1.5 text-base text-white outline-none focus:border-indigo-500 transition-all"
                      />
                    ) : (
                      <div className="px-1">
                        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
                          {editedName || profile?.full_name || "New User"}
                          <ShieldCheck size={16} className="text-emerald-500" />
                        </h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Circle
                            size={7}
                            fill={isUserOnline ? "#10b981" : "#71717a"}
                            className={
                              isUserOnline
                                ? "text-emerald-500"
                                : "text-zinc-500"
                            }
                          />
                          <span
                            className={`text-[10px] font-medium ${
                              isUserOnline
                                ? "text-emerald-500"
                                : "text-zinc-500"
                            }`}
                          >
                            {isUserOnline ? "Active" : "Offline"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5 group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                        About
                      </span>
                      <button
                        onClick={() => {
                          if (isEditingBio) updateProfile("bio", editedBio);
                          setIsEditingBio(!isEditingBio);
                        }}
                      >
                        {isEditingBio ? (
                          <span className="text-indigo-400 text-[10px] font-semibold hover:underline">
                            Save
                          </span>
                        ) : (
                          <Edit2
                            size={10}
                            className="text-zinc-600 group-hover:text-white transition-colors"
                          />
                        )}
                      </button>
                    </div>
                    {isEditingBio ? (
                      <textarea
                        value={editedBio}
                        onChange={(e) => setEditedBio(e.target.value)}
                        className="w-full bg-black/20 rounded-lg p-2.5 text-xs text-zinc-300 outline-none border border-indigo-500/30 resize-none h-16"
                      />
                    ) : (
                      <p className="text-[12px] text-zinc-400 leading-snug px-1">
                        {editedBio || profile?.bio || "No bio set yet."}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.02] rounded-xl border border-white/5">
                    <Mail size={12} className="text-zinc-500 flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">
                        Email
                      </span>
                      <span className="text-[11px] text-zinc-300 truncate">
                        {profile?.email}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full py-2.5 bg-zinc-800/40 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest border border-white/5"
                    >
                      <LogOut size={12} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showZoomedAvatar && profile?.avatar_url && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowZoomedAvatar(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative max-w-lg w-full aspect-square"
            >
              <img
                src={profile.avatar_url}
                className="w-full h-full object-contain rounded-[32px] shadow-2xl"
                alt="Zoomed Avatar"
              />
              <button
                onClick={() => setShowZoomedAvatar(false)}
                className="absolute -top-10 right-0 p-2 text-white hover:text-indigo-400 transition-colors"
              >
                <X size={24} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
