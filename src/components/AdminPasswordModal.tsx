import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldCheck, X, AlertCircle, KeyRound } from 'lucide-react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminPasswordModal({ isOpen, onClose, onSuccess }: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'abc123') {
      setError('');
      setPassword('');
      onSuccess();
      onClose();
    } else {
      setError('Incorrect admin password. Access denied by Nepal Medical Board.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-sm p-6 bg-white border border-gray-300 rounded-2xl space-y-4 text-left relative shadow-2xl text-black"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-black p-1 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
            <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl text-red-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-black uppercase tracking-wider">Medical Board Admin Portal</h3>
              <p className="text-[9px] text-red-600 font-mono uppercase font-bold">Protected Council Area</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-black mb-1.5 tracking-wider">
                Enter Secret Admin Access Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Password required"
                  autoFocus
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-600 font-mono font-medium"
                />
                <KeyRound className="w-4 h-4 absolute right-3 top-3 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-700 text-[10px] font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-black border border-gray-300 rounded-xl text-[10px] font-bold uppercase tracking-wider border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shadow border-none cursor-pointer"
              >
                Authenticate
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
