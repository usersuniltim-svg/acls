import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/acls_state.dart';
import '../constants/acls_constants.dart';
import '../services/medical_audio.dart';

class AclsStateManager extends ChangeNotifier {
  late AclsState _state;
  Timer? _ticker;
  Timer? _metronomeTicker;
  bool _soundEnabled = true;
  UserProfile? _userProfile;

  AclsStateManager() {
    _userProfile = UserProfile.guest();
    _resetToInitialState();
  }

  AclsState get state => _state;
  UserProfile? get userProfile => _userProfile;
  bool get soundEnabled => _soundEnabled;

  void setUserProfile(UserProfile profile) {
    _userProfile = profile;
    notifyListeners();
  }

  void toggleSound() {
    _soundEnabled = !_soundEnabled;
    MedicalAudio.setSoundEnabled(_soundEnabled);
    notifyListeners();
  }

  void _resetToInitialState() {
    _state = AclsState(
      isTimerRunning: false,
      cprTimeLeft: AclsConstants.cprCycleDuration,
      epiTimeLeft: AclsConstants.epiInterval,
      totalTime: 0,
      shocksCount: 0,
      epiCount: 0,
      currentRhythm: PatientRhythm.unknown,
      cprCycleCount: 0,
      logs: [
        LogEvent(
          id: '${DateTime.now().millisecondsSinceEpoch}-init',
          timestamp: DateTime.now(),
          type: EventType.info,
          description: "System Initialized - Ready for ACLS protocol",
        )
      ],
      showHsAndTs: false,
      activePrompt: null,
      rhythmCheckTimeLeft: 0,
      defibType: "BIPHASIC",
      selectedEnergy: 200,
      epiDueElapsed: 0,
    );
    notifyListeners();
  }

  void resetSession() {
    _ticker?.cancel();
    _metronomeTicker?.cancel();
    _resetToInitialState();
    addLog(EventType.info, "ACLS Session reset by clinician.");
  }

  void addLog(EventType type, String description) {
    final newLog = LogEvent(
      id: '${DateTime.now().millisecondsSinceEpoch}-${_state.logs.length}',
      timestamp: DateTime.now(),
      type: type,
      description: description,
    );
    _state = _state.copyWith(
      logs: [newLog, ..._state.logs],
    );
    notifyListeners();
  }

  void startCPR() {
    _ticker?.cancel();
    _metronomeTicker?.cancel();

    _state = _state.copyWith(
      isTimerRunning: false,
      cprCycleCount: 0,
      activePrompt: ActivePrompt.rhythmCheck,
      rhythmCheckTimeLeft: 10,
      totalTime: 0,
      cprTimeLeft: AclsConstants.cprCycleDuration,
      epiTimeLeft: AclsConstants.epiInterval,
      epiDueElapsed: 0,
    );

    addLog(EventType.cprStart, "Resuscitation started - Initial 10s Rhythm Evaluation started.");
    _startTimers();
  }

  void togglePause() {
    if (_state.isTimerRunning) {
      _state = _state.copyWith(isTimerRunning: false);
      addLog(EventType.info, "Protocol timers suspended.");
    } else {
      _state = _state.copyWith(isTimerRunning: true);
      addLog(EventType.info, "Protocol timers resumed.");
    }
    notifyListeners();
  }

  void recordRosc() {
    _ticker?.cancel();
    _metronomeTicker?.cancel();
    _state = _state.copyWith(
      isTimerRunning: false,
      activePrompt: null,
      removeActivePrompt: true,
    );
    addLog(EventType.rosc, "🎉 ROSC ACHIEVED! Post-Cardiac Arrest Care initiated.");
  }

  void setDefibParameters(String type, int energy) {
    _state = _state.copyWith(
      defibType: type,
      selectedEnergy: energy,
    );
    notifyListeners();
  }

  void toggleHsAndTs() {
    _state = _state.copyWith(showHsAndTs: !_state.showHsAndTs);
    notifyListeners();
  }

  void shockPatient() {
    final nextShocks = _state.shocksCount + 1;
    _state = _state.copyWith(
      shocksCount: nextShocks,
      cprTimeLeft: AclsConstants.cprCycleDuration,
      activePrompt: null,
      removeActivePrompt: true,
      rhythmCheckTimeLeft: 0,
      isTimerRunning: true,
    );
    addLog(
      EventType.shock,
      "⚡ SHOCK DELIVERED (#${nextShocks} at ${_state.selectedEnergy}J (${_state.defibType})). CPR resumed immediately.",
    );
  }

  void pushEpinephrine() {
    _state = _state.copyWith(
      epiCount: _state.epiCount + 1,
      epiTimeLeft: AclsConstants.epiInterval,
      activePrompt: _state.activePrompt == ActivePrompt.epiDue ? null : _state.activePrompt,
      removeActivePrompt: _state.activePrompt == ActivePrompt.epiDue,
      epiDueElapsed: 0,
    );
    addLog(
      EventType.drugEpi,
      "💉 Epinephrine 1mg IV/IO administered (Dose #${_state.epiCount}). Next dose active countdown loaded.",
    );
  }

  void pushAmiodarone(String dosage) {
    _state = _state.copyWith();
    addLog(EventType.drugAmio, "💉 Amiodarone $dosage IV/IO administered.");
  }

  void pushLidocaine(String dosage) {
    _state = _state.copyWith();
    addLog(EventType.drugLido, "💉 Lidocaine $dosage IV/IO administered.");
  }

