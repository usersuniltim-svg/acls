import React, { useState } from 'react';
import { SavedCase, LogEvent } from '../types';
import { FileText, Trash2, Calendar, Clock, Zap, Syringe, Eye, AlertCircle, PlusCircle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SavedCasesListProps {
  savedCases: SavedCase[];
  onSaveCurrentCase: (patientCode: string) => boolean; // returns true if saved, false if limit reached
  onDeleteCase: (caseId: string) => void;
  hasCurrentLogs: boolean;
  practitionerName: string;
  councilRegistration: string;
}

export default function SavedCasesList({
  savedCases = [],
  onSaveCurrentCase,
  onDeleteCase,
  hasCurrentLogs,
  practitionerName,
  councilRegistration,
}: SavedCasesListProps) {
  const [patientCodeInput, setPatientCodeInput] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewingCase, setViewingCase] = useState<SavedCase | null>(null);

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientCodeInput.trim()) {
      setSaveError('Please enter a patient or code ID');
      return;
    }
    if (savedCases.length >= 3) {
      setSaveError('Maximum 3 saved cases reached. Delete an older case first.');
      return;
    }

    const success = onSaveCurrentCase(patientCodeInput.trim());
    if (success) {
      setPatientCodeInput('');
      setShowSaveModal(false);
      setSaveError('');
    } else {
      setSaveError('Maximum 3 saved cases reached. Delete an older case first.');
    }
  };

  return (
    <div className="space-y-4 text-left">
      {/* Header & Save Action Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 p-3.5 rounded-xl border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Saved Resuscitation Cases</h3>
          </div>
          <p className="text-[9px] font-mono text-slate-400 mt-0.5 uppercase">
            Stored: <strong className="text-emerald-400">{savedCases.length} / 3 Maximum Cases</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (savedCases.length >= 3) {
              alert("You have reached the maximum limit of 3 saved cases. Please delete an existing case to free up a slot.");
              return;
            }
            if (!hasCurrentLogs) {
              alert("No active resuscitation logs to save in the current session.");
              return;
            }
            setPatientCodeInput(`CASE-${new Date().toLocaleDateString().replace(/\//g, '')}-${Math.floor(100 + Math.random() * 900)}`);
            setSaveError('');
            setShowSaveModal(true);
          }}
          disabled={!hasCurrentLogs}
          className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
            hasCurrentLogs
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-600/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Save Current Case Log
        </button>
      </div>

      {/* Case Limit Reached Warning Banner */}
      {savedCases.length >= 3 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-300 text-[10px] font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Storage limit reached (3 / 3 cases). Delete an existing case below to make room for new sessions.</span>
        </div>
      )}

      {/* Saved Cases Cards List */}
      {savedCases.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/30 border border-white/5 rounded-xl space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Saved Cases Yet</p>
          <p className="text-[9px] text-slate-500 leading-normal max-w-xs mx-auto">
            You can save up to 3 resuscitation case logs with certified signatures, timestamps, epinephrine doses, and shock records.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {savedCases.map((item, idx) => (
            <div
              key={item.id}
              className="bg-slate-900/80 border border-white/10 hover:border-emerald-500/30 rounded-xl p-3.5 space-y-3 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[8px] font-mono text-emerald-400 uppercase font-bold tracking-widest block">
                      Saved Case #{idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-white truncate max-w-[160px]">{item.patientCode}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCase(item.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Delete saved case"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[9px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {new Date(item.savedAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {formatDuration(item.totalDuration)}
                  </span>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/5 text-center font-mono">
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                    <span className="text-[7px] text-slate-500 uppercase block">CPR</span>
                    <span className="text-[10px] font-bold text-white">{item.cprCycleCount}</span>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                    <span className="text-[7px] text-slate-500 uppercase block">Shocks</span>
                    <span className="text-[10px] font-bold text-red-400">{item.shocksCount}</span>
                  </div>
                  <div className="bg-slate-950 p-1.5 rounded-lg border border-white/5">
                    <span className="text-[7px] text-slate-500 uppercase block">Epi</span>
                    <span className="text-[10px] font-bold text-blue-400">{item.epiCount}</span>
                  </div>
                </div>

                <div className="text-[8.5px] text-slate-400 font-sans border-t border-white/5 pt-1.5">
                  <span className="text-slate-500 block">Certified Practitioner:</span>
                  <strong className="text-slate-300 font-bold block truncate">{item.certifiedBy}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingCase(item)}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border border-white/5 transition-colors"
              >
                <Eye className="w-3 h-3" /> View Full Case Log ({item.logs.length} Events)
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Save Case Dialog */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-panel p-6 bg-slate-900 border-emerald-500/30 rounded-2xl space-y-4 text-left relative shadow-2xl"
            >
              <button
                onClick={() => setShowSaveModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/50"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Save Resuscitation Case</h3>
                  <p className="text-[9px] text-emerald-300 font-mono uppercase">Nepal Registry Protocol Audit</p>
                </div>
              </div>

              <form onSubmit={handleSaveSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-300 mb-1.5 tracking-wider">
                    Patient Identification / Case Code
                  </label>
                  <input
                    type="text"
                    value={patientCodeInput}
                    onChange={(e) => setPatientCodeInput(e.target.value)}
                    placeholder="e.g. PATIENT-RM-204"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-1 text-[9.5px]">
                  <span className="text-slate-500 block uppercase font-mono font-bold">Certifying Doctor:</span>
                  <span className="text-white font-bold block">{practitionerName}</span>
                  <span className="text-slate-400 block font-mono">REG: {councilRegistration}</span>
                </div>

                {saveError && (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-[10px] font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(false)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-600/30"
                  >
                    Confirm & Save Case Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: View Full Case Event Details */}
      <AnimatePresence>
        {viewingCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg glass-panel p-6 bg-slate-900 border-white/10 rounded-2xl space-y-4 text-left relative shadow-2xl max-h-[85vh] flex flex-col"
            >
              <button
                onClick={() => setViewingCase(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/50"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 border-b border-white/10 pb-3 shrink-0">
                <div className="p-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">{viewingCase.patientCode}</h3>
                  <p className="text-[9px] text-slate-400 font-mono">
                    Recorded on {new Date(viewingCase.savedAt).toLocaleString()} • Duration: {formatDuration(viewingCase.totalDuration)}
                  </p>
                </div>
              </div>

              {/* Case Stats */}
              <div className="grid grid-cols-3 gap-2 py-1 shrink-0 text-center font-mono">
                <div className="bg-slate-950 p-2 rounded-xl border border-white/5">
                  <span className="text-[8px] text-slate-500 uppercase block">CPR Cycles</span>
                  <span className="text-sm font-bold text-white">{viewingCase.cprCycleCount}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-white/5">
                  <span className="text-[8px] text-slate-500 uppercase block">Shocks</span>
                  <span className="text-sm font-bold text-red-400">{viewingCase.shocksCount}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-white/5">
                  <span className="text-[8px] text-slate-500 uppercase block">Epi Doses</span>
                  <span className="text-sm font-bold text-blue-400">{viewingCase.epiCount}</span>
                </div>
              </div>

              {/* Event Logs Stream */}
              <div className="flex-1 overflow-y-auto space-y-2 p-3 bg-slate-950 rounded-xl border border-white/5 custom-scrollbar min-h-[180px]">
                <span className="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold block border-b border-white/5 pb-1">
                  Chronological Event Stream
                </span>
                {viewingCase.logs.map((log) => (
                  <div key={log.id} className="flex gap-2 items-start pl-2 border-l border-slate-800 py-1">
                    <span className="text-[8px] font-mono text-slate-500 shrink-0 font-bold">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </span>
                    <span className="text-[9.5px] uppercase font-bold text-slate-300">{log.description}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[9px] text-slate-400 shrink-0">
                <span>Certified: {viewingCase.certifiedBy} ({viewingCase.councilRegistration})</span>
                <button
                  type="button"
                  onClick={() => setViewingCase(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase tracking-wider"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
