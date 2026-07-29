import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, UserCheck, FileText, X, CheckCircle, Clock, ShieldX, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';

interface VerificationGatekeeperModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userProfile: UserProfile | null;
  onOpenAuth: () => void;
  onOpenKyc: () => void;
  onInstantDemoVerify?: () => void;
}

export default function VerificationGatekeeperModal({
  isOpen,
  onClose,
  user,
  userProfile,
  onOpenAuth,
  onOpenKyc,
  onInstantDemoVerify,
}: VerificationGatekeeperModalProps) {
  if (!isOpen) return null;

  const isAuth = !!user;
  const kycStatus = userProfile?.kyc?.kycStatus || 'unsubmitted';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md p-6 bg-white border border-gray-300 rounded-2xl space-y-5 text-left relative shadow-2xl text-black"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-black p-1 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-black uppercase tracking-wider">Medical Verification Required</h3>
              <p className="text-[10px] text-red-600 font-mono uppercase font-bold">Nepal Resuscitation Protocol Access Policy</p>
            </div>
          </div>

          <p className="text-xs text-black leading-relaxed font-medium">
            To ensure patient safety and compliance, every practitioner must <strong>Sign In</strong>, submit <strong>Medical Council KYC</strong>, and be <strong>Verified by Medical Board Admin</strong> before accessing active resuscitation tools.
          </p>

          {/* Stepper Verification Checklist */}
          <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            {/* Step 1: Sign In */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isAuth ? (
                  <CheckCircle className="w-4 h-4 text-red-600 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-[9px] text-black font-bold">1</div>
                )}
                <div>
                  <span className="text-xs font-bold text-black block">1. Practitioner Authentication</span>
                  <span className="text-[9px] text-gray-700 block font-medium">{isAuth ? `Signed in as ${user.email}` : 'Sign in or register an account'}</span>
                </div>
              </div>
              {!isAuth && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg border-none cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Step 2: KYC Form */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                {kycStatus === 'approved' ? (
                  <CheckCircle className="w-4 h-4 text-red-600 shrink-0" />
                ) : kycStatus === 'pending' ? (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                ) : kycStatus === 'rejected' ? (
                  <ShieldX className="w-4 h-4 text-red-600 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-[9px] text-black font-bold">2</div>
                )}
                <div>
                  <span className="text-xs font-bold text-black block">2. Doctor KYC Submission</span>
                  <span className="text-[9px] text-gray-700 block font-medium">
                    {kycStatus === 'approved' ? 'Medical council KYC approved' : kycStatus === 'pending' ? 'KYC details submitted & pending review' : kycStatus === 'rejected' ? 'KYC rejected. Re-submission needed' : 'Council reg & degree verification'}
                  </span>
                </div>
              </div>
              {isAuth && kycStatus !== 'approved' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenKyc();
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg border-none cursor-pointer"
                >
                  {kycStatus === 'pending' ? 'View KYC' : 'Submit KYC'}
                </button>
              )}
            </div>

            {/* Step 3: Admin Approval */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                {kycStatus === 'approved' ? (
                  <CheckCircle className="w-4 h-4 text-red-600 shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center text-[9px] text-black font-bold">3</div>
                )}
                <div>
                  <span className="text-xs font-bold text-black block">3. Medical Board Admin Approval</span>
                  <span className="text-[9px] text-gray-700 block font-medium">
                    {kycStatus === 'approved' ? 'Verified licensed doctor' : 'Awaiting admin review'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Demo Instant Verification Option for Testing */}
          {onInstantDemoVerify && isAuth && kycStatus !== 'approved' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-black uppercase flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-red-600" /> Instant Demo Verification
                </span>
                <button
                  type="button"
                  onClick={onInstantDemoVerify}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg shadow border-none cursor-pointer"
                >
                  Approve Now
                </button>
              </div>
              <p className="text-[9px] text-gray-700 leading-tight font-medium">
                For evaluation/academic testing, click above to instantly self-verify this account as an approved doctor.
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider border-none cursor-pointer shadow-md"
            >
              Close Notice
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
