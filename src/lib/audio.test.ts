// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { MedicalAudio } from './audio';

interface MockOscillatorNode {
  type: string;
  frequency: { setValueAtTime: Mock };
  connect: Mock;
  start: Mock;
  stop: Mock;
}

interface MockGainNode {
  gain: {
    setValueAtTime: Mock;
    exponentialRampToValueAtTime: Mock;
  };
  connect: Mock;
}

interface MockAudioContext {
  state: string;
  currentTime: number;
  destination: object;
  createOscillator: Mock;
  createGain: Mock;
  resume: Mock;
  suspend: Mock;
}

describe('MedicalAudio', () => {
  let mockAudioContext: MockAudioContext;
  let mockOscillator: MockOscillatorNode;
  let mockGainNode: MockGainNode;

  beforeEach(() => {
    vi.useFakeTimers();

    mockOscillator = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockGainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockAudioContext = {
      state: 'running',
      currentTime: 10,
      destination: {},
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGainNode),
      resume: vi.fn(),
      suspend: vi.fn(),
    };

    (MedicalAudio as unknown as { context: AudioContext | null }).context = null;
    (MedicalAudio as unknown as { activeTimeouts: Set<NodeJS.Timeout> }).activeTimeouts = new Set();

    if (typeof globalThis.window === 'undefined') {
      (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
    }

    const MockAudioContextClass = vi.fn(function (this: unknown) {
      return mockAudioContext;
    });

    (globalThis.window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown }).AudioContext = MockAudioContextClass;
    delete (globalThis.window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize AudioContext and resume if suspended', () => {
    mockAudioContext.state = 'suspended';
    MedicalAudio.playAlert();
    expect((globalThis.window as unknown as { AudioContext: Mock }).AudioContext).toHaveBeenCalled();
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  it('should play alert tone', () => {
    MedicalAudio.playAlert();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 10);
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.1, 10);
    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalledWith(10.2);
  });

  it('should play cycle end tone with double beeps', () => {
    MedicalAudio.playCycleEnd();
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenNthCalledWith(1, 880, 10);

    vi.advanceTimersByTime(150);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenNthCalledWith(2, 880, 10);
  });

  it('should play urgent tone sequence', () => {
    MedicalAudio.playUrgent();
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenNthCalledWith(1, 1046.50, 10);

    vi.advanceTimersByTime(100);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenNthCalledWith(2, 1318.51, 10);

    vi.advanceTimersByTime(100);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenNthCalledWith(3, 1567.98, 10);
  });

  it('should play metronome beat and tick', () => {
    MedicalAudio.playMetronomeBeat();
    expect(mockOscillator.type).toBe('square');
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 10);

    MedicalAudio.playMetronomeTick();
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(440, 10);
  });

  it('should stop all active timeouts and suspend context', () => {
    MedicalAudio.playCycleEnd();
    MedicalAudio.stopAll();
    expect(mockAudioContext.suspend).toHaveBeenCalled();
  });

  it('should fallback to webkitAudioContext if AudioContext is missing', () => {
    delete (globalThis.window as unknown as { AudioContext?: unknown }).AudioContext;
    const MockWebkitAudioContext = vi.fn(function (this: unknown) {
      return mockAudioContext;
    });
    (globalThis.window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = MockWebkitAudioContext;

    MedicalAudio.playAlert();
    expect((globalThis.window as unknown as { webkitAudioContext: Mock }).webkitAudioContext).toHaveBeenCalled();
  });

  it('should handle errors gracefully when createOscillator throws', () => {
    mockAudioContext.createOscillator.mockImplementationOnce(() => {
      throw new Error('AudioContext error');
    });

    expect(() => MedicalAudio.playAlert()).not.toThrow();
  });
});
