import { ClinicalEvent, ClinicalEventInput, ClinicalEventPayloadMap, LogEvent } from '../types';

/** Creates an append-only structured event. */
export function createClinicalEvent<K extends ClinicalEvent['kind']>(input: ClinicalEventInput<K>, sequence: number): Extract<ClinicalEvent, { kind: K }> {
  const event = {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    timestamp: input.timestamp ?? Date.now(),
    sequence,
    kind: input.kind,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.actorName ? { actorName: input.actorName } : {}),
    source: input.source ?? 'user',
    payload: (input.payload ?? {}) as ClinicalEventPayloadMap[K],
    ...(input.description ? { description: input.description } : {}),
  };
  return event as unknown as Extract<ClinicalEvent, { kind: K }>;
}

/** Convert a structured event to the legacy log shape used by older PDFs/cases. */
export function clinicalEventToLegacyLog(event: ClinicalEvent): LogEvent {
  const legacyType: LogEvent['type'] =
    event.kind === 'EPINEPHRINE' ? 'DRUG_EPI' :
    event.kind === 'AMIODARONE' ? 'DRUG_AMIO' :
    event.kind === 'LIDOCAINE' ? 'DRUG_LIDO' :
    event.kind === 'CODE_START' || event.kind === 'CPR_START' || event.kind === 'CPR_RESUME' || event.kind === 'RE_ARREST' ? 'CPR_START' :
    event.kind === 'PROCEDURE' || event.kind === 'AIRWAY' ? 'ADVANCED_AIRWAY' :
    event.kind === 'SHOCK' ? 'SHOCK' :
    event.kind === 'ROSC' ? 'ROSC' :
    event.kind === 'RHYTHM_CHECK' ? 'RHYTHM_CHECK' :
    // CPR_PAUSE, CODE_END, reversible causes, post-ROSC items, vitals,
    // disposition and anything newer have no legacy type of their own.
    'INFO';
  return { id: event.id, timestamp: event.timestamp, type: legacyType, description: event.description ?? event.kind };
}

/**
 * Normalize old saved cases into the structured event model without changing their
 * timestamps/order. Legacy logs cannot reconstruct every clinical payload, so
 * imported payloads intentionally use explicit safe defaults rather than {}.
 */
export function normalizeCaseClinicalEvents(events: ClinicalEvent[] | undefined, logs: LogEvent[] | undefined): ClinicalEvent[] {
  if (Array.isArray(events) && events.length > 0) {
    return [...events].sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp);
  }

  return (logs ?? [])
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log, index): ClinicalEvent => {
      const base = {
        id: log.id,
        timestamp: log.timestamp,
        sequence: index + 1,
        source: 'import' as const,
        description: log.description,
      };

      switch (log.type) {
        case 'DRUG_EPI':
          return { ...base, kind: 'EPINEPHRINE', payload: { route: 'IV/IO', doseNumber: 0 } };
        case 'DRUG_AMIO':
          return { ...base, kind: 'AMIODARONE', payload: { route: 'IV/IO', doseNumber: 0 } };
        case 'DRUG_LIDO':
          return { ...base, kind: 'LIDOCAINE', payload: { route: 'IV/IO', doseNumber: 0 } };
        case 'SHOCK':
          return {
            ...base,
            kind: 'SHOCK',
            payload: { energyJ: 0, defibType: 'BIPHASIC', shockNumber: 0 },
          };
        case 'ROSC':
          return { ...base, kind: 'ROSC', payload: { arrestDurationSeconds: 0 } };
        case 'RHYTHM_CHECK':
          return {
            ...base,
            kind: 'RHYTHM_CHECK',
            payload: { checkNumber: index + 1, rhythm: 'UNKNOWN' },
          };
        case 'ADVANCED_AIRWAY':
          return { ...base, kind: 'PROCEDURE', payload: {} };
        case 'CPR_START':
          return { ...base, kind: 'CPR_START', payload: {} };
        case 'INFO':
        default:
          return { ...base, kind: 'INFO', payload: {} };
      }
    });
}
