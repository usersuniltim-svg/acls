import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn, UserPlus, Mail, Lock, User, Stethoscope, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        const profRef = doc(db, 'profiles', res.user.uid);
        const existingSnap = await getDoc(profRef);
        if (!existingSnap.exists()) {
          const initialKyc = {
            kycStatus: 'unsubmitted' as const,
            councilRegistration: '',
            degree: 'MBBS',
            specialty: '',
            institution: '',
          };
          await setDoc(profRef, {
            fullName: res.user.displayName || 'Practitioner',
            email: res.user.email || '',
            profession: 'doctor',
            highestDegree: 'MBBS',
            councilRegistration: '',
            dob: '1990-01-01',
            sex: 'male',
            phone: '',
            onboardedAt: Date.now(),
            kyc: initialKyc,
          });
        } else {
          // Just update basic details without overwriting KYC status
          await setDoc(profRef, {
            email: res.user.email || '',
            fullName: res.user.displayName || existingSnap.data()?.fullName || 'Practitioner',
          }, { merge: true });
        }
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Google Sign-In failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      if (isResetMode) {
        await sendPasswordResetEmail(auth, email);
        setMessage("Password reset link sent to your email.");
        setIsResetMode(false);
        setIsLoading(false);
        return;
      }

      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName.trim()) {
          await updateProfile(userCred.user, { displayName: fullName.trim() });
        }
        const profRef = doc(db, 'profiles', userCred.user.uid);
        const initialKyc = {
          kycStatus: 'unsubmitted' as const,
          councilRegistration: '',
          degree: 'MBBS',
          specialty: '',
          institution: '',
        };
        await setDoc(profRef, {
          fullName: fullName.trim() || 'Practitioner',
          email: userCred.user.email || email,
          profession: 'doctor',
          highestDegree: 'MBBS',
          councilRegistration: '',
          dob: '1990-01-01',
          sex: 'male',
          phone: '',
          onboardedAt: Date.now(),
          kyc: initialKyc,
        }, { merge: true });

        setMessage("Account created successfully!");
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (userCred.user) {
          const profRef = doc(db, 'profiles', userCred.user.uid);
          const existingSnap = await getDoc(profRef);
          if (!existingSnap.exists()) {
            const initialKyc = {
              kycStatus: 'unsubmitted' as const,
              councilRegistration: '',
              degree: 'MBBS',
              specialty: '',
              institution: '',
            };
            await setDoc(profRef, {
              fullName: userCred.user.displayName || email.split('@')[0] || 'Practitioner',
              email: userCred.user.email || email,
              profession: 'doctor',
              highestDegree: 'MBBS',
              councilRegistration: '',
              dob: '1990-01-01',
              sex: 'male',
              phone: '',
              onboardedAt: Date.now(),
              kyc: initialKyc,
            });
          } else {
            await setDoc(profRef, {
              email: userCred.user.email || email,
            }, { merge: true });
          }
        }
        setMessage("Signed in successfully!");
      }

      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 500);

    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Invalid email or password.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Email is already registered. Please sign in instead.");
      } else {
        setError(err.message || "Authentication failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-white border border-gray-300 rounded-2xl shadow-2xl p-6 text-black my-8"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-600 hover:text-black rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer border-none"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="text-center mb-6 space-y-2">
            <div className="w-12 h-12 bg-red-100 border border-red-300 rounded-xl flex items-center justify-center text-red-600 mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-display font-bold tracking-tight text-black uppercase">
              {isResetMode ? 'Reset Password' : isSignUp ? 'Practitioner Registration' : 'ACLS Sign In'}
            </h2>
            <p className="text-gray-600 text-xs font-medium">
              {isResetMode 
                ? 'Enter your registered email to receive a password reset link.'
                : isSignUp 
                ? 'Register your clinical credentials for medical log sync.' 
                : 'Sign in to access resuscitation logs and verified doctor features.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-100 border border-red-300 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 rounded-xl bg-red-100 border border-red-300 text-black text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-red-600" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isSignUp && !isResetMode && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">Full Legal Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      required
                      type="text"
                      placeholder="Dr. Sunil Timilsina"
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  required
                  type="email"
                  placeholder="doctor@hospital.org"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {!isResetMode && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-black uppercase tracking-wider">Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setIsResetMode(true)}
                      className="text-[10px] text-red-600 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-black focus:outline-none focus:ring-2 focus:ring-red-600"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border-none shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : isResetMode ? (
                'Send Reset Email'
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" /> Create Practitioner Account
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Sign In
                </>
              )}
            </button>
          </form>

          {/* Social login divider */}
          {!isResetMode && (
            <div className="mt-5 space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-gray-200 w-full" />
                <span className="bg-white px-3 text-[10px] uppercase font-bold text-gray-500 absolute">Or continue with</span>
              </div>

              <button
                onClick={handleGoogleSignIn}
                type="button"
                disabled={isLoading}
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white border-none rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Google Medical Auth
              </button>
            </div>
          )}

          {/* Toggle mode */}
          <div className="mt-5 text-center pt-3 border-t border-gray-200">
            <button
              onClick={() => {
                setError(null);
                setMessage(null);
                if (isResetMode) {
                  setIsResetMode(false);
                } else {
                  setIsSignUp(!isSignUp);
                }
              }}
              className="text-xs text-black font-bold hover:underline bg-transparent border-none cursor-pointer"
            >
              {isResetMode ? (
                '← Back to Sign In'
              ) : isSignUp ? (
                'Already have an account? Sign In'
              ) : (
                'Need a doctor account? Register Now'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
