import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MedicalAudio } from './audio';

describe('MedicalAudio', () => {
  let mockContext: any;
  let mockOscillator: any;
  let mockGainNode: any;

  beforeEach(() => {
    // Reset MedicalAudio's internal context
    (MedicalAudio as any).context = null;

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

    mockContext = {
      state: 'running',
      currentTime: 100,
      destination: {},
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGainNode),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    // Setup window.AudioContext mock
    window.AudioContext = vi.fn().mockImplementation(function() {
      return mockContext;
    }) as any;

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (window as any).AudioContext;
  });

  it('should initialize AudioContext only once', () => {
    MedicalAudio.playAlert();
    MedicalAudio.playAlert();
    expect(window.AudioContext).toHaveBeenCalledTimes(1);
  });

  it('should resume AudioContext if suspended', () => {
    mockContext.state = 'suspended';
    MedicalAudio.playAlert();
    expect(mockContext.resume).toHaveBeenCalled();
  });

  it('should play alert tone correctly', () => {
    MedicalAudio.playAlert();

    expect(mockContext.createOscillator).toHaveBeenCalled();
    expect(mockContext.createGain).toHaveBeenCalled();

    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 100);
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.1, 100);
    expect(mockGainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 100 + 0.2);

    expect(mockOscillator.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockContext.destination);

    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalledWith(100 + 0.2);
  });

  it('should play cycle end tones correctly', () => {
    MedicalAudio.playCycleEnd();

    // First tone
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 100);
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);

    // Advance time for second tone
    vi.advanceTimersByTime(150);

    // Second tone
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenLastCalledWith(880, 100);
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
  });

  it('should play urgent tones correctly', () => {
    MedicalAudio.playUrgent();

    // First tone (C6)
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1046.50, 100);
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);

    // Advance time for second tone (E6)
    vi.advanceTimersByTime(100);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1318.51, 100);
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);

    // Advance time for third tone (G6)
    vi.advanceTimersByTime(100);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1567.98, 100);
    expect(mockOscillator.start).toHaveBeenCalledTimes(3);
  });

  it('should play metronome beat correctly', () => {
    MedicalAudio.playMetronomeBeat();

    expect(mockOscillator.type).toBe('square');
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1200, 100);
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.1, 100);
    expect(mockOscillator.stop).toHaveBeenCalledWith(100 + 0.05);
  });

  it('should play metronome tick correctly', () => {
    MedicalAudio.playMetronomeTick();

    expect(mockOscillator.type).toBe('sine'); // default type
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(440, 100);
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.05, 100);
    expect(mockOscillator.stop).toHaveBeenCalledWith(100 + 0.05);
  });
});
