"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  X,
  Camera,
  Loader2,
  User,
  Mail,
  LogOut,
  Check,
  Shield,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface ProfileModalProps {
  profile: any;
  onClose: () => void;
  onUpdate: () => void;
  isOpen: boolean;
}

export default function ProfileModal({
  profile,
  onClose,
  onUpdate,
  isOpen,
}: ProfileModalProps) {
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          bio: bio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}-${Math.random()}.${fileExt}`;

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
        .eq("id", profile.id);

      if (updateError) throw updateError;
      onUpdate();
    } catch (error) {
      console.error("Error uploading avatar:", error);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-[480px] bg-[#0f1115] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Profile Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/5 rounded-2xl transition-all duration-200 group"
          >
            <X className="w-5 h-5 text-zinc-400 group-hover:text-white group-hover:rotate-90 transition-all" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-[#6366f1]/20 to-[#8b5cf6]/20 border-2 border-white/10 flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:border-[#6366f1]/50 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt="Avatar"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex flex-col items-center">
                    <User className="w-12 h-12 text-[#6366f1] mb-1" />
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
                  </div>
                )}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 p-3 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-2xl shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 group-hover:shadow-[#6366f1]/20"
              >
                <Camera className="w-5 h-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={uploadAvatar}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                Display Name
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="How should we call you?"
                  className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-[#6366f1]/50 focus:bg-white/[0.05] transition-all duration-300 placeholder:text-zinc-600"
                />
                <User className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-[#6366f1] transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                About Me
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a bit about yourself..."
                rows={3}
                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-[#6366f1]/50 focus:bg-white/[0.05] transition-all duration-300 placeholder:text-zinc-600 resize-none"
              />
            </div>

            <div className="pt-2">
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
                    Email Address
                  </p>
                  <p className="text-sm text-zinc-300 truncate">
                    {profile?.email}
                  </p>
                </div>
                <div className="p-1.5 bg-green-500/10 rounded-lg">
                  <Check className="w-3 h-3 text-green-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-white/[0.02] border-t border-white/5 flex flex-col gap-3">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-[#6366f1]/20 active:scale-[0.98]"
          >
            {isUpdating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            Save Changes
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="w-full bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 font-medium py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
