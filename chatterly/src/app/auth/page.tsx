"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Lock,
  Mail,
  ArrowLeft,
  Check,
  Circle,
  ShieldCheck,
  Info,
  ChevronRight,
  Fingerprint,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const mountedRef = useRef(false);

  const resetFormFields = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setStatusMessage(null);
  };

  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    {
      label: "Numbers or _ only",
      met: /[0-9_]/.test(password) && !/[^A-Za-z0-9_]/.test(password),
    },
  ];

  const allMet = requirements.every((r) => r.met);
  const hasInvalidSymbols = /[^A-Za-z0-9_]/.test(password);

  useEffect(() => {
    mountedRef.current = true;
    setIsMounted(true);

    const messageType = searchParams.get("message");
    if (messageType === "verified") {
      setStatusMessage("Identity verified. You can now sign in.");
    } else if (messageType === "recovered") {
      setStatusMessage("Password updated successfully.");
    }

    const checkInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mountedRef.current) return;

      const isShielded =
        sessionStorage.getItem("recovery_origin_shield") === "true";
      if (session && !isShielded) {
        router.replace("/");
      }
    };
    checkInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      const isShielded =
        sessionStorage.getItem("recovery_origin_shield") === "true";
      if (event === "SIGNED_IN" && session && !isShielded) {
        router.push("/");
      }
      if (event === "PASSWORD_RECOVERY") {
        resetFormFields();
        setIsForgotPassword(true);
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  const triggerRedirectSequence = () => {
    setIsRedirecting(true);
    setTimeout(() => {
      if (mountedRef.current) {
        resetFormFields();
        setShowSuccessState(false);
        setIsLogin(true);
        setIsRedirecting(false);
        setStatusMessage("Identity secure. Please sign in.");
      }
    }, 2200);
  };

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!isLogin && !isForgotPassword) {
      if (!allMet) {
        setError("Please satisfy all password requirements.");
        return;
      }
      if (hasInvalidSymbols) {
        setError("Invalid symbols detected. Only _ is allowed.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isForgotPassword) {
        const { data: userExists, error: checkError } = await supabase
          .from("profiles")
          .select("email")
          .eq("email", email)
          .single();

        if (checkError || !userExists) {
          throw new Error("No account found with this email address.");
        }

        sessionStorage.setItem("recovery_origin_shield", "true");
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
          }
        );
        if (resetError) {
          sessionStorage.removeItem("recovery_origin_shield");
          throw resetError;
        }
        setResetSent(true);
      } else if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/");
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: email.split("@")[0] },
          },
        });
        if (signUpError) throw signUpError;
        setShowSuccessState(true);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        if (err.message.includes("should be different from the old password")) {
          setError("New password must be different from your previous one.");
        } else {
          setError(err.message || "An unexpected error occurred.");
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-[100dvh] w-full bg-[#1a1b1e] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[60%] h-[60%] bg-indigo-500/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[60%] bg-purple-500/10 blur-[100px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[320px] sm:max-w-[360px] z-10"
      >
        <div className="text-center mb-6 sm:mb-8">
          <motion.div layoutId="logo" className="inline-block relative group">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-bold text-xl sm:text-2xl shadow-xl shadow-indigo-500/20">
              C
            </div>
          </motion.div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-3 sm:mt-4">
            Chatterly
          </h2>
          {!showSuccessState && !isRedirecting && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={isForgotPassword ? "rec" : isLogin ? "auth" : "reg"}
              className="text-zinc-500 sm:text-zinc-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.3em] mt-2"
            >
              {isForgotPassword
                ? "Account Recovery"
                : isLogin
                ? "Authorized Access"
                : "Create Identity"}
            </motion.p>
          )}
        </div>

        <div className="bg-[#242529] border border-white/5 backdrop-blur-md rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5">
            <motion.div
              initial={false}
              animate={{
                x: isLogin ? "0%" : isForgotPassword ? "-100%" : "100%",
                width: "100%",
                backgroundColor: isLogin ? "#6366f1" : "#a855f7",
              }}
              className="h-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"
            />
          </div>

          <AnimatePresence mode="wait">
            {isRedirecting ? (
              <motion.div
                key="redirect-loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-10 sm:py-12 flex flex-col items-center justify-center space-y-5 sm:space-y-6 text-center"
              >
                <div className="relative">
                  <Fingerprint className="text-indigo-500 animate-pulse w-10 h-10 sm:w-12 sm:h-12" />
                  <motion.div
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="absolute inset-[-6px] sm:inset-[-8px] border-2 border-indigo-500/20 border-t-indigo-500 rounded-full"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-white text-xs sm:text-sm font-bold uppercase tracking-widest">
                    Finalizing Identity
                  </p>
                  <p className="text-zinc-500 text-[9px] sm:text-[10px]">
                    Configuring secure environment...
                  </p>
                </div>
              </motion.div>
            ) : showSuccessState ? (
              <motion.div
                key="signup-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5 sm:space-y-6 py-1 sm:py-2 text-center"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20 shadow-inner">
                  <ShieldCheck className="text-indigo-400 w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="space-y-2">
                  <p className="text-white text-base sm:text-lg font-bold tracking-tight">
                    Success!
                  </p>
                  <p className="text-zinc-400 text-[11px] sm:text-xs leading-relaxed px-1 sm:px-2">
                    Your Chatterly account is ready. Please check your email to
                    verify your identity before signing in.
                  </p>
                </div>

                <div className="pt-1 sm:pt-2">
                  <button
                    onClick={triggerRedirectSequence}
                    className="w-full h-11 sm:h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    Proceed to Sign In <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            ) : resetSent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5 sm:space-y-6 py-1 sm:py-2 text-center"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
                  <Mail className="text-indigo-400 w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-white text-sm font-semibold">Link Sent</p>
                  <p className="text-zinc-400 text-[11px] sm:text-xs leading-relaxed">
                    Check your inbox. If an account exists, you will receive a
                    reset link shortly.
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetFormFields();
                    setResetSent(false);
                    setIsForgotPassword(false);
                    sessionStorage.removeItem("recovery_origin_shield");
                  }}
                  className="w-full text-[10px] sm:text-xs font-bold text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleAuth}
                className="space-y-4 sm:space-y-5 pt-1 sm:pt-2"
              >
                <AnimatePresence>
                  {statusMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[9px] sm:text-[10px] font-bold mb-1 sm:mb-2"
                    >
                      <Info size={14} className="shrink-0" />
                      {statusMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                {isForgotPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      resetFormFields();
                      setIsForgotPassword(false);
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-zinc-500 sm:text-zinc-400 hover:text-white mb-3 sm:mb-4 font-bold uppercase tracking-widest transition-colors"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                )}

                <div className="space-y-3 sm:space-y-4">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    <input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#1a1b1e] border border-white/5 rounded-xl py-3 sm:py-3.5 pl-11 sm:pl-12 pr-4 text-white text-sm outline-none focus:border-indigo-500/50 transition-all"
                      required
                    />
                  </div>

                  {!isForgotPassword && (
                    <>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                        <input
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-[#1a1b1e] border border-white/5 rounded-xl py-3 sm:py-3.5 pl-11 sm:pl-12 pr-4 text-white text-sm outline-none focus:border-indigo-500/50 transition-all"
                          required
                        />
                      </div>

                      <AnimatePresence>
                        {!isLogin && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-1 py-0.5 sm:py-1 space-y-1.5 sm:space-y-2 overflow-hidden"
                          >
                            {requirements.map((req, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2"
                              >
                                {req.met ? (
                                  <Check
                                    size={12}
                                    className="text-indigo-400"
                                  />
                                ) : (
                                  <Circle
                                    size={10}
                                    className="text-zinc-700 sm:text-zinc-600"
                                  />
                                )}
                                <span
                                  className={`text-[9px] sm:text-[10px] font-medium transition-colors ${
                                    req.met
                                      ? "text-zinc-300"
                                      : "text-zinc-600 sm:text-zinc-500"
                                  }`}
                                >
                                  {req.label}
                                </span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>

                {error && (
                  <div className="p-2.5 sm:p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] sm:text-[10px] font-bold text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 sm:h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[11px] sm:text-sm transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                >
                  {loading ? (
                    <Loader2 className="animate-spin mx-auto w-5 h-5" />
                  ) : (
                    <span className="uppercase tracking-widest text-[10px] sm:text-xs">
                      {isForgotPassword
                        ? "Send Reset Link"
                        : isLogin
                        ? "Authenticate"
                        : "Get Started"}
                    </span>
                  )}
                </button>

                {!isForgotPassword && (
                  <div className="flex flex-col gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        resetFormFields();
                        setIsLogin(!isLogin);
                      }}
                      className="text-[10px] sm:text-xs font-semibold text-zinc-500 sm:text-zinc-400 hover:text-white transition-colors"
                    >
                      {isLogin
                        ? "No account? Sign Up"
                        : "Have an account? Sign In"}
                    </button>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          resetFormFields();
                          setIsForgotPassword(true);
                        }}
                        className="text-[10px] sm:text-xs font-semibold text-indigo-400/80 hover:text-indigo-300 transition-colors"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 sm:mt-10 text-center text-[9px] sm:text-[10px] text-zinc-700 sm:text-zinc-600 font-bold uppercase tracking-[0.35em] sm:tracking-[0.4em]">
          End-to-End Encrypted Session
        </p>
      </motion.div>
    </div>
  );
}
