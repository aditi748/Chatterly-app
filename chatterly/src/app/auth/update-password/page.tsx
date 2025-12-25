"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Lock,
  ShieldCheck,
  ChevronRight,
  Check,
  Circle,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Requirement States
  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One number or symbol", met: /[0-9!@#$%^&*]/.test(password) },
  ];

  const allMet = requirements.every((r) => r.met);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setError("Security session not found. Please request a new link.");
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);

    if (!allMet) {
      setError("Please satisfy all password requirements first.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // Small buffer to ensure session is fully hydrated
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        // Here we catch the error from Supabase and show your custom text
        if (
          updateError.message
            .toLowerCase()
            .includes("different from the old password")
        ) {
          setError("New password cannot be the same as your old password.");
          setLoading(false);
          return; // Stop execution here so it doesn't show success
        }
        throw updateError;
      }

      // If we reach here, it means the password was actually different and updated
      setSuccess(true);
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/auth?message=Password updated successfully");
      }, 2500);
    } catch (err: any) {
      console.error("Update error:", err);
      setError(err.message || "Failed to update password. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#1a1b1e] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient Glow Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[60%] h-[60%] bg-indigo-500/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[60%] bg-purple-500/10 blur-[100px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[360px] z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-block relative">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xl shadow-indigo-500/20">
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
                  fill="url(#update-logo-grad)"
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
                  style={{ filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.2))" }}
                >
                  C
                </text>
                <defs>
                  <linearGradient
                    id="update-logo-grad"
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
          </div>
          <h2 className="text-2xl font-bold text-white mt-4">Chatterly</h2>
          <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">
            Account Recovery
          </p>
        </div>

        <div className="bg-[#242529] border border-white/5 backdrop-blur-md rounded-[28px] p-8 shadow-2xl relative overflow-hidden">
          {/* Progress Glow */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5">
            <div
              className={`h-full transition-all duration-1000 ${
                success
                  ? "w-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"
                  : "w-1/2 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"
              }`}
            />
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 py-2 text-center"
              >
                <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
                  <ShieldCheck className="text-green-400" size={24} />
                </div>
                <div className="space-y-1">
                  <p className="text-white text-sm font-semibold">Success!</p>
                  <p className="text-zinc-400 text-xs">
                    Password updated. Redirecting...
                  </p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-5 pt-2">
                <div className="space-y-4">
                  <div className="relative group">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors"
                      size={18}
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#1a1b1e] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm outline-none focus:border-indigo-500/50 transition-all placeholder:text-zinc-600"
                      required
                    />
                  </div>

                  {/* Requirements UI */}
                  <div className="px-1 py-1 space-y-2">
                    {requirements.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {req.met ? (
                          <Check size={12} className="text-indigo-400" />
                        ) : (
                          <Circle size={10} className="text-zinc-600" />
                        )}
                        <span
                          className={`text-[10px] font-medium transition-colors ${
                            req.met ? "text-zinc-300" : "text-zinc-500"
                          }`}
                        >
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="relative group">
                    <Lock
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors"
                      size={18}
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#1a1b1e] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm outline-none focus:border-indigo-500/50 transition-all placeholder:text-zinc-600"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !allMet}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale-[0.5] shadow-lg shadow-indigo-600/20"
                >
                  {loading ? (
                    <Loader2 className="animate-spin mx-auto" size={20} />
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span className="uppercase tracking-widest text-xs">
                        Update Password
                      </span>
                      <ChevronRight size={14} />
                    </div>
                  )}
                </button>
              </form>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-10 text-center text-[10px] text-zinc-600 font-bold uppercase tracking-[0.4em]">
          End-to-End Encrypted Session
        </p>
      </motion.div>
    </div>
  );
}
