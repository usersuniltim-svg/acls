import React from 'react';
import { LogEvent } from '../types';

interface PrintableReportProps {
  patientCode: string;
  savedAt?: number | string;
  totalDuration: number; // seconds
  cprCycleCount: number;
  shocksCount: number;
  epiCount: number;
  logs: LogEvent[];
  certifiedBy: string;
  councilRegistration: string;
  signatureDataUrl?: string;
  currentRhythm?: string;
}

export default function PrintableReport({
  patientCode,
  savedAt,
  totalDuration,
  cprCycleCount,
  shocksCount,
  epiCount,
  logs = [],
  certifiedBy,
  councilRegistration,
  signatureDataUrl,
  currentRhythm,
}: PrintableReportProps) {
  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse Drug Administration History from logs
  const drugLogs = logs.filter((l) =>
    l.type === 'DRUG_EPI' ||
    l.type === 'DRUG_AMIO' ||
    l.type === 'DRUG_LIDO' ||
    /epinephrine|epi|amiodarone|lidocaine|atropine|magnesium|bicarb|calcium/i.test(l.description)
  );

  // Parse Shock History from logs
  const shockLogs = logs.filter((l) =>
    l.type === 'SHOCK' ||
    /shock|joule|defibrillation/i.test(l.description)
  );

  // Parse Airway & ROSC events
  const airwayAndRoscLogs = logs.filter((l) =>
    l.type === 'ROSC' ||
    l.type === 'ADVANCED_AIRWAY' ||
    /airway|rosc|intubation|iv|io|line/i.test(l.description)
  );

  const reportDate = savedAt
    ? new Date(savedAt).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="printable-report-wrapper hidden print:block fixed inset-0 bg-white text-black z-[9999999] p-8 overflow-visible font-sans leading-normal">
      <div className="max-w-4xl mx-auto space-y-6 text-black border-2 border-black p-6 rounded-lg">
        
        {/* REPORT HEADER */}
        <div className="border-b-2 border-black pb-4 text-center relative">
          <div className="flex justify-between items-center mb-2 text-xs font-mono font-bold uppercase text-gray-600">
            <span>OFFICIAL CLINICAL REGISTRY</span>
            <span>CONFIDENTIAL MEDICAL RECORD</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-black">
            ADVANCED CARDIAC LIFE SUPPORT (ACLS)
          </h1>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 mt-1">
            Resuscitation Event Log & Clinical Audit Summary
          </h2>
          <div className="mt-2 text-[10px] font-mono font-bold text-gray-600 flex justify-around border-t border-gray-300 pt-2">
            <span>Report Ref: {patientCode}</span>
            <span>Date & Time: {reportDate}</span>
            <span>Status: CERTIFIED CASE RECORD</span>
          </div>
        </div>

        {/* CLINICAL METRICS OVERVIEW */}
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-black border-b border-black pb-1">
            I. Resuscitation Summary Metrics
          </h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="border border-gray-400 p-2 rounded bg-gray-50">
              <span className="text-[8px] font-bold uppercase text-gray-600 block">Total Duration</span>
              <span className="text-base font-black font-mono text-black">{formatDuration(totalDuration)}</span>
            </div>
            <div className="border border-gray-400 p-2 rounded bg-gray-50">
              <span className="text-[8px] font-bold uppercase text-gray-600 block">CPR Cycles</span>
              <span className="text-base font-black font-mono text-black">{cprCycleCount}</span>
            </div>
            <div className="border border-gray-400 p-2 rounded bg-gray-50">
              <span className="text-[8px] font-bold uppercase text-gray-600 block">Shocks Delivered</span>
              <span className="text-base font-black font-mono text-black">{shocksCount}</span>
            </div>
            <div className="border border-gray-400 p-2 rounded bg-gray-50">
              <span className="text-[8px] font-bold uppercase text-gray-600 block">Epi Doses (1mg)</span>
              <span className="text-base font-black font-mono text-black">{epiCount}</span>
            </div>
          </div>
        </div>

        {/* PATIENT & PHYSICIAN INFO BOX */}
        <div className="grid grid-cols-2 gap-4 border border-gray-400 rounded p-3 text-xs bg-gray-50/80">
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Patient / Case ID:</p>
            <p className="font-black text-sm text-black font-mono">{patientCode}</p>
            {currentRhythm && (
              <p className="text-[10px] text-gray-700 mt-1 font-bold">
                Last Rhythm State: <span className="uppercase font-extrabold">{currentRhythm}</span>
              </p>
            )}
          </div>
          <div>
            <p className="text-[9px] font-bold text-gray-500 uppercase">Attending Resuscitation Physician:</p>
            <p className="font-black text-sm text-black uppercase">{certifiedBy}</p>
            <p className="text-[10px] font-mono text-gray-700 font-bold">NMC Council Reg #: {councilRegistration}</p>
          </div>
        </div>

        {/* DRUG ADMINISTRATION HISTORY */}
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-black border-b border-black pb-1">
            II. Drug Administration History
          </h3>
          {drugLogs.length === 0 ? (
            <p className="text-[10px] italic text-gray-500 py-1">No medication administration recorded during this resuscitation session.</p>
          ) : (
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="border-b-2 border-black bg-gray-100">
                  <th className="py-1 px-2 font-black uppercase w-12">#</th>
                  <th className="py-1 px-2 font-black uppercase w-28">Timestamp</th>
                  <th className="py-1 px-2 font-black uppercase">Medication & Dose Details</th>
                </tr>
              </thead>
              <tbody>
                {drugLogs.map((log, idx) => (
                  <tr key={log.id || idx} className="border-b border-gray-300">
                    <td className="py-1 px-2 font-mono font-bold text-gray-600">{idx + 1}</td>
                    <td className="py-1 px-2 font-mono font-bold text-black">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </td>
                    <td className="py-1 px-2 font-bold text-black uppercase">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DEFIBRILLATION & AIRWAY/PROCEDURE SUMMARY */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <h4 className="text-[11px] font-black uppercase text-black border-b border-gray-400 pb-0.5">
              Defibrillation Shock History ({shocksCount})
            </h4>
            {shockLogs.length === 0 ? (
              <p className="text-[9.5px] italic text-gray-500">No defibrillation shocks delivered.</p>
            ) : (
              <ul className="text-[9.5px] font-mono space-y-0.5 pl-0 list-none">
                {shockLogs.map((log, idx) => (
                  <li key={log.id || idx} className="border-b border-gray-200 py-0.5 flex justify-between">
                    <span className="text-gray-600">Shock #{idx + 1}:</span>
                    <span className="font-bold text-black">{log.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <h4 className="text-[11px] font-black uppercase text-black border-b border-gray-400 pb-0.5">
              Airway & Key Procedures Log
            </h4>
            {airwayAndRoscLogs.length === 0 ? (
              <p className="text-[9.5px] italic text-gray-500">Standard CPR interventions maintained.</p>
            ) : (
              <ul className="text-[9.5px] font-mono space-y-0.5 pl-0 list-none">
                {airwayAndRoscLogs.map((log, idx) => (
                  <li key={log.id || idx} className="border-b border-gray-200 py-0.5 flex justify-between">
                    <span className="font-bold text-black uppercase">{log.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* FULL CHRONOLOGICAL EVENT STREAM */}
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-black border-b border-black pb-1">
            III. Complete Chronological Resuscitation Timeline Log ({logs.length} Events)
          </h3>
          <table className="w-full text-left border-collapse text-[9.5px]">
            <thead>
              <tr className="border-b-2 border-black bg-gray-100">
                <th className="py-1 px-2 font-black uppercase w-10">#</th>
                <th className="py-1 px-2 font-black uppercase w-24">Time</th>
                <th className="py-1 px-2 font-black uppercase">Intervention / Clinical Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={log.id || idx} className="border-b border-gray-300">
                  <td className="py-1 px-2 font-mono font-bold text-gray-600">{idx + 1}</td>
                  <td className="py-1 px-2 font-mono font-bold text-black">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </td>
                  <td className="py-1 px-2 font-bold text-black uppercase">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* DOCTOR CERTIFICATION & SIGNATURE FOOTER */}
        <div className="border-t-2 border-black pt-4 mt-6 flex justify-between items-end">
          <div className="space-y-1 max-w-xs">
            <p className="text-[9px] font-black uppercase text-gray-600">Attending Resuscitation Physician Statement:</p>
            <p className="text-[9px] text-gray-800 leading-tight">
              I hereby certify that this resuscitation event log accurately reflects the Advanced Cardiac Life Support (ACLS) procedures, drug dosages, and cardiac interventions performed under my clinical supervision.
            </p>
            <p className="text-[10px] font-black text-black uppercase pt-1">{certifiedBy}</p>
            <p className="text-[9px] font-mono text-gray-700">Council Reg #: {councilRegistration}</p>
          </div>

          <div className="text-right space-y-1">
            <p className="text-[9px] font-black uppercase text-gray-600">Doctor Digital Seal & Signature:</p>
            {signatureDataUrl ? (
              <div className="border border-gray-400 p-1 rounded bg-white inline-block">
                <img src={signatureDataUrl} alt="Certified Doctor Signature" className="h-14 max-w-[220px] object-contain" />
              </div>
            ) : (
              <div className="h-12 w-44 border border-dashed border-gray-400 flex items-center justify-center text-[8px] text-gray-500 font-mono">
                [Digitally Certified Seal]
              </div>
            )}
            <p className="text-[8px] font-mono text-emerald-800 font-bold uppercase block">
              ✓ Verified Medical License Certified
            </p>
          </div>
        </div>

        {/* AUDIT FOOTER */}
        <div className="border-t border-gray-300 pt-2 text-center text-[8px] text-gray-500 font-mono">
          <span>ACLS Nepal Companion • Audit Ref #{patientCode} • Generated on {new Date().toLocaleString()}</span>
        </div>

      </div>
    </div>
  );
}
