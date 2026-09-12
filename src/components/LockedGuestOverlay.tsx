import React from 'react';
import { Lock, ShieldAlert, UserCheck, Clock, ShieldCheck, FileCheck, Sparkles } from 'lucide-react';

interface LockedGuestOverlayProps {
  title?: string;
  isAuth?: boolean;
  kycStatus?: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  onOpenAuth?: () => void;
  onOpenKyc?: () => void;
  onOpenAdmin?: () => void;
  onOpenGatekeeper?: () => void;
}

export default function LockedGuestOverlay({
  title = "Full Access Restricted",
  isAuth = false,
  kycStatus = 'unsubmitted',
  onOpenAuth,
  onOpenKyc,
  onOpenAdmin,
  onOpenGatekeeper,
}: LockedGuestOverlayProps) {
  const isPending = isAuth && kycStatus === 'pending';
  const isRejected = isAuth && kycStatus === 'rejected';
  const isUnsubmitted = isAuth && kycStatus === 'unsubmitted';

  return (
    <div className="relative w-full h-full min-h-[380px] flex items-center justify-center p-4 text-center select-none my-auto">
      {/* Blurred overlay container */}
      <div className="w-full max-w-md bg-slate-950/90 backdrop-blur-2xl border border-red-500/30 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl z-20 my-auto text-center text-white">
        
        {/* Lock / Shield Icon Graphic */}
        <div className="relative inline-block mx-auto">
          <div className="w-16 h-16 bg-red-600/20 border-2 border-red-500 rounded-3xl flex items-center justify-center text-red-500 shadow-2xl animate-pulse">
            {isPending ? <Clock className="w-8 h-8" /> : <Lock className="w-8 h-8 stroke-[2.5]" />}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black p-1.5 rounded-full shadow-lg">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>

        {/* Header & Status Message */}
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white">
            {isPending ? 'KYC Under Admin Review' : title}
          </h3>
          
          {isPending ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs font-bold text-amber-300 leading-relaxed text-left space-y-1">
              <p className="flex items-center gap-1.5 text-amber-200">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                Doctor KYC Submitted • Awaiting Admin Verification
              </p>
              <p className="text-[10px] text-amber-300/80 font-normal">
                Your medical council registration details are pending review by the Medical Board Admin. Once approved, all resuscitation registries, case exports, and protocols unlock automatically.
              </p>
            </div>
          ) : isRejected ? (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs font-bold text-red-300 leading-relaxed text-left space-y-1">
              <p>KYC Application Needs Revision</p>
              <p className="text-[10px] text-red-300/80 font-normal">
                Please re-check your Medical Council registration number and re-submit your KYC form.
              </p>
            </div>
          ) : isUnsubmitted ? (
            <p className="text-xs sm:text-sm font-bold text-amber-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 shadow-inner">
              Doctor KYC Required: Complete Verification to Unlock Full ACLS Workstation.
            </p>
          ) : (
            <p className="text-xs sm:text-sm font-bold text-amber-300 leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 shadow-inner">
              Guest Mode: Sign in with your Medical Council credentials for full access.
            </p>
          )}

          <p className="text-[10px] text-slate-400 font-medium leading-relaxed px-2">
            Clinical safety protocol requires medical practitioners to sign in, complete doctor KYC, and receive admin verification before accessing Flowcharts, Journal records, and Configurations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-1">
          {!isAuth && onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 border-none cursor-pointer"
            >
              <UserCheck className="w-4 h-4" /> 1. Sign In / Register Account
            </button>
          )}

          {isAuth && (isUnsubmitted || isRejected) && onOpenKyc && (
            <button
              type="button"
              onClick={onOpenKyc}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 border-none cursor-pointer"
            >
              <FileCheck className="w-4 h-4" /> 2. Fill Doctor KYC Form
            </button>
          )}

          {isPending && (
            <div className="space-y-2">
              {onOpenGatekeeper && (
                <button
                  type="button"
                  onClick={onOpenGatekeeper}
                  className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-white/20 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Check Verification Status
                </button>
              )}
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all border-none cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" /> Open Medical Board Admin Portal
                </button>
              )}
            </div>
          )}
        </div>

        {/* Protocol Footer */}
        <div className="pt-2 border-t border-white/10 text-center">
          <span className="text-[9.5px] text-slate-400 font-mono block">
            Verification: <strong className="text-slate-200">Nepal Medical Council ACLS Registry</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
