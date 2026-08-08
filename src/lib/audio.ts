
export class MedicalAudio {
  private static context: AudioContext | null = null;
  private static activeTimeouts: Set<NodeJS.Timeout> = new Set();

  private static init() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  public static stopAll() {
    this.activeTimeouts.forEach(t => clearTimeout(t));
    this.activeTimeouts.clear();
    if (this.context && this.context.state !== 'closed') {
      try {
        this.context.suspend();
      } catch (e) {
        // Safe catch
      }
    }
  }

  private static playTone(frequency: number, duration: number, volume: number = 0.1, type: OscillatorType = 'sine') {
    this.init();
    if (!this.context || this.context.state === 'suspended') return;

    try {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);

      gainNode.gain.setValueAtTime(volume, this.context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      oscillator.start();
      oscillator.stop(this.context.currentTime + duration);
    } catch (e) {
      // AudioContext could be closed or suspended
    }
  }

  static playAlert() {
    // Single high pitch beep
    this.playTone(880, 0.2);
  }

  static playCycleEnd() {
    // Double beep
    this.playTone(880, 0.1);
    const t = setTimeout(() => {
      this.playTone(880, 0.1);
      this.activeTimeouts.delete(t);
    }, 150);
    this.activeTimeouts.add(t);
  }

  static playUrgent() {
    // Multi-tone urgent alert
    this.playTone(1046.50, 0.1); // C6
    const t1 = setTimeout(() => {
      this.playTone(1318.51, 0.1); // E6
      this.activeTimeouts.delete(t1);
    }, 100);
    this.activeTimeouts.add(t1);

    const t2 = setTimeout(() => {
      this.playTone(1567.98, 0.2); // G6
      this.activeTimeouts.delete(t2);
    }, 200);
    this.activeTimeouts.add(t2);
  }

  static playMetronomeBeat() {
    // Sharp click for metronome
    this.playTone(1200, 0.05, 0.1, 'square');
  }

  static playMetronomeTick() {
    // Soft tick for state changes or secondary events
    this.playTone(440, 0.05, 0.05);
  }
}
