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
  AlertCircle,
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Interaction Refs
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isLongPressActive = useRef(false);

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
      console.error(err);
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
    isLongPressActive.current = false;

    longPressTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      toggleSelection(chatId);
      if (window.navigator.vibrate) window.navigator.vibrate(60);
    }, 800);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const touch = e.touches[0];
    const moveX = Math.abs(touch.clientX - touchStartPos.current.x);
    const moveY = Math.abs(touch.clientY - touchStartPos.current.y);
    if (moveX > 15 || moveY > 15) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isLongPressActive.current) {
      e.preventDefault();
    }
  };

  const handleItemClick = (chatId: string) => {
    if (selectedChatIds.length > 0) {
      toggleSelection(chatId);
    } else {
      onSelectChat(chatId);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedChatIds.length === 0) return;
    const shouldArchive = view === "active";
    try {
      if (selectedId && selectedChatIds.includes(selectedId))
        onSelectChat(null);
      const updates = selectedChatIds.map(async (chatId) => {
        const localChat = chats.find((c: any) => c.id === chatId);
        if (!localChat) return;
        const col =
          localChat.user1_id === currentUserId
            ? "user1_archived"
            : "user2_archived";
        return supabase
          .from("conversations")
          .update({ [col]: shouldArchive })
          .eq("id", chatId);
      });
      await Promise.all(updates);
      setSelectedChatIds([]);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedChatIds.length === 0) return;
    try {
      if (selectedId && selectedChatIds.includes(selectedId))
        onSelectChat(null);
      const time = new Date().toISOString();
      const updates = selectedChatIds.map(async (chatId) => {
        const localChat = chats.find((c: any) => c.id === chatId);
        if (!localChat) return;
        const isU1 = localChat.user1_id === currentUserId;
        const delCol = isU1 ? "user1_deleted_at" : "user2_deleted_at";
        const hideCol = isU1 ? "user1_is_hidden" : "user2_is_hidden";
        return supabase
          .from("conversations")
          .update({ [delCol]: time, [hideCol]: true })
          .eq("id", chatId);
      });
      await Promise.all(updates);
      setSelectedChatIds([]);
      setShowDeleteConfirm(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
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

  const filteredChats = chats.filter((chat: any) => {
    const matchesSearch = chat.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const isU1 = chat.user1_id === currentUserId;
    const isArchived = isU1 ? chat.user1_archived : chat.user2_archived;
    const isHidden = isU1 ? chat.user1_is_hidden : chat.user2_is_hidden;
    if (isHidden) return false;
    const matchesView = view === "archived" ? !!isArchived : !isArchived;
    return matchesSearch && matchesView;
  });

  const archivedCount = chats.filter((chat: any) => {
    return chat.user1_id === currentUserId
      ? chat.user1_archived
      : chat.user2_archived;
  }).length;

  return (
    <div className="flex flex-col h-full bg-[#1e2229] border-r border-white/5 w-full select-none relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[35%] h-[35%] rounded-full bg-indigo-500/10 blur-[80px]" />
        <div className="absolute bottom-[15%] right-[-5%] w-[25%] h-[25%] rounded-full bg-indigo-600/5 blur-[70px]" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="px-5 pt-8 md:pt-10 pb-4 h-[90px] md:h-[100px] flex items-center justify-between">
          <AnimatePresence mode="popLayout">
            {selectedChatIds.length === 0 ? (
              <motion.div
                key="def"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-lg">
                    C
                  </div>
                  <h1 className="text-lg font-black tracking-tight text-white">
                    Chatterly
                  </h1>
                </div>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="w-10 h-10 rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    <User size={18} className="m-auto text-zinc-400" />
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="act"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                className="flex items-center justify-between w-full bg-[#252a33]/80 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedChatIds([])}
                    className="p-2 text-zinc-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                  <span className="text-indigo-500 font-bold text-sm px-1">
                    {selectedChatIds.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleBulkArchive}
                    className="p-2.5 bg-white/5 hover:bg-indigo-500 text-zinc-300 hover:text-white rounded-xl"
                  >
                    {view === "active" ? (
                      <Archive size={18} />
                    ) : (
                      <ArchiveRestore size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl"
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
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
              size={14}
            />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full bg-[#252a33]/60 border border-white/5 rounded-2xl py-2.5 pl-10 pr-4 text-[12px] text-white outline-none"
            />
          </div>
        </div>

        <div className="px-4 mb-4 flex gap-2">
          <button
            onClick={() => setView("active")}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase ${
              view === "active"
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-zinc-500"
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setView("archived")}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase ${
              view === "archived"
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-zinc-500"
            }`}
          >
            Archived{" "}
            {archivedCount > 0 && (
              <span className="opacity-60">{archivedCount}</span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-10 space-y-1.5 custom-scrollbar">
          <AnimatePresence initial={false}>
            {filteredChats.map((chat: any) => {
              const isSelected = selectedId === chat.id;
              const isMulti = selectedChatIds.includes(chat.id);
              const isOnline = presence && !!presence[chat.otherId];
              const isMe = chat.last_msg_user_id === currentUserId;
              const hasUnread = chat.unread_count > 0 && !isSelected && !isMe;

              return (
                <motion.button
                  layout
                  key={chat.id}
                  onContextMenu={(e) => handleRightClick(e, chat.id)}
                  onTouchStart={(e) => handleTouchStart(e, chat.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={() => handleItemClick(chat.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-[24px] transition-all border relative ${
                    isMulti
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
                    {isMulti && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-[#1e2229]">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    {isOnline && !isMulti && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-[2.5px] rounded-full ${
                          isSelected ? "border-indigo-600" : "border-[#1e2229]"
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
                              <CheckCheck size={14} />
                            ) : (
                              <Check size={14} className="text-zinc-500" />
                            )}
                          </span>
                        )}
                        <p
                          className={`text-[11.5px] truncate ${
                            isSelected ? "text-indigo-100/80" : "text-zinc-500"
                          }`}
                        >
                          {chat.last_msg || "New chat"}
                        </p>
                      </div>
                      {hasUnread && (
                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-6 right-6 z-[100]">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNewChat}
            className="w-12 h-12 bg-indigo-500 text-white rounded-[18px] flex items-center justify-center shadow-xl border border-white/20"
          >
            <Plus size={24} strokeWidth={3} />
          </motion.button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-[320px] bg-[#1a1b1e] border border-white/10 rounded-[28px] p-6 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">
                Delete Chats?
              </h3>
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Are you sure? This will remove {selectedChatIds.length}{" "}
                conversation{selectedChatIds.length > 1 ? "s" : ""} from your
                list. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-[340px] bg-[#1a1b1e] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden pb-8"
            >
              <div className="h-24 bg-gradient-to-br from-indigo-600 to-violet-600 relative">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="absolute top-3 right-3 p-1.5 bg-black/10 text-white rounded-full"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 -mt-10 relative">
                <div className="relative inline-block mb-3">
                  <div
                    onClick={() =>
                      profile?.avatar_url && setShowZoomedAvatar(true)
                    }
                    className="w-20 h-20 rounded-[24px] border-[4px] border-[#1a1b1e] bg-[#242529] overflow-hidden shadow-2xl relative"
                  >
                    {isUploading ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="animate-spin text-white size-5" />
                      </div>
                    ) : profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-black text-indigo-400">
                        {profile?.full_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 -right-1 p-1.5 bg-indigo-500 text-white rounded-lg shadow-xl"
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                        Name
                      </span>
                      <button
                        onClick={() => {
                          if (isEditingName)
                            updateProfile("full_name", editedName);
                          setIsEditingName(!isEditingName);
                        }}
                        className="text-indigo-400 text-[10px] font-semibold"
                      >
                        {isEditingName ? "Save" : "Edit"}
                      </button>
                    </div>
                    {isEditingName ? (
                      <input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        autoFocus
                        className="w-full bg-white/5 border border-indigo-500/30 rounded-xl px-3 py-1.5 text-white outline-none"
                      />
                    ) : (
                      <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
                        {editedName || profile?.full_name || "New User"}
                        <ShieldCheck size={16} className="text-emerald-500" />
                      </h2>
                    )}
                  </div>
                  <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                        About
                      </span>
                      <button
                        onClick={() => {
                          if (isEditingBio) updateProfile("bio", editedBio);
                          setIsEditingBio(!isEditingBio);
                        }}
                        className="text-indigo-400 text-[10px] font-semibold"
                      >
                        {isEditingBio ? "Save" : "Edit"}
                      </button>
                    </div>
                    {isEditingBio ? (
                      <textarea
                        value={editedBio}
                        onChange={(e) => setEditedBio(e.target.value)}
                        className="w-full bg-black/20 rounded-lg p-2.5 text-xs text-zinc-300 outline-none resize-none h-16"
                      />
                    ) : (
                      <p className="text-[12px] text-zinc-400 italic">
                        {editedBio || profile?.bio || "No bio set yet."}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.02] rounded-xl border border-white/5">
                    <Mail size={12} className="text-zinc-500" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">
                        Email
                      </span>
                      <span className="text-[11px] text-zinc-300">
                        {profile?.email}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      supabase.auth
                        .signOut()
                        .then(() => (window.location.href = "/auth"))
                    }
                    className="w-full py-2.5 bg-zinc-800/40 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest border border-white/5"
                  >
                    <LogOut size={12} /> Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showZoomedAvatar && (
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
                alt=""
              />
              <button
                onClick={() => setShowZoomedAvatar(false)}
                className="absolute -top-10 right-0 p-2 text-white"
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
