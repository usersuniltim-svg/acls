import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, LogIn, ClipboardCheck, GraduationCap, Calendar, UserRound, Stethoscope, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { UserProfile } from '../types';

interface OnboardingFormProps {
  onComplete: () => void;
}

export default function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const [formData, setFormData] = useState<Omit<UserProfile, 'email' | 'onboardedAt'>>({
    fullName: '',
    profession: 'doctor', // Default or empty string
    highestDegree: '',
    dob: '',
    sex: 'male',
    councilRegistration: '',
    phone: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const profileDocRef = doc(db, 'profiles', auth.currentUser.uid);
      const dataToSave = {
        ...formData,
        email: auth.currentUser.email,
        onboardedAt: Date.now(),
      };
      console.log("Payload:", dataToSave);
      await setDoc(profileDocRef, dataToSave);
      onComplete();
    } catch (err) {
      setError("Failed to save profile. Please try again.");
      handleFirestoreError(err, OperationType.CREATE, `profiles/${auth.currentUser.uid}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = "w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-medical-blue/50 focus:border-medical-blue transition-all disabled:opacity-50";
  const labelClasses = "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

  return (
    <div className="w-full min-h-screen bg-medical-dark flex items-center justify-center p-4 py-12 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-white/5 bg-slate-900/40">
          <div className="w-16 h-16 bg-medical-blue/20 rounded-2xl flex items-center justify-center text-medical-blue mb-6 mx-auto shadow-lg shadow-medical-blue/10">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white text-center mb-2 tracking-tight">Onboarding</h1>
          <p className="text-slate-400 text-center text-sm uppercase tracking-wide font-bold">Complete your professional profile to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="md:col-span-2">
              <label className={labelClasses}>Full Name</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><User className="w-5 h-5" /></span>
                <input 
                  required
                  type="text"
                  placeholder="Dr. John Doe"
                  className={`${inputClasses} pl-12`}
                  value={formData.fullName}
                  onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                />
              </div>
            </div>

            {/* Profession */}
            <div>
              <label className={labelClasses}>Profession Type</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Stethoscope className="w-5 h-5" /></span>
                <select 
                  required
                  className={`${inputClasses} pl-12 appearance-none`}
                  value={formData.profession}
                  onChange={e => setFormData(p => ({ ...p, profession: e.target.value }))}
                >
                  <option value="">Select Profession</option>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="paramedics">Paramedics</option>
                </select>
              </div>
            </div>

            {/* Highest Degree */}
            <div>
              <label className={labelClasses}>Highest Degree</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><GraduationCap className="w-5 h-5" /></span>
                <input 
                  required
                  type="text"
                  placeholder="MD, MBBS, RN"
                  className={`${inputClasses} pl-12`}
                  value={formData.highestDegree}
                  onChange={e => setFormData(p => ({ ...p, highestDegree: e.target.value }))}
                />
              </div>
            </div>

            {/* DOB */}
            <div>
              <label className={labelClasses}>Date of Birth</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Calendar className="w-5 h-5" /></span>
                <input 
                  required
                  type="date"
                  className={`${inputClasses} pl-12`}
                  value={formData.dob}
                  onChange={e => setFormData(p => ({ ...p, dob: e.target.value }))}
                />
              </div>
            </div>

            {/* Sex */}
            <div>
              <label className={labelClasses}>Sex</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><UserRound className="w-5 h-5" /></span>
                <select 
                  required
                  className={`${inputClasses} pl-12 appearance-none`}
                  value={formData.sex}
                  onChange={e => setFormData(p => ({ ...p, sex: e.target.value }))}
                >
                  <option value="">Select Sex</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Council Registration */}
            <div className="md:col-span-2">
              <label className={labelClasses}>Council Registration Number</label>
              <input 
                required
                type="text"
                placeholder="REG123456789"
                className={inputClasses}
                value={formData.councilRegistration}
                onChange={e => setFormData(p => ({ ...p, councilRegistration: e.target.value }))}
              />
            </div>

            {/* Phone */}
            <div className="md:col-span-2">
              <label className={labelClasses}>Phone Number</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Phone className="w-5 h-5" /></span>
                <input 
                  required
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className={`${inputClasses} pl-12`}
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-medical-red text-xs font-bold text-center uppercase tracking-wider"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-medical-blue hover:bg-medical-blue/90 text-white font-bold h-14 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-medical-blue/20 transition-all disabled:opacity-50 uppercase tracking-[0.15em] text-sm"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Complete Registration
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
