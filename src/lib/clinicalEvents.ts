import { ClinicalEvent, ClinicalEventInput, LogEvent } from '../types';

/** Creates an append-only structured event. */
export function createClinicalEvent<K extends ClinicalEvent['kind']>(input: ClinicalEventInput<K>, sequence: number): Extract<ClinicalEvent, { kind: K }> {
  return {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    timestamp: input.timestamp ?? Date.now(),
    sequence,
    kind: input.kind,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.actorName ? { actorName: input.actorName } : {}),
    source: input.source ?? 'user',
    payload: input.payload ?? {},
    ...(input.description ? { description: input.description } : {}),
  };
}

/** Convert a structured event to the legacy log shape used by older PDFs/cases. */
export function clinicalEventToLegacyLog(event: ClinicalEvent): LogEvent {
  const legacyType: LogEvent['type'] =
    event.kind === 'EPINEPHRINE' ? 'DRUG_EPI' :
    event.kind === 'AMIODARONE' ? 'DRUG_AMIO' :
    event.kind === 'LIDOCAINE' ? 'DRUG_LIDO' :
    event.kind === 'CODE_START' || event.kind === 'CPR_START' || event.kind === 'CPR_RESUME' || event.kind === 'RE_ARREST' ? 'CPR_START' :
    event.kind === 'PROCEDURE' ? 'ADVANCED_AIRWAY' :
    event.kind === 'INFO' || event.kind === 'CPR_PAUSE' ? 'INFO' :
    event.kind as LogEvent['type'];
  return { id: event.id, timestamp: event.timestamp, type: legacyType, description: event.description ?? event.kind };
}

/** Normalize old saved cases into the structured event model without changing them. */
export function normalizeCaseClinicalEvents(events: ClinicalEvent[] | undefined, logs: LogEvent[] | undefined): ClinicalEvent[] {
  if (Array.isArray(events) && events.length > 0) {
    return [...events].sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp);
  }
  return (logs ?? []).slice().sort((a, b) => a.timestamp - b.timestamp).map((log, index) => ({
    id: log.id, timestamp: log.timestamp, sequence: index + 1,
    kind: log.type === 'DRUG_EPI' ? 'EPINEPHRINE' :
      log.type === 'DRUG_AMIO' ? 'AMIODARONE' :
      log.type === 'DRUG_LIDO' ? 'LIDOCAINE' :
      log.type === 'SHOCK' ? 'SHOCK' :
      log.type === 'ROSC' ? 'ROSC' :
      log.type === 'RHYTHM_CHECK' ? 'RHYTHM_CHECK' :
      log.type === 'ADVANCED_AIRWAY' ? 'PROCEDURE' :
      log.type === 'CPR_START' ? 'CPR_START' : 'INFO',
    source: 'import', payload: {}, description: log.description,
  }));
}