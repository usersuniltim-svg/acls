import React, { useState, useRef } from 'react';
import { SavedCase, LogEvent } from '../types';
import { FileText, Trash2, Calendar, Clock, Zap, Syringe, Eye, AlertCircle, PlusCircle, CheckCircle2, X, PenTool, RotateCcw, Printer, ShieldCheck, AlertTriangle, Download, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PrintableReport from './PrintableReport';

interface SavedCasesListProps {
  savedCases: SavedCase[];
  onSaveCurrentCase: (patientCode: string, signatureDataUrl?: string) => boolean;
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState<{ patientCode: string; signatureDataUrl: string } | null>(null);
  const [isAccuracyConfirmed, setIsAccuracyConfirmed] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewingCase, setViewingCase] = useState<SavedCase | null>(null);

  // Canvas Signature Pad State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasDrawnSignature(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#10B981'; // Emerald Green signature stroke

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
    }
    setHasDrawnSignature(false);
  };

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
    if (!hasDrawnSignature) {
      setSaveError("Doctor's signature is REQUIRED to certify and save this resuscitation log. Please draw your signature on the pad below.");
      return;
    }
    if (savedCases.length >= 3) {
      setSaveError('Maximum 3 saved cases reached. Delete an older case first.');
      return;
    }

    const signatureDataUrl = canvasRef.current ? canvasRef.current.toDataURL() : '';
    setPendingData({
      patientCode: patientCodeInput.trim(),
      signatureDataUrl,
    });
    setIsAccuracyConfirmed(false);
    setSaveError('');
    setShowSaveModal(false);
    setShowConfirmModal(true);
  };

  const handleFinalConfirmSave = () => {
    if (!pendingData) return;
    if (!isAccuracyConfirmed) {
      setSaveError('You must explicitly check the confirmation box verifying data accuracy.');
      return;
    }

    const success = onSaveCurrentCase(pendingData.patientCode, pendingData.signatureDataUrl);
    if (success) {
      setPatientCodeInput('');
      setShowConfirmModal(false);
      setPendingData(null);
      setSaveError('');
      setIsAccuracyConfirmed(false);
      clearSignature();
    } else {
      setSaveError('Maximum 3 saved cases reached. Delete an older case first.');
      setShowConfirmModal(false);
      setShowSaveModal(true);
    }
  };

  return (
    <div className="space-y-4 text-left text-black">
      {/* Header & Save Action Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-3.5 rounded-xl border border-gray-300">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-bold text-black uppercase tracking-wider">Saved Resuscitation Cases</h3>
          </div>
          <p className="text-[9px] font-mono text-gray-700 mt-0.5 uppercase font-bold">
            Stored: <strong className="text-red-600">{savedCases.length} / 3 Maximum Cases</strong>
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
          className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border-none ${
            hasCurrentLogs
              ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-md'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Save Current Case Log
        </button>
      </div>

      {/* Case Limit Reached Warning Banner */}
      {savedCases.length >= 3 && (
        <div className="p-3 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-700 text-[10px] font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>Storage limit reached (3 / 3 cases). Delete an existing case below to make room for new sessions.</span>
        </div>
      )}

      {/* Saved Cases Cards List */}
      {savedCases.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 border border-gray-300 rounded-xl space-y-2">
          <FileText className="w-8 h-8 text-gray-500 mx-auto" />
          <p className="text-xs font-bold text-black uppercase tracking-wider">No Saved Cases Yet</p>
          <p className="text-[9px] text-gray-700 leading-normal max-w-xs mx-auto font-medium">
            You can save up to 3 resuscitation case logs with certified signatures, timestamps, epinephrine doses, and shock records.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {savedCases.map((item, idx) => (
            <div
              key={item.id}
              className="bg-white border border-gray-300 rounded-xl p-3.5 space-y-3 shadow-md flex flex-col justify-between text-black"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[8px] font-mono text-red-600 uppercase font-bold tracking-widest block">
                      Saved Case #{idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-black truncate max-w-[160px]">{item.patientCode}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCase(item.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border-none"
                    title="Delete saved case"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[9px] text-gray-700 font-mono font-bold">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-500" />
                    {new Date(item.savedAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    {formatDuration(item.totalDuration)}
                  </span>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-gray-200 text-center font-mono">
                  <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                    <span className="text-[7px] text-gray-600 uppercase block font-bold">CPR</span>
                    <span className="text-[10px] font-bold text-black">{item.cprCycleCount}</span>
                  </div>
                  <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                    <span className="text-[7px] text-gray-600 uppercase block font-bold">Shocks</span>
                    <span className="text-[10px] font-bold text-red-600">{item.shocksCount}</span>
                  </div>
                  <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                    <span className="text-[7px] text-gray-600 uppercase block font-bold">Epi</span>
                    <span className="text-[10px] font-bold text-black">{item.epiCount}</span>
                  </div>
                </div>

                <div className="text-[8.5px] text-gray-700 font-sans border-t border-gray-200 pt-1.5">
                  <span className="text-gray-500 block font-bold">Certified Practitioner:</span>
                  <strong className="text-black font-bold block truncate">{item.certifiedBy}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setViewingCase(item)}
                  className="py-1.5 bg-gray-100 hover:bg-gray-200 text-black rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer border-none shadow-sm"
                >
                  <Eye className="w-3 h-3 text-gray-700" /> View Log ({item.logs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewingCase(item);
                    setTimeout(() => {
                      const origTitle = document.title;
                      document.title = `ACLS_Case_Report_${item.patientCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                      window.print();
                      setTimeout(() => { document.title = origTitle; }, 1000);
                    }, 100);
                  }}
                  className="py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer border-none shadow-sm"
                >
                  <Download className="w-3 h-3" /> Export PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Save Case Dialog */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 bg-white border border-gray-300 rounded-2xl space-y-4 text-left relative shadow-2xl text-black"
            >
              <button
                onClick={() => setShowSaveModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-black p-1 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl text-red-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black uppercase tracking-wider">Save Resuscitation Case</h3>
                  <p className="text-[9px] text-red-600 font-mono uppercase font-bold">Nepal Registry Protocol Audit</p>
                </div>
              </div>

              <form onSubmit={handleSaveSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-black mb-1.5 tracking-wider">
                    Patient Identification / Case Code
                  </label>
                  <input
                    type="text"
                    value={patientCodeInput}
                    onChange={(e) => setPatientCodeInput(e.target.value)}
                    placeholder="e.g. PATIENT-RM-204"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 font-mono"
                  />
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-[9.5px]">
                  <span className="text-gray-600 block uppercase font-mono font-bold">Certifying Doctor:</span>
                  <span className="text-black font-bold block">{practitionerName}</span>
                  <span className="text-gray-700 block font-mono">REG: {councilRegistration}</span>
                </div>

                {/* Digital Signature Pad */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase text-red-600 tracking-wider flex items-center gap-1">
                      <PenTool className="w-3 h-3 text-red-600" /> Doctor Signature Required *
                    </label>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[8px] bg-gray-100 hover:bg-gray-200 text-black px-2 py-0.5 rounded font-mono font-bold uppercase flex items-center gap-1 border-none cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Clear Signature
                    </button>
                  </div>

                  <div className="relative border border-gray-300 rounded-xl overflow-hidden bg-white h-24 touch-none cursor-crosshair">
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={96}
                      className="w-full h-full"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    {!hasDrawnSignature && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-gray-400 text-[10px] font-mono uppercase tracking-wider font-bold">
                        ✍️ Sign Here with Touch or Mouse
                      </div>
                    )}
                  </div>
                </div>

                {saveError && (
                  <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-700 text-[10px] font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveModal(false);
                      clearSignature();
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-black rounded-xl text-[10px] font-bold uppercase tracking-wider border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shadow-md border-none cursor-pointer"
                  >
                    Review & Confirm Save →
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Explicit Confirmation Dialog before committing to Firestore */}
      <AnimatePresence>
        {showConfirmModal && pendingData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 bg-white border border-gray-300 rounded-2xl space-y-4 text-left relative shadow-2xl text-black"
            >
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowSaveModal(true);
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-black p-1 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-xl text-amber-700">
                  <ShieldCheck className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black uppercase tracking-wider">Confirm Case Registry Entry</h3>
                  <p className="text-[9px] text-amber-700 font-mono uppercase font-bold">Explicit Clinical Verification</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-[10px]">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  <strong>Accidental Save Prevention:</strong> Please review and explicitly verify that the resuscitation logs, drug history, and patient code are accurate before committing this record to Firestore.
                </p>
              </div>

              {/* Case Summary Preview */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase">Case / Patient ID:</span>
                  <span className="font-mono font-black text-black text-xs">{pendingData.patientCode}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase">Certifying Doctor:</span>
                  <span className="font-bold text-black text-[11px]">{practitionerName} ({councilRegistration})</span>
                </div>
                {pendingData.signatureDataUrl && (
                  <div className="space-y-1">
                    <span className="text-[8px] font-bold text-gray-500 uppercase block">Doctor Signature Attached:</span>
                    <div className="bg-white border border-gray-200 rounded p-1 max-h-12 flex justify-center">
                      <img src={pendingData.signatureDataUrl} alt="Signature Preview" className="max-h-10 object-contain" />
                    </div>
                  </div>
                )}
              </div>

              {/* Required Confirmation Checkbox */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAccuracyConfirmed}
                    onChange={(e) => setIsAccuracyConfirmed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-red-950 leading-snug">
                    I explicitly confirm that all clinical resuscitation logs, drug administration timestamps, and patient details are accurate and verified.
                  </span>
                </label>
              </div>

              {saveError && (
                <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-700 text-[10px] font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setShowSaveModal(true);
                  }}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-black rounded-xl text-[10px] font-bold uppercase tracking-wider border-none cursor-pointer"
                >
                  ← Back & Edit
                </button>
                <button
                  type="button"
                  disabled={!isAccuracyConfirmed}
                  onClick={handleFinalConfirmSave}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-md border-none ${
                    isAccuracyConfirmed
                      ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  Confirm & Commit to Firestore
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: View Full Case Event Details */}
      <AnimatePresence>
        {viewingCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 bg-white border border-gray-300 rounded-2xl space-y-4 text-left relative shadow-2xl max-h-[85vh] flex flex-col text-black"
            >
              <button
                onClick={() => setViewingCase(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-black p-1 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 border-b border-gray-200 pb-3 shrink-0">
                <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl text-red-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black uppercase tracking-wider">{viewingCase.patientCode}</h3>
                  <p className="text-[9px] text-gray-600 font-mono font-bold">
                    Recorded on {new Date(viewingCase.savedAt).toLocaleString()} • Duration: {formatDuration(viewingCase.totalDuration)}
                  </p>
                </div>
              </div>

              {/* Case Stats */}
              <div className="grid grid-cols-3 gap-2 py-1 shrink-0 text-center font-mono">
                <div className="bg-gray-50 p-2 rounded-xl border border-gray-200">
                  <span className="text-[8px] text-gray-600 uppercase block font-bold">CPR Cycles</span>
                  <span className="text-sm font-bold text-black">{viewingCase.cprCycleCount}</span>
                </div>
                <div className="bg-gray-50 p-2 rounded-xl border border-gray-200">
                  <span className="text-[8px] text-gray-600 uppercase block font-bold">Shocks</span>
                  <span className="text-sm font-bold text-red-600">{viewingCase.shocksCount}</span>
                </div>
                <div className="bg-gray-50 p-2 rounded-xl border border-gray-200">
                  <span className="text-[8px] text-gray-600 uppercase block font-bold">Epi Doses</span>
                  <span className="text-sm font-bold text-black">{viewingCase.epiCount}</span>
                </div>
              </div>

              {/* Event Logs Stream */}
              <div className="flex-1 overflow-y-auto space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200 custom-scrollbar min-h-[180px]">
                <span className="text-[8.5px] uppercase tracking-wider text-black font-bold block border-b border-gray-200 pb-1">
                  Chronological Event Stream
                </span>
                {viewingCase.logs.map((log) => (
                  <div key={log.id} className="flex gap-2 items-start pl-2 border-l-2 border-red-600 py-1">
                    <span className="text-[8px] font-mono text-gray-600 shrink-0 font-bold">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </span>
                    <span className="text-[9.5px] uppercase font-bold text-black">{log.description}</span>
                  </div>
                ))}
              </div>

              {/* Certified Signature Display */}
              {viewingCase.signatureDataUrl && (
                <div className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl space-y-1">
                  <span className="text-[8px] font-mono font-bold uppercase text-red-600 block">Doctor Certified Digital Signature:</span>
                  <div className="bg-white border border-gray-200 rounded-lg p-1 max-h-16 flex items-center justify-center">
                    <img src={viewingCase.signatureDataUrl} alt="Doctor Signature" className="max-h-12 object-contain" />
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 flex flex-wrap justify-between items-center text-[9px] text-black font-bold shrink-0 gap-2">
                <span>Certified: <strong className="text-black">{viewingCase.certifiedBy}</strong> ({viewingCase.councilRegistration})</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const origTitle = document.title;
                      document.title = `ACLS_Case_Report_${viewingCase.patientCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                      window.print();
                      setTimeout(() => { document.title = origTitle; }, 1000);
                    }}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer border-none"
                  >
                    <Download className="w-3.5 h-3.5" /> Export PDF / Print Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingCase(null)}
                    className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-black rounded-xl font-bold uppercase tracking-wider border-none cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OFFICIAL PRINTABLE PDF REPORT VIEW (Triggered on window.print()) */}
      {viewingCase && (
        <PrintableReport
          patientCode={viewingCase.patientCode}
          savedAt={viewingCase.savedAt}
          totalDuration={viewingCase.totalDuration}
          cprCycleCount={viewingCase.cprCycleCount}
          shocksCount={viewingCase.shocksCount}
          epiCount={viewingCase.epiCount}
          logs={viewingCase.logs}
          certifiedBy={viewingCase.certifiedBy}
          councilRegistration={viewingCase.councilRegistration}
          signatureDataUrl={viewingCase.signatureDataUrl}
        />
      )}
    </div>
  );
}

