import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import CodeVerification from '@/components/auth/CodeVerification';
import { friendlyAuthError } from '@/lib/authErrors';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';

type Step = 'email' | 'code' | 'password';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const sendResetCode = async () => {
    if (!email) {
      toast({ title: 'Validation Error', description: 'Please enter your email address', variant: 'destructive' });
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: 'Could not send code', description: friendlyAuthError(error.message), variant: 'destructive' });
        return;
      }
      setStep('code');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async (code: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error) return { error: friendlyAuthError(error.message) };
    setStep('password');
    return { error: null };
  };

  const handleResendCode = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? { error: friendlyAuthError(error.message) } : { error: null };
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: 'Validation Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Validation Error', description: 'Password must be at least 6 characters long', variant: 'destructive' });
      return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: 'Could not update password', description: friendlyAuthError(error.message), variant: 'destructive' });
        return;
      }
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated', description: 'Sign in with your new password' });
      navigate('/login');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white relative overflow-y-auto">
      <div
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 20% 80%, hsl(162 40% 95%) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(48 60% 97%) 0%, transparent 50%)'
        }}
      />

      <div className="flex-1 flex items-center justify-center px-5 py-10 relative z-10">
        <div
          className="w-full max-w-[440px] rounded-3xl p-8 bg-white border border-gray-100"
          style={{
            boxShadow: '0 1px 2px hsl(0 0% 0% / 0.04), 0 8px 24px hsl(0 0% 0% / 0.04), 0 24px 56px hsl(0 0% 0% / 0.06)'
          }}
        >
          <img src={nizaCloudLogo} alt="Niza Cloud" className="w-40 mx-auto mb-6" />

          {step === 'email' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-1 w-10 rounded-full" style={{ background: 'linear-gradient(90deg, hsl(162 57% 43%), hsl(48 90% 62%))' }} />
                <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary">Password Reset</span>
              </div>
              <h2 className="text-2xl font-bold mb-2 tracking-tight text-gray-900">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mb-7">
                Enter your email and we will send a 6-digit code to reset it
              </p>
              <form onSubmit={(e) => { e.preventDefault(); sendResetCode(); }} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700" htmlFor="reset-email">
                    Email
                  </label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-[15px] px-4 rounded-xl border-gray-200 bg-gray-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 placeholder:text-gray-400"
                    disabled={isSending}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-white"
                  disabled={isSending}
                >
                  {isSending ? 'Sending code...' : 'Send code'}
                </Button>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <>
              <CodeVerification
                email={email}
                title="Enter your code"
                description="Type the 6-digit code from your email to reset your password"
                onVerify={handleVerifyCode}
                onResend={handleResendCode}
                onChangeEmail={() => setStep('email')}
              />
            </>
          )}

          {step === 'password' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-1 w-10 rounded-full" style={{ background: 'linear-gradient(90deg, hsl(162 57% 43%), hsl(48 90% 62%))' }} />
                <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary">Step 3 of 3</span>
              </div>
              <h2 className="text-2xl font-bold mb-2 tracking-tight text-gray-900">Set a new password</h2>
              <p className="text-sm text-gray-500 mb-7">
                Choose a new password for {email}
              </p>
              <form onSubmit={handleSetNewPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700" htmlFor="new-password">
                    New password
                  </label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-12 text-[15px] px-4 pr-12 rounded-xl border-gray-200 bg-gray-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 placeholder:text-gray-400"
                      disabled={isUpdating}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-md hover:bg-gray-100"
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700" htmlFor="confirm-new-password">
                    Confirm new password
                  </label>
                  <Input
                    id="confirm-new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 text-[15px] px-4 rounded-xl border-gray-200 bg-gray-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 placeholder:text-gray-400"
                    disabled={isUpdating}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-white"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Updating password...' : 'Update password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
