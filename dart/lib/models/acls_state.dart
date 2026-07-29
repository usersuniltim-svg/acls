enum EventType {
  cprStart,
  shock,
  drugEpi,
  drugAmio,
  drugLido,
  rosc,
  rhythmCheck,
  advancedAirway,
  info,
}

enum PatientRhythm {
  shockable,
  nonShockable,
  unknown,
}

enum ActivePrompt {
  rhythmCheck,
  shockAdvised,
  epiAdvised,
  epiDue,
}

enum Profession {
  doctor,
  nurse,
  paramedics,
}

enum Sex {
  male,
  female,
  other,
}

class LogEvent {
  final String id;
  final DateTime timestamp;
  final EventType type;
  final String description;

  LogEvent({
    required this.id,
    required this.timestamp,
    required this.type,
    required this.description,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'timestamp': timestamp.millisecondsSinceEpoch,
        'type': type.name,
        'description': description,
      };

  factory LogEvent.fromJson(Map<String, dynamic> json) => LogEvent(
        id: json['id'] as String,
        timestamp: DateTime.fromMillisecondsSinceEpoch(json['timestamp'] as int),
        type: EventType.values.byName(json['type'] as String),
        description: json['description'] as String,
      );
}

class UserProfile {
  final String fullName;
  final Profession profession;
  final String highestDegree;
  final String dob;
  final Sex sex;
  final String councilRegistration;
  final String email;
  final String phone;
  final DateTime onboardedAt;

  UserProfile({
    required this.fullName,
    required this.profession,
    required this.highestDegree,
    required this.dob,
    required this.sex,
    required this.councilRegistration,
    required this.email,
    required this.phone,
    required this.onboardedAt,
  });

  factory UserProfile.guest() {
    return UserProfile(
      fullName: "Guest Practitioner",
      profession: Profession.doctor,
      highestDegree: "MD / Specialist",
      dob: "1990-01-01",
      sex: Sex.other,
      councilRegistration: "GUEST-KMC-003",
      email: "guest@resuscitation.org",
      phone: "9800000000",
      onboardedAt: DateTime.now(),
    );
  }
}

class AclsState {
  final bool isTimerRunning;
  final int cprTimeLeft;
  final int epiTimeLeft;
  final int totalTime;
  final int shocksCount;
  final int epiCount;
  final PatientRhythm currentRhythm;
  final int cprCycleCount;
  final List<LogEvent> logs;
  final bool showHsAndTs;
  final ActivePrompt? activePrompt;
  final int rhythmCheckTimeLeft;
  final String defibType; // 'BIPHASIC' or 'MONOPHASIC'
  final int selectedEnergy;
  final int epiDueElapsed;
  final bool hasAdvancedAirway;

  AclsState({
    required this.isTimerRunning,
    required this.cprTimeLeft,
    required this.epiTimeLeft,
    required this.totalTime,
    required this.shocksCount,
    required this.epiCount,
    required this.currentRhythm,
    required this.cprCycleCount,
    required this.logs,
    required this.showHsAndTs,
    this.activePrompt,
    required this.rhythmCheckTimeLeft,
    required this.defibType,
    required this.selectedEnergy,
    required this.epiDueElapsed,
    required this.hasAdvancedAirway,
  });

  AclsState copyWith({
    bool? isTimerRunning,
    int? cprTimeLeft,
    int? epiTimeLeft,
    int? totalTime,
    int? shocksCount,
    int? epiCount,
    PatientRhythm? currentRhythm,
    int? cprCycleCount,
    List<LogEvent>? logs,
    bool? showHsAndTs,
    ActivePrompt? activePrompt,
    int? rhythmCheckTimeLeft,
    String? defibType,
    int? selectedEnergy,
    int? epiDueElapsed,
    bool? hasAdvancedAirway,
    bool removeActivePrompt = false,
  }) {
    return AclsState(
      isTimerRunning: isTimerRunning ?? this.isTimerRunning,
      cprTimeLeft: cprTimeLeft ?? this.cprTimeLeft,
      epiTimeLeft: epiTimeLeft ?? this.epiTimeLeft,
      totalTime: totalTime ?? this.totalTime,
      shocksCount: shocksCount ?? this.shocksCount,
      epiCount: epiCount ?? this.epiCount,
      currentRhythm: currentRhythm ?? this.currentRhythm,
      cprCycleCount: cprCycleCount ?? this.cprCycleCount,
      logs: logs ?? this.logs,
      showHsAndTs: showHsAndTs ?? this.showHsAndTs,
      activePrompt: removeActivePrompt ? null : (activePrompt ?? this.activePrompt),
      rhythmCheckTimeLeft: rhythmCheckTimeLeft ?? this.rhythmCheckTimeLeft,
      defibType: defibType ?? this.defibType,
      selectedEnergy: selectedEnergy ?? this.selectedEnergy,
      epiDueElapsed: epiDueElapsed ?? this.epiDueElapsed,
      hasAdvancedAirway: hasAdvancedAirway ?? this.hasAdvancedAirway,
    );
  }
}
