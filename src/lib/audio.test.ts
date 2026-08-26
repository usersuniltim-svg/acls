// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MedicalAudio } from './audio';

if (typeof window === 'undefined') {
  globalThis.window = globalThis as any;
}

describe('MedicalAudio.stopAll', () => {
  let mockSuspend: ReturnType<typeof vi.fn>;
  let mockResume: ReturnType<typeof vi.fn>;
  let mockAudioContextInstance: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset static context on MedicalAudio if previously initialized
    (MedicalAudio as any).context = null;
    (MedicalAudio as any).activeTimeouts = new Set();

    mockSuspend = vi.fn();
    mockResume = vi.fn();

    const mockOscillator = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockAudioContextInstance = {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: mockResume,
      suspend: mockSuspend,
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGainNode),
    };

    function MockAudioContext() {
      return mockAudioContextInstance;
    }

    window.AudioContext = MockAudioContext as any;
    delete window.webkitAudioContext;
  });

  afterEach(() => {
    MedicalAudio.stopAll();
    (MedicalAudio as any).context = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('handles calling stopAll when context is null without errors', () => {
    expect(() => MedicalAudio.stopAll()).not.toThrow();
  });

  it('suspends the active AudioContext when stopAll is called', () => {
    MedicalAudio.playAlert();
    expect(mockAudioContextInstance.suspend).not.toHaveBeenCalled();

    MedicalAudio.stopAll();
    expect(mockAudioContextInstance.suspend).toHaveBeenCalledTimes(1);
  });

  it('clears all active scheduled timeouts when stopAll is called', () => {
    MedicalAudio.playCycleEnd();
    MedicalAudio.playUrgent();

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    MedicalAudio.stopAll();

    vi.advanceTimersByTime(1000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not attempt to suspend when AudioContext state is closed', () => {
    MedicalAudio.playAlert();
    mockAudioContextInstance.state = 'closed';

    MedicalAudio.stopAll();
    expect(mockSuspend).not.toHaveBeenCalled();
  });

  it('catches and handles exceptions thrown by AudioContext.suspend() gracefully', () => {
    MedicalAudio.playAlert();
    mockSuspend.mockImplementation(() => {
      throw new Error('AudioContext suspend failed');
    });

    expect(() => MedicalAudio.stopAll()).not.toThrow();
    expect(mockSuspend).toHaveBeenCalledTimes(1);
  });

  it('can be called multiple times consecutively safely', () => {
    MedicalAudio.playAlert();
    expect(() => {
      MedicalAudio.stopAll();
      MedicalAudio.stopAll();
    }).not.toThrow();
  });
});
