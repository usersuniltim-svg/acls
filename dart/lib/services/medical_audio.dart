import 'package:audioplayers/audioplayers.dart';

class MedicalAudio {
  static final AudioPlayer _player = AudioPlayer()..setReleaseMode(ReleaseMode.release);
  static bool soundEnabled = true;

  static void setSoundEnabled(bool enabled) {
    soundEnabled = enabled;
  }

  static Future<void> playMetronomeBeat() async {
    if (!soundEnabled) return;
    try {
      // If deployed in production, play the asset file
      await _player.play(AssetSource('audio/metronome.mp3'), volume: 0.3);
    } catch (_) {
      // Offline fallback
      print("🔊 Metronome Tick beat... (110 BPM)");
    }
  }

  static Future<void> playAlert() async {
    if (!soundEnabled) return;
    try {
      await _player.play(AssetSource('audio/alert.mp3'), volume: 0.8);
    } catch (_) {
      print("🔊 Alarms Alert: epinephrine drug notification active!");
    }
  }

  static Future<void> playCycleEnd() async {
    if (!soundEnabled) return;
    try {
      await _player.play(AssetSource('audio/cycle_end.mp3'), volume: 0.8);
    } catch (_) {
      print("🔊 CPR Cycle Complete! Evaluate pulse.");
    }
  }

  static Future<void> playUrgent() async {
    if (!soundEnabled) return;
    try {
      await _player.play(AssetSource('audio/urgent.mp3'), volume: 0.9);
    } catch (_) {
      print("🔊 WARNING: Rhythm evaluation pause exceeded 10 seconds!");
    }
  }
}
