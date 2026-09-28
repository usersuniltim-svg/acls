import React from 'react';
import { createPortal } from 'react-dom';
import { LogEvent } from '../types';

interface PrintableReportProps {
  /** Identifies this report so printReport() can print it on its own. */
  printId: string;
  patientCode: string;
  savedAt?: number | string;
  totalDuration: number;
  cprCycleCount: number;
  shocksCount: number;
  epiCount: number;
  logs: LogEvent[];
  certifiedBy: string;
  councilRegistration: string;
  signatureDataUrl?: string;
  currentRhythm?: string;
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function formatDuration(totalSec: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSec || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(timestamp: number) {
  return timeFormatter.format(new Date(timestamp));
}

function formatDateTime(timestamp: number) {
  return dateTimeFormatter.format(new Date(timestamp));
}

function formatDate(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}

function getRhythmLabel(description: string) {
  const lower = description.toLowerCase();
  if (lower.includes('vf / pulseless vt') || lower.includes('shockable')) return 'VF / pulseless VT';
  if (lower.includes('asystole / pea') || lower.includes('non-shockable')) return 'Asystole / PEA';
  if (lower.includes('organized rhythm')) return 'Organized rhythm with pulse';
  return description.replace(/^Rhythm check #\d+:\s*/i, '').trim();
}

export default function PrintableReport({
  printId,
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
  const chronologicalLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

  const drugLogs = chronologicalLogs.filter((l) =>
    l.type === 'DRUG_EPI' ||
    l.type === 'DRUG_AMIO' ||
    l.type === 'DRUG_LIDO' ||
    /epinephrine|epi|amiodarone|lidocaine|atropine|magnesium|bicarb|calcium/i.test(l.description)
  );

  const shockLogs = chronologicalLogs.filter((l) =>
    l.type === 'SHOCK' || /shock|joule|defibrillation/i.test(l.description)
  );

  const procedureLogs = chronologicalLogs.filter((l) =>
    l.type === 'ROSC' ||
    l.type === 'ADVANCED_AIRWAY' ||
    /airway|intubation|vascular access|iv access|io access|central line|arterial line|chest tube|thoracostomy|procedure/i.test(l.description)
  );

  const rhythmLogs = chronologicalLogs.filter((l) => l.type === 'RHYTHM_CHECK');
  const firstEventAt = chronologicalLogs[0]?.timestamp ?? (savedAt ? new Date(savedAt).getTime() : Date.now());
  const lastEventAt = chronologicalLogs[chronologicalLogs.length - 1]?.timestamp ?? firstEventAt;
  const initialRhythm = rhythmLogs[0] ? getRhythmLabel(rhythmLogs[0].description) : 'Not documented';
  const finalRhythm = currentRhythm || (rhythmLogs.length ? getRhythmLabel(rhythmLogs[rhythmLogs.length - 1].description) : 'Not documented');
  const hasRosc = chronologicalLogs.some((l) => l.type === 'ROSC' || /ROSC achieved|ROSC confirmed/i.test(l.description));
  const outcome = hasRosc ? 'ROSC confirmed' : 'No ROSC documented';
  const signed = Boolean(signatureDataUrl);
  const recordStatus = signed ? 'SIGNED / ATTESTED' : 'UNSIGNED / DRAFT';

  const report = (
    <div className="acls-print-report-portal" data-print-id={printId} aria-hidden="true">
      <main className="acls-print-report">
        {/* PAGE 1 */}
        <section className="acls-print-page">
          <header className="acls-print-header">
            <div>
              <div className="acls-print-brand">ACLS COMPANION</div>
              <div className="acls-print-title">RESUSCITATION RECORD</div>
            </div>
            <div className="acls-print-header-meta">
              <div>CONFIDENTIAL MEDICAL RECORD</div>
              <div className={signed ? 'acls-print-status signed' : 'acls-print-status'}>{recordStatus}</div>
            </div>
          </header>

          <div className="acls-print-rule" />

          <section className="acls-print-intro">
            <div>
              <div className="acls-print-eyebrow">ADVANCED CARDIAC LIFE SUPPORT</div>
              <h1>Resuscitation Event Record</h1>
              <p>Clinical event record generated from the documented resuscitation session.</p>
            </div>
            <div className="acls-print-case-badge">
              <span>CASE ID</span>
              <strong>{patientCode}</strong>
            </div>
          </section>

          <section className="acls-print-section">
            <h2>I. Case Information</h2>
            <div className="acls-print-info-grid">
              <div><span>Case / Patient ID</span><strong>{patientCode}</strong></div>
              <div><span>Event Date</span><strong>{formatDate(firstEventAt)}</strong></div>
              <div><span>Resuscitation Started</span><strong>{formatDateTime(firstEventAt)}</strong></div>
              <div><span>Last Recorded Event</span><strong>{formatDateTime(lastEventAt)}</strong></div>
              <div><span>Total Resuscitation Duration</span><strong>{formatDuration(totalDuration)}</strong></div>
              <div><span>Record Status</span><strong>{recordStatus}</strong></div>
            </div>
          </section>

          <section className="acls-print-section">
            <h2>II. Resuscitation Summary</h2>
            <div className="acls-print-metrics">
              <div><span>Initial Rhythm</span><strong>{initialRhythm}</strong></div>
              <div><span>Final Documented Rhythm</span><strong>{finalRhythm}</strong></div>
              <div><span>Outcome</span><strong>{outcome}</strong></div>
              <div><span>CPR Cycles</span><strong>{cprCycleCount}</strong></div>
              <div><span>Shocks Delivered</span><strong>{shocksCount}</strong></div>
              <div><span>Epinephrine Doses</span><strong>{epiCount}</strong></div>
            </div>
          </section>

          <section className="acls-print-section acls-print-physician-card">
            <div>
              <h2>Attending Resuscitation Physician</h2>
              <strong>{certifiedBy || 'Not documented'}</strong>
              <span>NMC Council Registration: {councilRegistration || 'Not documented'}</span>
            </div>
            <div className="acls-print-attestation-chip">{signed ? 'Physician signature attached' : 'Signature pending'}</div>
          </section>

          <footer className="acls-print-footer">
            <span>ACLS Companion • Case {patientCode}</span>
            <span>Page 1 of 4</span>
          </footer>
        </section>

        {/* PAGE 2 */}
        <section className="acls-print-page">
          <header className="acls-print-page-header">
            <div>ACLS COMPANION <span>• {patientCode}</span></div>
            <strong>RESUSCITATION TIMELINE</strong>
          </header>

          <section className="acls-print-section acls-print-timeline-section">
            <div className="acls-print-section-heading-row">
              <h2>III. Complete Chronological Event Log</h2>
              <span>{chronologicalLogs.length} documented events</span>
            </div>

            {chronologicalLogs.length === 0 ? (
              <div className="acls-print-empty">No resuscitation events were recorded.</div>
            ) : (
              <table className="acls-print-table acls-print-timeline-table">
                <thead>
                  <tr><th>#</th><th>Time</th><th>Event / Clinical Action</th></tr>
                </thead>
                <tbody>
                  {chronologicalLogs.map((log, idx) => (
                    <tr key={log.id || `${log.timestamp}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td className="mono">{formatTime(log.timestamp)}</td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <footer className="acls-print-footer">
            <span>ACLS Companion • Case {patientCode}</span>
            <span>Page 2 of 4</span>
          </footer>
        </section>

        {/* PAGE 3 */}
        <section className="acls-print-page">
          <header className="acls-print-page-header">
            <div>ACLS COMPANION <span>• {patientCode}</span></div>
            <strong>CLINICAL DETAILS</strong>
          </header>

          <section className="acls-print-section">
            <h2>IV. Medication Administration</h2>
            {drugLogs.length === 0 ? (
              <div className="acls-print-empty">No medication administration events were recorded.</div>
            ) : (
              <table className="acls-print-table">
                <thead><tr><th>#</th><th>Time</th><th>Medication / Dose / Route</th></tr></thead>
                <tbody>
                  {drugLogs.map((log, idx) => (
                    <tr key={log.id || `${log.timestamp}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td className="mono">{formatTime(log.timestamp)}</td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="acls-print-section">
            <h2>V. Defibrillation / Shock History</h2>
            {shockLogs.length === 0 ? (
              <div className="acls-print-empty">No defibrillation events were recorded.</div>
            ) : (
              <table className="acls-print-table">
                <thead><tr><th>Shock</th><th>Time</th><th>Documented Details</th></tr></thead>
                <tbody>
                  {shockLogs.map((log, idx) => (
                    <tr key={log.id || `${log.timestamp}-${idx}`}>
                      <td>#{idx + 1}</td>
                      <td className="mono">{formatTime(log.timestamp)}</td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="acls-print-section">
            <h2>VI. Airway & Key Procedures</h2>
            {procedureLogs.length === 0 ? (
              <div className="acls-print-empty">No airway or procedure events were recorded.</div>
            ) : (
              <table className="acls-print-table">
                <thead><tr><th>Time</th><th>Procedure / Intervention</th></tr></thead>
                <tbody>
                  {procedureLogs.map((log, idx) => (
                    <tr key={log.id || `${log.timestamp}-${idx}`}>
                      <td className="mono">{formatTime(log.timestamp)}</td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="acls-print-section">
            <h2>VII. Rhythm Progression</h2>
            {rhythmLogs.length === 0 ? (
              <div className="acls-print-empty">No rhythm-check events were recorded.</div>
            ) : (
              <div className="acls-print-rhythm-list">
                {rhythmLogs.map((log, idx) => (
                  <div key={log.id || `${log.timestamp}-${idx}`} className="acls-print-rhythm-item">
                    <span>{formatTime(log.timestamp)}</span>
                    <strong>{getRhythmLabel(log.description)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <footer className="acls-print-footer">
            <span>ACLS Companion • Case {patientCode}</span>
            <span>Page 3 of 4</span>
          </footer>
        </section>

        {/* PAGE 4 */}
        <section className="acls-print-page acls-print-attestation-page">
          <header className="acls-print-page-header">
            <div>ACLS COMPANION <span>• {patientCode}</span></div>
            <strong>ATTESTATION</strong>
          </header>

          <section className="acls-print-section">
            <h2>VIII. Resuscitation Record Review</h2>
            <div className="acls-print-review-grid">
              <div><span>Resuscitation start</span><strong>{formatDateTime(firstEventAt)}</strong></div>
              <div><span>Last recorded event</span><strong>{formatDateTime(lastEventAt)}</strong></div>
              <div><span>Total duration</span><strong>{formatDuration(totalDuration)}</strong></div>
              <div><span>Outcome</span><strong>{outcome}</strong></div>
              <div><span>Initial rhythm</span><strong>{initialRhythm}</strong></div>
              <div><span>Final rhythm</span><strong>{finalRhythm}</strong></div>
            </div>
          </section>

          <section className="acls-print-attestation-box">
            <div className="acls-print-eyebrow">PHYSICIAN ATTESTATION</div>
            <p>I attest that this resuscitation record accurately reflects the clinical events documented during this resuscitation session.</p>
            <div className="acls-print-signatory">
              <strong>{certifiedBy || 'Not documented'}</strong>
              <span>NMC Council Registration: {councilRegistration || 'Not documented'}</span>
            </div>

            <div className="acls-print-signature-label">CLINICIAN SIGNATURE</div>
            <div className={`acls-print-signature-box ${signed ? 'has-signature' : ''}`}>
              {signed ? (
                <img src={signatureDataUrl} alt="Physician signature" />
              ) : (
                <span>Signature not attached</span>
              )}
            </div>

            <div className="acls-print-signed-meta">
              <div><span>Status</span><strong>{signed ? 'Signed / Attested' : 'Unsigned / Draft'}</strong></div>
              <div><span>Signed / generated</span><strong>{formatDateTime(savedAt ? new Date(savedAt).getTime() : lastEventAt)}</strong></div>
            </div>
          </section>

          <section className="acls-print-record-info">
            <h2>IX. Record Information</h2>
            <div><span>Case ID</span><strong>{patientCode}</strong></div>
            <div><span>Record version</span><strong>1.0</strong></div>
            <div><span>Generated by</span><strong>ACLS Companion</strong></div>
            <div><span>Record generated</span><strong>{formatDateTime(Date.now())}</strong></div>
          </section>

          <div className="acls-print-final-note">
            This document is a record of the events documented in ACLS Companion. It does not replace the institution's medical record or applicable clinical documentation requirements.
          </div>

          <footer className="acls-print-footer">
            <span>ACLS Companion • Case {patientCode}</span>
            <span>Page 4 of 4</span>
          </footer>
        </section>
      </main>
    </div>
  );

  // The report is deliberately rendered directly under <body> so the browser's
  // print tree cannot inherit the dashboard's overflow, transforms, or layout.
  return typeof document !== 'undefined' ? createPortal(report, document.body) : null;
}
