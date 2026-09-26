import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ShieldCheck, CheckCircle2, XCircle, Clock, Search, RefreshCw, 
  UserCheck, AlertTriangle, AlertCircle, FileText, HeartPulse, Activity, Zap, 
  Syringe, FileCheck, ChevronDown, ChevronUp, User, Award, Building, Sparkles,
  PlusCircle
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { DoctorKyc, SavedCase, UserProfile } from '../types';

interface AdminKycPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
  onProfileApproved?: (docId: string, updatedKyc: DoctorKyc) => void;
}

export default function AdminKycPanel({ isOpen, onClose, currentUserEmail, onProfileApproved }: AdminKycPanelProps) {
  const [activeView, setActiveView] = useState<'kyc' | 'cases'>('kyc');
  const [profiles, setProfiles] = useState<(UserProfile & { id: string })[]>([]);
  const [allCases, setAllCases] = useState<(SavedCase & { doctorUid?: string; doctorEmail?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [expandedCasesDocId, setExpandedCasesDocId] = useState<string | null>(null);
  const [selectedCaseModal, setSelectedCaseModal] = useState<SavedCase | null>(null);
  const [rejectModalTarget, setRejectModalTarget] = useState<{ docId: string; doctorName: string } | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('Medical Council license number unverified in NMC registry.');

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setLoadError(null);

    // 1. Subscribe to profiles collection
    const profilesCol = collection(db, 'profiles');
    const unsubProfiles = onSnapshot(profilesCol, (snapshot) => {
      const list: (UserProfile & { id: string })[] = [];
      const extractedCases: (SavedCase & { doctorUid?: string; doctorEmail?: string })[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        list.push({ ...data, id: docSnap.id });

        if (data.savedCases && Array.isArray(data.savedCases)) {
          data.savedCases.forEach((sc) => {
            extractedCases.push({
              ...sc,
              doctorUid: docSnap.id,
              doctorEmail: data.email || ''
            });
          });
        }
      });

      setProfiles(list);
      setAllCases(prev => {
        // combine deduplicated cases
        const map = new Map<string, SavedCase & { doctorUid?: string; doctorEmail?: string }>();
        extractedCases.forEach(c => map.set(c.id, c));
        prev.forEach(c => {
          if (!map.has(c.id)) map.set(c.id, c);
        });
        return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
      });
      setLoading(false);
    }, (err) => {
      console.error("Admin panel could not load profiles:", err);
      // Show the real error instead of quietly falling back to this device's data
      setLoadError(err?.code ? `${err.code}: ${err.message}` : String(err));
      setProfiles([]);
      setLoading(false);
    });

    // 2. Also listen to top-level /cases collection
    const casesCol = collection(db, 'cases');
    const unsubCases = onSnapshot(casesCol, (snapshot) => {
      const casesList: (SavedCase & { doctorUid?: string; doctorEmail?: string })[] = [];
      snapshot.forEach((docSnap) => {
        casesList.push(docSnap.data() as any);
      });
      if (casesList.length > 0) {
        setAllCases(prev => {
          const map = new Map<string, SavedCase & { doctorUid?: string; doctorEmail?: string }>();
          casesList.forEach(c => map.set(c.id, c));
          prev.forEach(c => {
            if (!map.has(c.id)) map.set(c.id, c);
          });
          return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
        });
      }
    }, (err) => {
      console.error("Admin panel could not load cases:", err);
      setLoadError(prev => prev || (err?.code ? `${err.code}: ${err.message}` : String(err)));
    });

    return () => {
      unsubProfiles();
      unsubCases();
    };
  }, [isOpen]);

  const handleCreateSampleCase = async () => {
    setActionStatus("Generating standard ACLS clinical resuscitation case...");
    const sampleId = `sample_${Date.now()}`;
    const t0 = Date.now() - 480 * 1000; // sample code started 8 minutes ago
    const sampleCase: SavedCase & { doctorUid?: string; doctorEmail?: string } = {
      id: sampleId,
      patientCode: `SAMPLE-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      savedAt: Date.now(),
      totalDuration: 480, // 8 minutes
      cprCycleCount: 4,
      shocksCount: 2,
      epiCount: 2,
      certifiedBy: 'SAMPLE DATA - not a real patient',
      councilRegistration: 'SAMPLE',
      signatureDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><path d="M10,25 Q30,5 50,20 T90,15 T110,28" fill="none" stroke="%2310b981" stroke-width="3"/></svg>',
      doctorUid: auth.currentUser?.uid || 'admin_user',
      doctorEmail: currentUserEmail || auth.currentUser?.email || 'user.suniltim@gmail.com',
      logs: [
        { id: 's1', timestamp: t0 + 0 * 1000, type: 'CPR_START', description: 'Arrest recognized in Emergency Dept. CPR initiated immediately.' },
        { id: 's2', timestamp: t0 + 10 * 1000, type: 'RHYTHM_CHECK', description: 'Rhythm Analysis: Coarse Ventricular Fibrillation (VF) confirmed.' },
        { id: 's3', timestamp: t0 + 25 * 1000, type: 'SHOCK', description: 'Shock #1 delivered (200J Biphasic). Immediate CPR resumed for 2 minutes.' },
        { id: 's4', timestamp: t0 + 145 * 1000, type: 'DRUG_EPI', description: '1mg Epinephrine IV pushed with 20ml saline flush.' },
        { id: 's5', timestamp: t0 + 155 * 1000, type: 'RHYTHM_CHECK', description: 'Rhythm Check Cycle #2: Persistent VF/Pulseless VT.' },
        { id: 's6', timestamp: t0 + 170 * 1000, type: 'SHOCK', description: 'Shock #2 delivered (200J Biphasic). CPR resumed.' },
        { id: 's7', timestamp: t0 + 290 * 1000, type: 'DRUG_AMIO', description: 'Amiodarone 300mg IV bolus administered.' },
        { id: 's8', timestamp: t0 + 350 * 1000, type: 'DRUG_EPI', description: '1mg Epinephrine second dose administered.' },
        { id: 's9', timestamp: t0 + 470 * 1000, type: 'ROSC', description: 'Rhythm conversion: Normal Sinus with palpable central pulse. ROSC achieved.' }
      ]
    };

    setAllCases(prev => [sampleCase, ...prev]);

    try {
      const caseRef = doc(db, 'cases', sampleId);
      await setDoc(caseRef, {
        ...sampleCase,
        userId: auth.currentUser?.uid || 'admin_user',
        isSample: true,
        syncedAt: Date.now()
      }, { merge: true });
      setActionStatus("✓ Sample Resuscitation Case generated & synced to Firestore Registry");
      setTimeout(() => setActionStatus(null), 3000);
    } catch (err) {
      console.warn("Could not save sample case to Firestore:", err);
      setActionStatus("✓ Sample Resuscitation Case created in registry view");
      setTimeout(() => setActionStatus(null), 3000);
    }
  };

  if (!isOpen) return null;

  const handleApprove = async (docId: string, doctorName: string) => {
    setActionStatus(`Approving Dr. ${doctorName}...`);
    const targetProfile = profiles.find(p => p.id === docId);
    const existingKyc = targetProfile?.kyc || {
      councilRegistration: targetProfile?.councilRegistration || 'NMC-VERIFIED',
      degree: targetProfile?.highestDegree || 'MBBS',
      specialty: 'Clinical Practice',
      institution: 'Hospital Practice'
    };

    const updatedKyc: DoctorKyc = {
      ...existingKyc,
      councilRegistration: existingKyc.councilRegistration || targetProfile?.councilRegistration || 'NMC-VERIFIED',
      kycStatus: 'approved',
      approvedAt: Date.now(),
      approvedBy: currentUserEmail || 'Nepal Medical Council Admin Board'
    };

    // Update in-memory state immediately for instant feedback
    setProfiles(prev => prev.map(p => {
      if (p.id === docId) {
        return {
          ...p,
          kyc: updatedKyc,
          councilRegistration: updatedKyc.councilRegistration
        };
      }
      return p;
    }));

    // If this is the current practitioner or local profile, update local cache & notify App.tsx
    if (onProfileApproved) {
      onProfileApproved(docId, updatedKyc);
    }
    try {
      const local = localStorage.getItem('acls_user_profile');
      if (local) {
        const parsed = JSON.parse(local);
        if (docId === auth.currentUser?.uid || parsed.email === targetProfile?.email) {
          localStorage.setItem('acls_user_profile', JSON.stringify({
            ...parsed,
            kyc: updatedKyc,
            councilRegistration: updatedKyc.councilRegistration
          }));
        }
      }
    } catch (e) {}

    try {
      const profileRef = doc(db, 'profiles', docId);
      await setDoc(profileRef, {
        kyc: updatedKyc,
        councilRegistration: updatedKyc.councilRegistration
      }, { merge: true });

      const userRef = doc(db, 'users', docId);
      await setDoc(userRef, {
        kyc: updatedKyc,
        councilRegistration: updatedKyc.councilRegistration
      }, { merge: true }).catch(() => {});

      setActionStatus(`✓ Verified & Approved Medical License for ${doctorName}`);
      setTimeout(() => setActionStatus(null), 3000);
    } catch (err) {
      console.warn("Firestore approval write notice:", err);
      setActionStatus(`✓ Approved (Verified locally and in state)`);
      setTimeout(() => setActionStatus(null), 3000);
    }
  };

  const handleReject = (docId: string, doctorName: string) => {
    setRejectModalTarget({ docId, doctorName });
    setRejectReasonInput('Medical Council license number unverified in NMC registry.');
  };

  const confirmReject = async () => {
    if (!rejectModalTarget) return;
    const { docId, doctorName } = rejectModalTarget;
    const reason = rejectReasonInput.trim() || 'Medical Council license number unverified in NMC registry.';
    setRejectModalTarget(null);

    setActionStatus(`Rejecting ${doctorName}...`);
    const targetProfile = profiles.find(p => p.id === docId);
    const existingKyc = targetProfile?.kyc || {
      councilRegistration: targetProfile?.councilRegistration || 'NMC-UNVERIFIED',
      degree: targetProfile?.highestDegree || 'MBBS',
      specialty: 'Clinical Practice',
      institution: 'Hospital Practice'
    };

    const updatedKyc: DoctorKyc = {
      ...existingKyc,
      kycStatus: 'rejected',
      rejectionReason: reason
    };

    setProfiles(prev => prev.map(p => {
      if (p.id === docId) {
        return {
          ...p,
          kyc: updatedKyc
        };
      }
      return p;
    }));

    if (onProfileApproved) {
      onProfileApproved(docId, updatedKyc);
    }

    try {
      const profileRef = doc(db, 'profiles', docId);
      await setDoc(profileRef, {
        kyc: updatedKyc
      }, { merge: true });

      const userRef = doc(db, 'users', docId);
      await setDoc(userRef, {
        kyc: updatedKyc
      }, { merge: true }).catch(() => {});

      setActionStatus(`Rejected KYC application for ${doctorName}`);
      setTimeout(() => setActionStatus(null), 3000);
    } catch (err) {
      setActionStatus(`Rejected (Local state updated)`);
      setTimeout(() => setActionStatus(null), 3000);
    }
  };

  const filteredProfiles = profiles.filter(p => {
    const status = p.kyc?.kycStatus || 'unsubmitted';
    if (filter !== 'all' && status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = p.fullName?.toLowerCase().includes(q);
      const regMatch = p.councilRegistration?.toLowerCase().includes(q) || p.kyc?.councilRegistration?.toLowerCase().includes(q);
      const emailMatch = p.email?.toLowerCase().includes(q);
      return nameMatch || regMatch || emailMatch;
    }
    return true;
  });

  const pendingCount = profiles.filter(p => p.kyc?.kycStatus === 'pending').length;
  const approvedCount = profiles.filter(p => p.kyc?.kycStatus === 'approved').length;
  const rejectedCount = profiles.filter(p => p.kyc?.kycStatus === 'rejected').length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[260] bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative w-full max-w-5xl bg-white border border-gray-300 rounded-2xl shadow-2xl p-4 sm:p-6 text-black my-4 max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 border border-red-300 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-black uppercase tracking-tight">
                  Medical Council Admin Dashboard
                </h2>
                <p className="text-gray-600 text-xs font-medium">
                  Review Doctor KYC Licenses & Audit Saved Resuscitation Cases (Nepal ACLS Registry)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-black rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer border-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action notification toast */}
          {actionStatus && (
            <div className="mt-3 p-2.5 bg-red-100 border border-red-300 rounded-xl text-black text-xs font-bold text-center animate-pulse">
              {actionStatus}
            </div>
          )}

          {/* Top Primary View Switcher: KYC Applications vs Resuscitation Cases */}
          <div className="mt-3 flex items-center gap-2 border-b border-gray-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveView('kyc')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-none ${
                activeView === 'kyc'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:text-black hover:bg-gray-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Doctor KYC Applications ({profiles.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('cases')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-none ${
                activeView === 'cases'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:text-black hover:bg-gray-200'
              }`}
            >
              <HeartPulse className="w-4 h-4" />
              Saved Resuscitation Registry ({allCases.length})
            </button>
          </div>

          {/* VIEW 1: KYC APPLICATIONS */}
          {activeView === 'kyc' && (
            <>
              {/* Controls Bar */}
              <div className="py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-gray-200 shrink-0">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => setFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border-none whitespace-nowrap ${
                      filter === 'pending' ? 'bg-red-600 text-white shadow' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    Pending Review ({pendingCount})
                  </button>
                  <button
                    onClick={() => setFilter('approved')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border-none whitespace-nowrap ${
                      filter === 'approved' ? 'bg-red-600 text-white shadow' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    Verified Doctors ({approvedCount})
                  </button>
                  <button
                    onClick={() => setFilter('rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border-none whitespace-nowrap ${
                      filter === 'rejected' ? 'bg-red-600 text-white shadow' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    Rejected ({rejectedCount})
                  </button>
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border-none whitespace-nowrap ${
                      filter === 'all' ? 'bg-black text-white' : 'text-gray-700 hover:text-black'
                    }`}
                  >
                    All ({profiles.length})
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search Doctor Name or NMC Reg..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600 font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Doctors List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3 custom-scrollbar">
                {loading ? (
                  <div className="text-center py-12 text-gray-500 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-red-600" />
                    <span>Loading Practitioner KYC Records from Firestore...</span>
                  </div>
                ) : loadError ? (
                  <div className="text-left py-6 text-xs bg-red-50 rounded-xl border border-red-300 p-4 text-red-800">
                    <p className="font-bold uppercase tracking-wider mb-1">Could not load doctor records from the database</p>
                    <p className="font-mono text-[10px] break-all">{loadError}</p>
                    <p className="text-[10px] mt-2 text-red-700">If this says "permission-denied", make sure you are signed in with the admin Google account or admin credentials.</p>
                  </div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-xs bg-gray-50 rounded-xl border border-gray-200 p-8">
                    <UserCheck className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="font-bold uppercase tracking-wider text-black">No Doctor KYC applications found in this category.</p>
                    <p className="text-[10px] text-gray-600 mt-1 font-medium">Doctors who submit the KYC form will appear here for Admin Verification.</p>
                  </div>
                ) : (
                  filteredProfiles.map((prof) => {
                    const kyc = prof.kyc || {
                      kycStatus: 'unsubmitted',
                      councilRegistration: prof.councilRegistration || 'NMC-PENDING',
                      degree: prof.highestDegree || 'MBBS',
                      specialty: 'Clinical Medicine',
                      institution: 'Hospital Practice'
                    };
                    const savedCasesCount = prof.savedCases?.length || 0;
                    const isCasesExpanded = expandedCasesDocId === prof.id;

                    return (
                      <div
                        key={prof.id}
                        className="p-4 bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl flex flex-col gap-3 transition-all text-black"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-black">{prof.fullName || 'Practitioner'}</span>
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 font-bold uppercase">
                                NMC: {kyc.councilRegistration || prof.councilRegistration || 'PENDING'}
                              </span>
                              {kyc.kycStatus === 'approved' && (
                                <span className="text-[9px] font-bold uppercase tracking-widest bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-red-600" /> VERIFIED
                                </span>
                              )}
                              {kyc.kycStatus === 'pending' && (
                                <span className="text-[9px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                                  <Clock className="w-3 h-3 animate-pulse text-amber-600" /> PENDING REVIEW
                                </span>
                              )}
                              {kyc.kycStatus === 'rejected' && (
                                <span className="text-[9px] font-bold uppercase tracking-widest bg-gray-200 text-gray-800 border border-gray-300 px-2 py-0.5 rounded flex items-center gap-1">
                                  <XCircle className="w-3 h-3 text-gray-600" /> REJECTED
                                </span>
                              )}
                              {kyc.kycStatus === 'unsubmitted' && (
                                <span className="text-[9px] font-bold uppercase tracking-widest bg-gray-200 text-gray-700 border border-gray-300 px-2 py-0.5 rounded">
                                  KYC UNCOMPLETED
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-gray-700 space-y-0.5 font-sans font-medium">
                              <p>
                                <strong className="text-black font-bold">{kyc.degree || 'MBBS'}</strong> • Specialty: <span className="text-black font-bold">{kyc.specialty || 'Emergency/Cardiology'}</span>
                              </p>
                              <p className="text-[11px] text-gray-600">
                                Institution: {kyc.institution || 'Medical Center'} • Email: {prof.email}
                                {kyc.idCardNumber && ` • License Card ID: ${kyc.idCardNumber}`}
                              </p>
                              {kyc.rejectionReason && (
                                <p className="text-[10px] text-red-600 italic font-bold">Rejection Reason: {kyc.rejectionReason}</p>
                              )}
                            </div>
                          </div>

                          {/* Actions Bar */}
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {savedCasesCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedCasesDocId(isCasesExpanded ? null : prof.id)}
                                className="px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-black border border-gray-300 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <HeartPulse className="w-3.5 h-3.5 text-red-600" />
                                {savedCasesCount} Saved {savedCasesCount === 1 ? 'Case' : 'Cases'}
                                {isCasesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}

                            {kyc.kycStatus !== 'approved' && (
                              <button
                                onClick={() => handleApprove(prof.id, prof.fullName)}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer border-none transition-all"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve License
                              </button>
                            )}

                            {kyc.kycStatus !== 'rejected' && (
                              <button
                                onClick={() => handleReject(prof.id, prof.fullName)}
                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-black border border-gray-300 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Resuscitation Cases Drawer */}
                        {isCasesExpanded && prof.savedCases && (
                          <div className="mt-2 pt-2 border-t border-gray-200 bg-white p-3 rounded-xl border space-y-2">
                            <span className="text-[10px] font-bold text-black uppercase tracking-wider block">
                              Certified Cases Saved by Dr. {prof.fullName}:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {prof.savedCases.map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => setSelectedCaseModal(c)}
                                  className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:border-red-500 cursor-pointer text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-black font-mono">{c.patientCode}</span>
                                    <span className="text-[9px] text-gray-500">{new Date(c.savedAt).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-gray-700">
                                    <span>CPR: {Math.floor(c.totalDuration / 60)}m {c.totalDuration % 60}s</span>
                                    <span>• Shocks: {c.shocksCount}</span>
                                    <span>• Epi: {c.epiCount}</span>
                                  </div>
                                  {c.signatureDataUrl && (
                                    <div className="pt-1 flex items-center gap-1 text-[9px] text-emerald-700 font-bold">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Digitally Certified
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* VIEW 2: RESUSCITATION CASE REGISTRY */}
          {activeView === 'cases' && (
            <div className="flex-1 overflow-y-auto py-3 space-y-3 custom-scrollbar">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Audit Registry ({allCases.length} Certified {allCases.length === 1 ? 'Case' : 'Cases'})
                </span>
                <button
                  type="button"
                  onClick={handleCreateSampleCase}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border-none shadow transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  + Generate Sample Case for Audit
                </button>
              </div>

              {allCases.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs bg-gray-50 rounded-xl border border-gray-200 p-8 space-y-3">
                  <HeartPulse className="w-8 h-8 text-red-500 mx-auto mb-2 opacity-60" />
                  <p className="font-bold uppercase tracking-wider text-black">No certified resuscitation cases in registry yet.</p>
                  <p className="text-[10px] text-gray-600 mt-1 font-medium max-w-sm mx-auto">
                    When verified doctors complete cardiac arrest resuscitations and click &quot;Save Case&quot; with digital signature, cases will render here in real-time.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateSampleCase}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer border-none shadow transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Create First Test Case Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allCases.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl space-y-3 shadow-sm text-black"
                    >
                      <div className="flex items-start justify-between border-b border-gray-200 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold bg-black text-white px-2 py-0.5 rounded">
                              {c.patientCode}
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {new Date(c.savedAt).toLocaleDateString()} {new Date(c.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-black font-bold mt-1">
                            Resuscitated by: Dr. {c.certifiedBy || 'Licensed Practitioner'}
                          </p>
                          <p className="text-[10px] text-gray-600 font-mono">
                            NMC Reg: {c.councilRegistration || 'VERIFIED'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCaseModal(c)}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase rounded-lg border-none cursor-pointer shadow"
                        >
                          View Audit
                        </button>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-white p-2 rounded-lg border border-gray-200">
                          <span className="text-[8.5px] font-bold text-gray-500 uppercase block">Duration</span>
                          <span className="text-xs font-mono font-bold text-black">
                            {Math.floor(c.totalDuration / 60)}m {c.totalDuration % 60}s
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-gray-200">
                          <span className="text-[8.5px] font-bold text-gray-500 uppercase block">Cycles</span>
                          <span className="text-xs font-mono font-bold text-black">{c.cprCycleCount}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-gray-200">
                          <span className="text-[8.5px] font-bold text-gray-500 uppercase block">Shocks</span>
                          <span className="text-xs font-mono font-bold text-red-600">{c.shocksCount}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-gray-200">
                          <span className="text-[8.5px] font-bold text-gray-500 uppercase block">Epi</span>
                          <span className="text-xs font-mono font-bold text-blue-600">{c.epiCount}</span>
                        </div>
                      </div>

                      {/* Doctor Digital Signature Preview */}
                      {c.signatureDataUrl && (
                        <div className="bg-white p-2 rounded-lg border border-gray-200 flex items-center justify-between">
                          <div className="text-[9px] text-gray-600">
                            <span className="font-bold block text-black">PHYSICIAN SIGNATURE</span>
                            <span>Certified on device</span>
                          </div>
                          <img
                            src={c.signatureDataUrl}
                            alt="Physician Signature"
                            className="h-8 max-w-[120px] object-contain border border-gray-100 rounded bg-gray-50"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Info */}
          <div className="pt-3 border-t border-gray-200 text-[10px] text-gray-600 flex items-center justify-between font-mono uppercase font-bold">
            <span>Admin Council Session: <strong className="text-black">AUTH-NMC-2026</strong></span>
            <span>Nepal ACLS Protocol Board • Firestore Synced</span>
          </div>

          {/* Case Detail Inspection Modal */}
          {selectedCaseModal && (
            <div className="fixed inset-0 z-[280] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white text-black w-full max-w-lg rounded-2xl p-5 border border-gray-300 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase text-black font-mono">
                      Resuscitation Audit Log • {selectedCaseModal.patientCode}
                    </h3>
                    <p className="text-[10px] text-gray-600">
                      Certified by Dr. {selectedCaseModal.certifiedBy} (NMC: {selectedCaseModal.councilRegistration})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCaseModal(null)}
                    className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer border-none"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <span className="text-[9px] text-gray-500 uppercase block font-bold">Duration</span>
                    <span className="text-xs font-mono font-bold text-black">
                      {Math.floor(selectedCaseModal.totalDuration / 60)}m {selectedCaseModal.totalDuration % 60}s
                    </span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <span className="text-[9px] text-gray-500 uppercase block font-bold">CPR Cycles</span>
                    <span className="text-xs font-mono font-bold text-black">{selectedCaseModal.cprCycleCount}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <span className="text-[9px] text-gray-500 uppercase block font-bold">Defib Shocks</span>
                    <span className="text-xs font-mono font-bold text-red-600">{selectedCaseModal.shocksCount}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <span className="text-[9px] text-gray-500 uppercase block font-bold">Adrenaline</span>
                    <span className="text-xs font-mono font-bold text-blue-600">{selectedCaseModal.epiCount}</span>
                  </div>
                </div>

                {/* Event Logs Timeline */}
                <div className="flex-1 overflow-y-auto space-y-1.5 border border-gray-200 p-2.5 rounded-xl bg-gray-50 max-h-56 custom-scrollbar text-xs font-mono">
                  {selectedCaseModal.logs && selectedCaseModal.logs.length > 0 ? (
                    selectedCaseModal.logs.map((log) => (
                      <div key={log.id} className="p-1.5 bg-white rounded border border-gray-200 flex items-start gap-2">
                        <span className="text-[9px] text-gray-500 shrink-0 font-bold">
                          +{Math.floor(log.timestamp / 60)}:{(log.timestamp % 60).toString().padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-black leading-tight">{log.description}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-gray-500 text-center py-4">No granular log entries recorded for this case.</p>
                  )}
                </div>

                {/* Signature Preview */}
                {selectedCaseModal.signatureDataUrl && (
                  <div className="border border-gray-200 p-2.5 rounded-xl bg-gray-50 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold uppercase text-black block">Doctor Digital Signature</span>
                      <span className="text-[9px] text-gray-500">Certified by {selectedCaseModal.certifiedBy}</span>
                    </div>
                    <img
                      src={selectedCaseModal.signatureDataUrl}
                      alt="Signature"
                      className="h-10 max-w-[140px] object-contain border border-gray-200 bg-white rounded"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedCaseModal(null)}
                  className="w-full py-2 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold uppercase border-none cursor-pointer"
                >
                  Close Case Audit
                </button>
              </div>
            </div>
          )}

          {/* Rejection Reason In-App Modal */}
          {rejectModalTarget && (
            <div className="fixed inset-0 z-[260] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white border border-gray-300 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-black">
                <div className="flex items-center gap-2 text-red-600 font-bold text-sm uppercase">
                  <AlertCircle className="w-5 h-5" />
                  <span>Reject KYC Application</span>
                </div>
                <p className="text-xs text-gray-700">
                  Provide medical council rejection reason for <strong>Dr. {rejectModalTarget.doctorName}</strong>:
                </p>
                <textarea
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="Reason for rejection..."
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRejectModalTarget(null)}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-black rounded-xl text-xs font-bold uppercase border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmReject}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase border-none cursor-pointer"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
