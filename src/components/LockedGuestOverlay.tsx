import React from 'react';
import { Lock, ShieldAlert, Mail, UserCheck } from 'lucide-react';

interface LockedGuestOverlayProps {
  title?: string;
  onOpenAuth?: () => void;
  onOpenKyc?: () => void;
}

export default function LockedGuestOverlay({
  title = "Restricted Screen in Guest Mode",
  onOpenAuth,
  onOpenKyc,
}: LockedGuestOverlayProps) {
  return (
    <div className="relative w-full h-full min-h-[380px] flex items-center justify-center p-4 text-center select-none my-auto">
      {/* Blurred overlay box */}
      <div className="w-full max-w-md bg-slate-950/85 backdrop-blur-2xl border border-red-500/30 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl z-20 my-auto text-center">
        
        {/* Lock Image / Icon graphic */}
        <div className="relative inline-block mx-auto">
          <div className="w-20 h-20 bg-red-600/20 border-2 border-red-500 rounded-3xl flex items-center justify-center text-red-500 shadow-2xl animate-pulse">
            <Lock className="w-10 h-10 stroke-[2.5]" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black p-1.5 rounded-full shadow-lg">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>

        {/* Header & Instructions */}
        <div className="space-y-2">
          <h3 className="text-xl font-display font-extrabold text-white uppercase tracking-tight">
            Full Access Restricted
          </h3>
          <p className="text-xs sm:text-sm font-bold text-amber-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 shadow-inner">
            Please contact the owner of this app or sign in for full access.
          </p>
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed px-2">
            In Guest Mode, access is strictly limited to <strong>Timers</strong> and <strong>Drugs</strong>. Access to Flowcharts, Journal logs, Certified Case Export, and Configurations requires an account that is signed in, has completed the Doctor KYC form, and has been verified by the app administrator.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-2.5 pt-1">
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 border-none cursor-pointer"
            >
              <UserCheck className="w-4 h-4" /> Sign In & Get Verified
            </button>
          )}
          
          <a
            href="mailto:user.suniltim@gmail.com?subject=Nepal%20ACLS%20Companion%20Verification%20Request"
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-95 no-underline cursor-pointer"
          >
            <Mail className="w-4 h-4 text-blue-400" /> Contact App Owner
          </a>
        </div>

        {/* Owner Info */}
        <div className="pt-2 border-t border-white/10">
          <span className="text-[9.5px] text-slate-400 font-mono block">
            Owner Contact: <strong className="text-slate-200">user.suniltim@gmail.com</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
