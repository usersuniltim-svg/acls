declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}


export class MedicalAudio {
  private static context: AudioContext | null = null;

  private static init() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  private static playTone(frequency: number, duration: number, volume: number = 0.1, type: OscillatorType = 'sine') {
    this.init();
    if (!this.context) return;

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
  }

  static playAlert() {
    // Single high pitch beep
    this.playTone(880, 0.2);
  }

  static playCycleEnd() {
    // Double beep
    this.playTone(880, 0.1);
    setTimeout(() => this.playTone(880, 0.1), 150);
  }

  static playUrgent() {
    // Multi-tone urgent alert
    this.playTone(1046.50, 0.1); // C6
    setTimeout(() => this.playTone(1318.51, 0.1), 100); // E6
    setTimeout(() => this.playTone(1567.98, 0.2), 200); // G6
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
