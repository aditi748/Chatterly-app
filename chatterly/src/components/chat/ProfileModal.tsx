"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  X,
  LogOut,
  User,
  Mail,
  Shield,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Settings2,
  Lock,
  Edit2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any; // The Auth User object
  profile: any; // The Database Profile object (has the edits)
  onRefresh?: () => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  profile,
  onRefresh,
}: ProfileModalProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-[440px] bg-[#1a1b1e] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl"
          >
            {/* Header / Banner Area */}
            <div className="h-32 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent relative">
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full bg-black/20 text-zinc-400 hover:text-white transition-colors backdrop-blur-md border border-white/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Avatar Section */}
            <div className="px-8 pb-8 -mt-12 relative">
              <div className="flex items-end justify-between mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl bg-[#242529] border-4 border-[#1a1b1e] flex items-center justify-center text-indigo-400 shadow-xl overflow-hidden">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User
                        size={40}
                        className="group-hover:scale-110 transition-transform duration-500"
                      />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 border-4 border-[#1a1b1e] rounded-full" />
                </div>

                <div className="flex gap-2 pb-2">
                  <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Pro Member
                  </span>
                </div>
              </div>

              {/* User Identity */}
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  {/* Changed from user?.user_metadata?.full_name to profile?.full_name */}
                  {profile?.full_name ||
                    user?.user_metadata?.full_name ||
                    "Anonymous User"}
                  <CheckCircle2 size={18} className="text-indigo-400" />
                </h2>
                <p className="text-zinc-500 text-sm font-medium flex items-center gap-2">
                  <Mail size={14} className="text-zinc-600" />
                  {user?.email}
                </p>
              </div>

              {/* Bio / Status Section (New) */}
              <div className="mb-8 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5 flex items-center gap-2">
                  Bio / Status
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed italic">
                  "{profile?.bio || "No bio set yet."}"
                </p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="p-4 rounded-2xl bg-[#242529] border border-white/5 group hover:border-indigo-500/30 transition-colors">
                  <Shield
                    size={16}
                    className="text-zinc-500 mb-2 group-hover:text-indigo-400 transition-colors"
                  />
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                    Security
                  </p>
                  <p className="text-sm text-zinc-200 font-semibold mt-0.5">
                    Verified Account
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#242529] border border-white/5 group hover:border-indigo-500/30 transition-colors">
                  <Calendar
                    size={16}
                    className="text-zinc-500 mb-2 group-hover:text-indigo-400 transition-colors"
                  />
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                    Joined
                  </p>
                  <p className="text-sm text-zinc-200 font-semibold mt-0.5">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            year: "numeric",
                          }
                        )
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Actions List */}
              <div className="space-y-2 mb-8">
                <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-[0.2em] px-1 mb-3">
                  System Settings
                </p>

                <button className="w-full group flex items-center justify-between p-3.5 rounded-xl hover:bg-white/5 transition-all text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                      <Settings2 size={16} />
                    </div>
                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                      Preferences
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-zinc-600 group-hover:text-zinc-400"
                  />
                </button>

                <button className="w-full group flex items-center justify-between p-3.5 rounded-xl hover:bg-white/5 transition-all text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                      <Lock size={16} />
                    </div>
                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                      Security & Privacy
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-zinc-600 group-hover:text-zinc-400"
                  />
                </button>
              </div>

              {/* Footer Actions */}
              <div className="pt-6 border-t border-white/5">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full h-12 flex items-center justify-center gap-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoggingOut ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <LogOut size={18} />
                    </motion.div>
                  ) : (
                    <>
                      <LogOut size={18} />
                      Terminate Session
                    </>
                  )}
                </button>
                <p className="text-center text-[9px] text-zinc-700 font-bold uppercase tracking-[0.3em] mt-6">
                  Chatterly Secure Profile • V0.1.0
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
