"use client";
import React from "react";
import { Search, Plus, User, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function ChatSidebar({
  chats,
  selectedId,
  onSelectChat,
  profile,
  onEditProfile,
  onNewChat,
  presence,
}: any) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="flex flex-col h-full bg-black border-r border-white/5 w-full">
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tighter text-white">
          Chatterly
        </h1>
        <button
          onClick={onNewChat}
          className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-white/5 text-white"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="px-6 mb-6">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            size={16}
          />
          <input
            placeholder="Search messages..."
            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm outline-none text-white focus:bg-zinc-900"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
        {chats.map((chat: any) => {
          const isSelected = selectedId === chat.id;
          const isOnline = presence && !!presence[chat.otherId];
          const hasUnread = chat.unread_count > 0 && !isSelected;

          return (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all relative ${
                isSelected
                  ? "bg-zinc-900 border border-white/10"
                  : "hover:bg-zinc-900/50 border border-transparent"
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/5 overflow-hidden">
                  {chat.avatar_url ? (
                    <img
                      src={chat.avatar_url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                      {chat.name?.charAt(0)}
                    </div>
                  )}
                </div>
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-black rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-sm text-white truncate">
                    {chat.name}
                  </span>
                  {chat.last_at && (
                    <span className="text-[10px] text-zinc-500">
                      {new Date(chat.last_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs truncate ${
                    hasUnread ? "text-emerald-400 font-bold" : "text-zinc-500"
                  }`}
                >
                  {hasUnread
                    ? "New Message"
                    : chat.last_msg || "No messages yet"}
                </p>
              </div>
              {hasUnread && (
                <div className="ml-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <span className="text-[10px] font-black text-black">
                    {chat.unread_count}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/5 bg-black/50 space-y-2">
        <button
          onClick={onEditProfile}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 group transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                className="w-full h-full object-cover"
                alt=""
              />
            ) : (
              <User size={18} className="m-auto h-full text-zinc-500" />
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-white leading-none">
              {profile?.full_name || "User"}
            </p>
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">
              Settings
            </p>
          </div>
        </button>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-colors"
        >
          <LogOut size={18} className="ml-2" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            Logout
          </span>
        </button>
      </div>
    </div>
  );
}
