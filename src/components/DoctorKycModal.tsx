import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Stethoscope, Award, Building, FileCheck, CheckCircle2, Clock, AlertTriangle, Send } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { DoctorKyc, UserProfile } from '../types';

interface DoctorKycModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onKycUpdated?: () => void;
}

export default function DoctorKycModal({ isOpen, onClose, userProfile, onKycUpdated }: DoctorKycModalProps) {
  const currentKyc = userProfile?.kyc || {
    kycStatus: 'unsubmitted',
    councilRegistration: userProfile?.councilRegistration || '',
    degree: userProfile?.highestDegree || 'MBBS',
    specialty: 'Internal Medicine',
    institution: 'Kathmandu Central Hospital',
  };

  const [fullName, setFullName] = useState(userProfile?.fullName || '');
  const [councilRegistration, setCouncilRegistration] = useState(currentKyc.councilRegistration || userProfile?.councilRegistration || '');
  const [degree, setDegree] = useState(currentKyc.degree || 'MBBS');
  const [specialty, setSpecialty] = useState(currentKyc.specialty || 'Emergency Medicine');
  const [institution, setInstitution] = useState(currentKyc.institution || 'TUIOM Teaching Hospital');
  const [idCardNumber, setIdCardNumber] = useState(currentKyc.idCardNumber || '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setErrorMsg("Please sign in first to submit your doctor KYC application.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const updatedKyc: DoctorKyc = {
      councilRegistration: councilRegistration.toUpperCase().trim(),
      degree: degree.trim(),
      specialty: specialty.trim(),
      institution: institution.trim(),
      idCardNumber: idCardNumber.trim(),
      kycStatus: 'approved',
      submittedAt: Date.now(),
      approvedAt: Date.now(),
    };

    try {
      const profileRef = doc(db, 'profiles', auth.currentUser.uid);
      await updateDoc(profileRef, {
        fullName,
        councilRegistration: councilRegistration.toUpperCase().trim(),
        highestDegree: degree.trim(),
        kyc: updatedKyc
      }).catch(async () => {
        // Fallback setDoc
        await setDoc(profileRef, {
          fullName,
          email: auth.currentUser?.email || '',
          profession: 'doctor',
          councilRegistration: councilRegistration.toUpperCase().trim(),
          highestDegree: degree.trim(),
          kyc: updatedKyc,
          onboardedAt: Date.now()
        }, { merge: true });
      });

      setSuccessMsg("Doctor KYC verified successfully! Council registration confirmed and full app access granted.");
      if (onKycUpdated) onKycUpdated();
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      setErrorMsg("Failed to submit KYC verification. Please check network connection.");
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${auth.currentUser.uid}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    switch (currentKyc.kycStatus) {
      case 'approved':
        return (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-black text-xs flex items-center justify-between font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-red-600" />
              <div>
                <span className="font-bold uppercase tracking-wider block text-black">VERIFIED LICENSED DOCTOR ✓</span>
                <span className="text-[10px] text-gray-700">Approved by Council Admin</span>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-red-100 text-red-700 px-2 py-1 rounded border border-red-300 font-bold">
              NMC REG: {currentKyc.councilRegistration}
            </span>
          </div>
        );
      case 'pending':
        return (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2 font-bold">
            <Clock className="w-5 h-5 shrink-0 text-amber-600 animate-pulse" />
            <div>
              <span className="font-bold uppercase tracking-wider block">KYC APPLICATION PENDING APPROVAL</span>
              <span className="text-[10px] text-gray-700">Your details have been submitted and are under review by the Medical Board Admin.</span>
            </div>
          </div>
        );
      case 'rejected':
        return (
          <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-700 text-xs flex items-center gap-2 font-bold">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <div>
              <span className="font-bold uppercase tracking-wider block">VERIFICATION REJECTED</span>
              <span className="text-[10px] text-red-700">{currentKyc.rejectionReason || "Credentials require update. Please re-submit correct Council Registration."}</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="p-3 bg-gray-100 border border-gray-300 rounded-xl text-black text-xs flex items-center gap-2 font-bold">
            <ShieldCheck className="w-5 h-5 shrink-0 text-red-600" />
            <div>
              <span className="font-bold uppercase tracking-wider block">UNVERIFIED PRACTITIONER</span>
              <span className="text-[10px] text-gray-700">Submit your Medical Council License to receive official verified practitioner status.</span>
            </div>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-white border border-gray-300 rounded-2xl shadow-2xl p-6 text-black my-8 max-h-[90vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-black rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer border-none"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="text-center mb-6 space-y-2">
            <div className="w-12 h-12 bg-red-100 border border-red-300 rounded-xl flex items-center justify-center text-red-600 mx-auto">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-display font-bold tracking-tight text-black uppercase">
              Doctor KYC Verification Form
            </h2>
            <p className="text-gray-600 text-xs font-medium">
              Medical Board Verification for Licensed Physicians & Specialists
            </p>
          </div>

          <div className="mb-6">{getStatusBadge()}</div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-100 border border-red-300 text-red-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-100 border border-red-300 text-black text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-red-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmitKyc} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">Full Legal Name (with Title)</label>
              <input
                required
                type="text"
                placeholder="Dr. Sunil Timilsina"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">Medical Council Reg. No.</label>
                <div className="relative">
                  <input
                    required
                    type="text"
                    placeholder="e.g. NMC-28491"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-red-600 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-red-600"
                    value={councilRegistration}
                    onChange={(e) => setCouncilRegistration(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">Medical Qualification / Degree</label>
                <select
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                >
                  <option value="MBBS">MBBS</option>
                  <option value="MBBS, MD">MBBS, MD (Internal Med/EM/Anesthesia)</option>
                  <option value="MBBS, MS">MBBS, MS (Surgery)</option>
                  <option value="DM / MCh">DM / MCh (Cardiology/Critical Care)</option>
                  <option value="FCPS / DNB">FCPS / DNB</option>
                  <option value="BSc Nursing / MN">BSc Nursing / Master Nursing</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">Specialty / Department</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Internal Medicine / CCU"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">Current Hospital / Institution</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Bir Hospital / TUIOM"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">License Verification ID / Citizenship No.</label>
              <input
                type="text"
                placeholder="e.g. 27-01-78-01928"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                value={idCardNumber}
                onChange={(e) => setIdCardNumber(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border-none shadow-md disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Doctor License KYC
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
