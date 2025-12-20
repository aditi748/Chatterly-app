"use client";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  Volume2,
  PhoneOff,
  ShieldCheck,
  X,
  Maximize2,
} from "lucide-react";

export function CallOverlay({ isOpen, onClose, contactName }: any) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isOpen) interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex items-center justify-center p-0 md:p-6 bg-black/60 backdrop-blur-xl transition-all"
    >
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full h-full md:max-w-[380px] md:max-h-[720px] md:rounded-[40px] md:border md:border-white/10 bg-[#09090B] shadow-2xl flex flex-col items-center justify-between p-10 md:p-12 overflow-hidden"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-[0.2em]">
              Secure_Signal
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 rounded-full bg-white"
            />
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-3xl font-bold text-white relative z-10">
              {contactName.charAt(0)}
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">
              {contactName}
            </h2>
            <p className="text-lg font-mono text-zinc-500 mt-1 tracking-widest">
              {formatTime(seconds)}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 w-full">
          <div className="flex justify-center gap-6 w-full">
            {[Mic, Volume2, Maximize2].map((Icon, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <Icon size={20} />
              </motion.button>
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:bg-red-600 mb-4"
          >
            <PhoneOff size={26} />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