  void setRhythmDecision(PatientRhythm rhythm) {
    _state = _state.copyWith(currentRhythm: rhythm);
    
    if (rhythm == PatientRhythm.shockable) {
      _state = _state.copyWith(activePrompt: ActivePrompt.shockAdvised);
      addLog(EventType.rhythmCheck, "Evaluation: Shockable Rhythm (VF/pVT) detected. Defibrillator charge recommended.");
    } else if (rhythm == PatientRhythm.nonShockable) {
      _state = _state.copyWith(
        activePrompt: ActivePrompt.epiAdvised,
        cprTimeLeft: AclsConstants.cprCycleDuration,
        isTimerRunning: true,
        rhythmCheckTimeLeft: 0,
      );
      addLog(EventType.rhythmCheck, "Evaluation: Non-Shockable Rhythm (Asystole/PEA) detected. Resuming 2m CPR cycle.");
    } else {
      _state = _state.copyWith(
        activePrompt: null,
        removeActivePrompt: true,
        cprTimeLeft: AclsConstants.cprCycleDuration,
        isTimerRunning: true,
        rhythmCheckTimeLeft: 0,
      );
      addLog(EventType.rhythmCheck, "Evaluation: Undetermined Rhythm. Resuming CPR.");
    }
  }

  void completeRhythmAdvised(bool actionTaken) {
    _state = _state.copyWith(
      activePrompt: null,
      removeActivePrompt: true,
      cprTimeLeft: AclsConstants.cprCycleDuration,
      isTimerRunning: true,
    );
    if (!actionTaken) {
      addLog(EventType.info, "Rhythm suggestion checked. CPR Cycle resumed.");
    }
  }

  void _startTimers() {
    // 1-second system ticker
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      _onTick();
    });

    // 110 BPM Metronome Ticker (~545ms interval)
    const metronomeDuration = Duration(milliseconds: 545);
    _metronomeTicker = Timer.periodic(metronomeDuration, (timer) {
      final running = _state.isTimerRunning;
      final assessment = _state.activePrompt == ActivePrompt.rhythmCheck;
      // Metronome runs normal CPR cycles + Epinephrine Alerts, but pauses during rhythm check assessment
      if (running && !assessment) {
        MedicalAudio.playMetronomeBeat();
      }
    });
  }

  void _onTick() {
    bool nextIsRunning = _state.isTimerRunning;
    int nextTotal = _state.totalTime;
    int nextCpr = _state.cprTimeLeft;
    int nextEpi = _state.epiTimeLeft;
    int nextRhythmTimeLeft = _state.rhythmCheckTimeLeft;
    ActivePrompt? nextPrompt = _state.activePrompt;
    int nextEpiDueElapsed = _state.epiDueElapsed;

    // Check rhythm check countdown
    final isEvaluatingRhythm = nextPrompt == ActivePrompt.rhythmCheck;
    if (isEvaluatingRhythm && nextRhythmTimeLeft > 0) {
      nextRhythmTimeLeft -= 1;
      nextTotal += 1;

      if (nextRhythmTimeLeft == 0) {
        MedicalAudio.playCycleEnd();
        addLog(EventType.rhythmCheck, "10-second rhythm assessment expired. Direct rhythm select required.");
      }
    } else if (isEvaluatingRhythm && nextRhythmTimeLeft == 0) {
      // Exceeded rhythm evaluation threshold -> play alerts
      nextTotal += 1;
      MedicalAudio.playUrgent();
    } else if (nextIsRunning) {
      nextTotal += 1;

      // CPR Cycle Ticker: Metronome and CPR timer do NOT stop for EPI alert prompt!
      if (nextCpr > 0 && (nextPrompt == null || nextPrompt == ActivePrompt.epiDue)) {
        nextCpr -= 1;
        if (nextCpr == 0) {
          nextIsRunning = false;
          nextPrompt = ActivePrompt.rhythmCheck;
          nextRhythmTimeLeft = 10;
          MedicalAudio.playCycleEnd();
          addLog(EventType.rhythmCheck, "2-minute CPR cycle completed. Pause for Rhythm Evaluation!");
        }
      }

      // Epinephrine ticker
      if (nextEpi > 0) {
        nextEpi -= 1;
        if (nextEpi == 0) {
          nextPrompt = ActivePrompt.epiDue;
          nextEpiDueElapsed = 0;
          MedicalAudio.playAlert();
        }
      }

      // If Epinephrine due is showing, tick every 7 seconds for sound reminders
      if (nextPrompt == ActivePrompt.epiDue) {
        nextEpiDueElapsed += 1;
        if (nextEpiDueElapsed > 0 && nextEpiDueElapsed % 7 == 0) {
          MedicalAudio.playAlert();
          addLog(EventType.info, "Reminder Alert: Push 1mg Epinephrine IV/IO now!");
        }
      } else {
        nextEpiDueElapsed = 0;
      }
    }

    _state = _state.copyWith(
      isTimerRunning: nextIsRunning,
      totalTime: nextTotal,
      cprTimeLeft: nextCpr,
      epiTimeLeft: nextEpi,
      rhythmCheckTimeLeft: nextRhythmTimeLeft,
      activePrompt: nextPrompt,
      epiDueElapsed: nextEpiDueElapsed,
      removeActivePrompt: nextPrompt == null,
    );
    notifyListeners();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _metronomeTicker?.cancel();
    super.dispose();
  }
}
