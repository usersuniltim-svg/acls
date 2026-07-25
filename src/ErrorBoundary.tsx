import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// @ts-ignore
export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error Boundary catch:", error, errorInfo);
  }

  render() {
    if ((this.state as State).hasError) {
      return (
        <div className="min-h-screen bg-[#050B16] text-[#E2E8F0] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full glass-panel p-8 space-y-6 border-red-500/20 bg-slate-900/90 shadow-2xl rounded-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500 border border-red-500/30">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">Application Initialization Notice</h2>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                {(this.state as State).error?.message || "An unexpected rendering event occurred."}
              </p>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border-none shadow-lg shadow-blue-500/20"
            >
              <RotateCcw className="w-4 h-4" /> Reload Resuscitation Suite
            </button>
          </div>
        </div>
      );
    }

    return (this.props as Props).children;
  }
}
