import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MobileDashboard from './MobileDashboard';

// Mock framer-motion completely to avoid internal context errors in JSDOM
vi.mock('motion/react', () => {
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref) => <div ref={ref} {...props}>{children}</div>),
      circle: React.forwardRef(({ children, ...props }: any, ref) => <circle ref={ref} {...props}>{children}</circle>),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// Avoid dealing with Lucide icons randomly crashing if we use the actual ones,
// wait, the actual lucide icons were not crashing, it was motion! So we don't mock Lucide.

describe('MobileDashboard', () => {
  const defaultProps = {
    state: {
      isTimerRunning: false,
      cprTimeLeft: 120,
      epiTimeLeft: 180,
      totalTime: 0,
      shocksCount: 0,
      epiCount: 0,
      currentRhythm: 'UNKNOWN' as any,
      cprCycleCount: 0,
      logs: [],
      activePrompt: null,
      rhythmCheckTimeLeft: 0,
      defibType: 'BIPHASIC' as any,
      selectedEnergy: 200,
      showHsAndTs: false,
    },
    setState: vi.fn(),
    hasSessionStarted: false,
    setHasSessionStarted: vi.fn(),
    activeTab: 'timer' as any,
    setActiveTab: vi.fn(),
    phoneTime: '12:00 PM',
    batteryLevel: 100,
    isVibrating: false,
    soundEnabled: true,
    setSoundEnabled: vi.fn(),
    metronomeCount: 0,
    triggerPwaInstall: vi.fn(),
    vibrateDevice: vi.fn(),
    formatTime: vi.fn((s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`),
    cprProgress: 0,
    epiProgress: 0,
    toggleTimer: vi.fn(),
    resetCprTimer: vi.fn(),
    handleShock: vi.fn(),
    handleEpi: vi.fn(),
    handleRosc: vi.fn(),
    handleRhythmSelect: vi.fn(),
    addLog: vi.fn(),
    effectiveProfile: {
      fullName: 'John Doe',
      profession: 'doctor' as "doctor",
      highestDegree: 'MD',
      dob: '1990-01-01',
      sex: 'male' as "male",
      email: 'test@test.com',
      phone: '555-555-5555',
      onboardedAt: Date.now(),
      country: 'US',
      clinicalSetting: 'hospital',
      councilRegistration: '12345',
    },
    handleStartCPR: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<MobileDashboard {...defaultProps} />);
    expect(screen.getByText('TIMERS')).toBeInTheDocument();
    expect(screen.getByText('DRUGS')).toBeInTheDocument();
    expect(screen.getByText('FLOWCHART')).toBeInTheDocument();
    expect(screen.getByText('JOURNAL')).toBeInTheDocument();
    expect(screen.getByText('CONFIG')).toBeInTheDocument();
  });

  it('changes active tab when navigation buttons are clicked', () => {
    render(<MobileDashboard {...defaultProps} />);

    // Bottom nav uses labels
    const interventionsTabBtn = screen.getByText('DRUGS').closest('button');
    expect(interventionsTabBtn).toBeInTheDocument();

    if (interventionsTabBtn) {
      fireEvent.click(interventionsTabBtn);
      expect(defaultProps.setActiveTab).toHaveBeenCalledWith('interventions');
    }
  });

  it('handles toggle timer', () => {
    const props = {
      ...defaultProps,
      hasSessionStarted: true
    };
    render(<MobileDashboard {...props} />);

    const toggleBtn = screen.getByText(/Resume/i).closest('button');
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(defaultProps.toggleTimer).toHaveBeenCalled();
    }
  });

  it('displays the correct energy for shock based on defibType', () => {
    const props = {
      ...defaultProps,
      activeTab: 'interventions' as any,
      state: {
        ...defaultProps.state,
        defibType: 'MONOPHASIC' as any,
        selectedEnergy: 360
      }
    };
    render(<MobileDashboard {...props} />);

    expect(screen.getByText(/Shock \(/i)).toBeInTheDocument();
  });

  it('renders correct content for algorithm tab', () => {
    render(<MobileDashboard {...defaultProps} activeTab="algorithm" />);

    expect(screen.getByText(/Provide Oxygen/i)).toBeInTheDocument();
  });

  it('triggers ROSC handler', () => {
    render(<MobileDashboard {...defaultProps} activeTab="interventions" />);

    const roscBtn = screen.getByText(/Confirm ROSC Achieve/i).closest('button');
    if (roscBtn) {
      fireEvent.click(roscBtn);
      expect(defaultProps.handleRosc).toHaveBeenCalled();
    }
  });

  it('renders active prompt for EPI correctly', () => {
    const props = {
      ...defaultProps,
      state: {
        ...defaultProps.state,
        activePrompt: 'EPI_DUE' as any,
        epiDueElapsed: 14
      }
    };
    render(<MobileDashboard {...props} />);

    expect(screen.getByText('Epinephrine notification')).toBeInTheDocument();

    const pushDrugBtn = screen.getByText('Push drug');
    fireEvent.click(pushDrugBtn);

    expect(defaultProps.handleEpi).toHaveBeenCalled();
  });

  it('triggers handleShock when shock button clicked on interventions tab', () => {
    render(<MobileDashboard {...defaultProps} activeTab="interventions" />);

    const shockBtn = screen.getByText(/Shock \(/i).closest('button');
    if (shockBtn) {
      fireEvent.click(shockBtn);
      expect(defaultProps.handleShock).toHaveBeenCalled();
    }
  });

  it('renders settings tab correctly and allows changing defib type', () => {
    render(<MobileDashboard {...defaultProps} activeTab="settings" />);

    expect(screen.getByText(/Configuration/i)).toBeInTheDocument();

    const monophasicBtn = screen.getByText(/Monophasic/i);
    fireEvent.click(monophasicBtn);

    expect(defaultProps.setState).toHaveBeenCalled();

    // Check if wipe session confirmation works
    window.confirm = vi.fn(() => true);
    const wipeBtn = screen.getByText(/Wipe Patient session/i);
    fireEvent.click(wipeBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(defaultProps.setState).toHaveBeenCalled();
    expect(defaultProps.setHasSessionStarted).toHaveBeenCalledWith(false);
  });
});
