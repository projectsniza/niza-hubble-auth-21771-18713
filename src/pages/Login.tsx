import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { NizaLoaderFullPage, NizaLoaderOverlay } from '@/components/ui/niza-loader';
import { 
  Eye, 
  EyeOff, 
  KeyRound, 
  ArrowLeft, 
  ArrowRight, 
  Mail, 
  Lock, 
  ShieldCheck,
  LayoutGrid
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { friendlyAuthError } from '@/lib/authErrors';
import CodeVerification from '@/components/auth/CodeVerification';
import LoginHeroGraphic from '@/components/auth/LoginHeroGraphic';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';
import { 
  send2FACode, 
  verify2FACode, 
  getTwoFactorAuthEnabled, 
  isTwoFactorAuthEnabledSync, 
  subscribeToTwoFactorSetting, 
  recordUserSessionStart 
} from '@/lib/twoFactorAuth';

const REMEMBER_ME_KEY = 'niza_remember_credentials';


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'code-request' | 'code-verify' | '2fa-verify'>('password');
  const [codeEmail, setCodeEmail] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [loginChallengeToken, setLoginChallengeToken] = useState<string | null>(null);
  const [pendingLoginCredentials, setPendingLoginCredentials] = useState<{ email: string; password: string } | null>(null);
  const { login, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();


  // Load saved credentials on mount
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_ME_KEY);
    if (saved) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(atob(saved));
        setEmail(savedEmail || '');
        setPassword(savedPassword || '');
        setRememberMe(true);
      } catch (e) {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && !loginChallengeToken) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate, loginChallengeToken]);

  // Keep 2FA configuration in sync
  useEffect(() => {
    getTwoFactorAuthEnabled().catch(() => {});
    const unsubscribe = subscribeToTwoFactorSetting(() => {});
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Validation Error',
        description: 'Please enter both email and password',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      let is2FAActive = isTwoFactorAuthEnabledSync();
      try {
        is2FAActive = await getTwoFactorAuthEnabled();
      } catch {
        // fallback
      }

      if (!is2FAActive) {
        const { error: loginError } = await login(email.trim().toLowerCase(), password);
        if (loginError) {
          toast({
            title: 'Login failed',
            description: friendlyAuthError(loginError),
            variant: 'destructive',
          });
          return;
        }

        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, btoa(JSON.stringify({ email: email.trim().toLowerCase(), password })));
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }
        recordUserSessionStart();
        toast({ title: 'Welcome back!', description: 'Login successful' });
        navigate('/dashboard', { replace: true });
        return;
      }

      // 2FA flow
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        toast({
          title: 'Login failed',
          description: friendlyAuthError(signInError.message),
          variant: 'destructive',
        });
        return;
      }

      await supabase.auth.signOut();

      const res = await send2FACode(email.trim().toLowerCase(), 'login');

      if (res.disabled || res.error?.toLowerCase().includes('disabled')) {
        const { error: directLoginError } = await login(email.trim().toLowerCase(), password);
        if (!directLoginError) {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_ME_KEY, btoa(JSON.stringify({ email: email.trim().toLowerCase(), password })));
          } else {
            localStorage.removeItem(REMEMBER_ME_KEY);
          }
          recordUserSessionStart();
          toast({ title: 'Welcome back!', description: 'Login successful' });
          navigate('/dashboard', { replace: true });
          return;
        }
      }

      if (!res.success || !res.challengeToken) {
        toast({
          title: 'Could not send verification code',
          description: res.error || 'Failed to send 2-step verification code',
          variant: 'destructive',
        });
        return;
      }

      setPendingLoginCredentials({ email: email.trim().toLowerCase(), password });
      setMode('2fa-verify');
      setLoginChallengeToken(res.challengeToken);
      toast({
        title: '2-Step Verification Required',
        description: `A 6-digit verification code was sent to ${email.trim().toLowerCase()}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyLogin2FA = async (code: string): Promise<{ error: string | null }> => {
    if (!loginChallengeToken || !pendingLoginCredentials) {
      return { error: 'Verification session expired. Please sign in again.' };
    }

    const res = await verify2FACode(loginChallengeToken, code);
    if (!res.success) {
      if (res.challengeToken) setLoginChallengeToken(res.challengeToken);
      return { error: res.error || 'Invalid verification code' };
    }

    const { error } = await login(pendingLoginCredentials.email, pendingLoginCredentials.password);
    if (error) {
      return { error };
    }

    if (rememberMe) {
      localStorage.setItem(REMEMBER_ME_KEY, btoa(JSON.stringify(pendingLoginCredentials)));
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }

    recordUserSessionStart();
    setLoginChallengeToken(null);
    setPendingLoginCredentials(null);
    toast({ title: 'Welcome back!', description: '2-Step verification successful' });
    navigate('/dashboard', { replace: true });
    return { error: null };
  };

  const handleResendLogin2FA = async (): Promise<{ error: string | null }> => {
    if (!pendingLoginCredentials?.email) return { error: 'Email not found' };
    const res = await send2FACode(pendingLoginCredentials.email, 'login');
    if (!res.success || !res.challengeToken) {
      return { error: res.error || 'Failed to resend code' };
    }
    setLoginChallengeToken(res.challengeToken);
    return { error: null };
  };

  const handleSendCode = async () => {
    if (!codeEmail) {
      toast({
        title: 'Validation Error',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingCode(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: codeEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        toast({
          title: 'Could not send code',
          description: friendlyAuthError(error.message),
          variant: 'destructive',
        });
        return;
      }

      setMode('code-verify');
      toast({ title: 'Code sent', description: `A 6-digit code was sent to ${codeEmail}` });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyEmailCode = async (code: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.verifyOtp({
      email: codeEmail,
      token: code,
      type: 'email',
    });

    if (error) return { error: friendlyAuthError(error.message) };

    recordUserSessionStart();
    toast({ title: 'Welcome back!', description: 'Login successful' });
    navigate('/dashboard', { replace: true });
    return { error: null };
  };

  const handleResendEmailCode = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      email: codeEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    return error ? { error: friendlyAuthError(error.message) } : { error: null };
  };

  if (authLoading) {
    return <NizaLoaderFullPage />;
  }



  return (
    <>
      {isLoading && <NizaLoaderOverlay />}

      <div className="min-h-screen w-full relative flex items-center justify-center overflow-x-hidden overflow-y-auto bg-[#F6F9F8]">
        {/* Soft ambient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 50% at 18% 30%, rgba(209,250,229,0.7) 0%, rgba(246,249,248,0) 70%), radial-gradient(45% 45% at 95% 55%, rgba(254,243,199,0.6) 0%, rgba(246,249,248,0) 70%), radial-gradient(50% 40% at 10% 100%, rgba(167,243,208,0.45) 0%, rgba(246,249,248,0) 70%)',
          }}
        />
        <div className="absolute -left-40 bottom-[-14rem] w-[60rem] h-[26rem] rounded-[100%] bg-gradient-to-tr from-emerald-100/70 via-white/0 to-transparent blur-2xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[1320px] mx-auto px-6 sm:px-10 py-8 lg:py-10 flex flex-col lg:flex-row items-center lg:items-stretch justify-between gap-10 lg:gap-8 xl:gap-12">
          {/* LEFT: branding, headline and animated graphic */}
          <div className="flex-1 w-full max-w-[680px] flex flex-col items-start text-left">
            <img
              src={nizaCloudLogo}
              alt="NIZA Cloud"
              className="h-16 sm:h-20 w-auto object-contain select-none"
            />

            <div className="mt-8 sm:mt-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#DDF3E8] text-[#14573F] text-[13px] font-medium">
              <LayoutGrid className="w-4 h-4 text-[#16A163]" fill="currentColor" />
              <span>HR Workspace</span>
            </div>

            <h1 className="mt-5 text-[40px] sm:text-[52px] xl:text-[58px] leading-[1.04] font-medium tracking-tight text-[#1A2420]">
              People, Process &amp;
              <br />
              <span
                className="font-semibold bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg, #8A8A12 0%, #3E8E2E 35%, #0F6B45 100%)' }}
              >
                Performance
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-sm leading-snug">
              All in one secure cloud platform for your organization.
            </p>
            <div className="mt-5 h-[3px] w-20 rounded-full bg-gradient-to-r from-[#0F8A57] to-[#2FB56F]" />

            <div className="w-full mt-2 -mb-2 lg:-mt-4">
              <LoginHeroGraphic />
            </div>
          </div>

          {/* ------------------------------------------------------- */}
          {/* RIGHT: Floating Glassmorphism Authentication Card       */}
          {/* ------------------------------------------------------- */}
          <div className="w-full lg:w-auto flex justify-center lg:justify-end">
            <div
              className="w-full max-w-[460px] rounded-[40px] p-8 sm:p-10 relative overflow-hidden bg-white/80 backdrop-blur-2xl border border-white"
              style={{
                boxShadow: '0 30px 70px -20px rgba(16, 120, 80, 0.22), 0 0 0 6px rgba(255,255,255,0.45), inset 0 1px 2px rgba(255, 255, 255, 1)',
              }}
            >
              {/* Silk swoosh in the top-right corner */}
              <svg className="absolute top-0 right-0 w-[260px] h-[110px] pointer-events-none" viewBox="0 0 260 110" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="cardSwooshG" x1="0" y1="0" x2="260" y2="110" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#D1FAE5" stopOpacity="0.2" />
                    <stop offset="0.55" stopColor="#4CC38A" stopOpacity="0.75" />
                    <stop offset="1" stopColor="#8BD6A8" stopOpacity="0.5" />
                  </linearGradient>
                  <linearGradient id="cardSwooshY" x1="60" y1="0" x2="260" y2="80" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#FDE68A" stopOpacity="0" />
                    <stop offset="0.6" stopColor="#FCD34D" stopOpacity="0.8" />
                    <stop offset="1" stopColor="#FEF3C7" stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                <path d="M70 0 C 130 18, 190 50, 260 78 L 260 0 Z" fill="url(#cardSwooshG)">
                  <animate attributeName="d" dur="8s" repeatCount="indefinite" values="M70 0 C 130 18, 190 50, 260 78 L 260 0 Z;M70 0 C 125 28, 195 42, 260 86 L 260 0 Z;M70 0 C 130 18, 190 50, 260 78 L 260 0 Z" />
                </path>
                <path d="M96 0 C 150 20, 205 36, 260 52" stroke="url(#cardSwooshY)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              {/* Badge: Secure Access */}
              <div className="relative inline-flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full text-[13px] font-medium bg-[#E6F4D9] text-[#14573F] mb-6">
                <ShieldCheck className="w-5 h-5 text-[#0F7A4F]" strokeWidth={1.8} />
                <span>Secure Access</span>
              </div>

              {/* Title & Subtitle */}
              <div className="mb-7 relative">
                <h2 className="text-[34px] sm:text-[40px] font-bold tracking-tight text-[#0F3D2E] leading-tight">
                  {mode === 'code-verify'
                    ? 'Check your email'
                    : mode === 'code-request'
                    ? 'Sign in with code'
                    : mode === '2fa-verify'
                    ? '2-Step Verification'
                    : 'Welcome back'}
                </h2>
                <p className="text-[15px] text-gray-500 mt-1">
                  {mode === 'code-verify'
                    ? `We sent a 6-digit sign-in code to ${codeEmail}`
                    : mode === 'code-request'
                    ? 'Enter your email to receive a 6-digit sign-in code'
                    : mode === '2fa-verify'
                    ? 'Enter the 6-digit security code sent to your email'
                    : 'Sign in to access your HR dashboard'}
                </p>
              </div>

              {/* --------------------------------------------------- */}
              {/* Password Login Form (Default)                       */}
              {/* --------------------------------------------------- */}
              {mode === 'password' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2 text-gray-800"
                      htmlFor="email-input"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="email-input"
                        type="email"
                        placeholder="info@nizagroup.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-[52px] pl-11 pr-4 text-[15px] rounded-2xl bg-[#EEF2F9] border border-[#E2E8F2] text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        disabled={isLoading}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2 text-gray-800"
                      htmlFor="password-input"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-[52px] pl-11 pr-11 text-[15px] rounded-2xl bg-[#EEF2F9] border border-[#E2E8F2] text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all tracking-wider"
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me & Forgot password */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember-me"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                        className="border-gray-300 rounded data-[state=checked]:bg-[#0F8A57] data-[state=checked]:border-[#0F8A57]"
                      />
                      <label
                        htmlFor="remember-me"
                        className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                      >
                        Remember me
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/reset-password')}
                      className="text-sm font-medium text-[#0F7A4F] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Sign In Button with exact green-to-lime gradient */}
                  <Button
                    type="submit"
                    className="relative overflow-hidden w-full h-[56px] text-base font-semibold rounded-full text-white shadow-[0_12px_26px_rgba(5,120,80,0.35)] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-3"
                    style={{
                      background: 'linear-gradient(90deg, #04643F 0%, #0B7D4C 50%, #5BB02F 100%)',
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      'Signing in...'
                    ) : (
                      <>
                        <span className="relative z-10">Sign In</span>
                        <ArrowRight className="relative z-10 w-5 h-5 ml-0.5" />
                        <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-[signin-shine_4s_ease-in-out_infinite]" />
                      </>
                    )}
                  </Button>

                  {/* Divider */}
                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-100" />
                    </div>
                    <span className="relative bg-[#FBFDFC] px-3 text-sm text-gray-500 font-normal">or</span>
                  </div>

                  {/* Secondary: Login with email code */}
                  <button
                    type="button"
                    onClick={() => {
                      setCodeEmail(email);
                      setMode('code-request');
                    }}
                    className="w-full h-[52px] rounded-full border border-[#BFE3D2] bg-white/70 hover:bg-emerald-50/60 text-[#0F3D2E] text-[15px] font-semibold shadow-sm flex items-center justify-center gap-2 transition-all hover:border-gray-300"
                  >
                    <KeyRound className="w-4 h-4 text-[#0F7A4F]" />
                    <span>Login with email code</span>
                  </button>
                </form>
              )}

              {/* --------------------------------------------------- */}
              {/* MODE: Code Request Form                             */}
              {/* --------------------------------------------------- */}
              {mode === 'code-request' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendCode();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label
                      className="block text-sm font-semibold mb-2 text-gray-800"
                      htmlFor="code-email-input"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="code-email-input"
                        type="email"
                        placeholder="info@nizagroup.com"
                        value={codeEmail}
                        onChange={(e) => setCodeEmail(e.target.value)}
                        className="h-[52px] pl-11 pr-4 text-[15px] rounded-2xl bg-[#EEF2F9] border border-[#E2E8F2] text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        disabled={isSendingCode}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-[56px] text-base font-semibold rounded-full text-white shadow-[0_12px_26px_rgba(5,120,80,0.35)] transition-all"
                    style={{
                      background: 'linear-gradient(90deg, #04643F 0%, #0B7D4C 50%, #5BB02F 100%)',
                    }}
                    disabled={isSendingCode}
                  >
                    {isSendingCode ? 'Sending code...' : 'Send code'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setMode('password')}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 pt-2 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to password login
                  </button>
                </form>
              )}

              {/* --------------------------------------------------- */}
              {/* MODE: Code Verify Form                              */}
              {/* --------------------------------------------------- */}
              {mode === 'code-verify' && (
                <CodeVerification
                  email={codeEmail}
                  title="Enter your code"
                  description="Type the 6-digit code from your email to sign in"
                  onVerify={handleVerifyEmailCode}
                  onResend={handleResendEmailCode}
                  onChangeEmail={() => setMode('code-request')}
                />
              )}

              {/* --------------------------------------------------- */}
              {/* MODE: 2FA Verification                             */}
              {/* --------------------------------------------------- */}
              {mode === '2fa-verify' && (
                <CodeVerification
                  email={pendingLoginCredentials?.email || email}
                  title="2-Step Verification"
                  description="Enter the 6-digit security code sent to your email"
                  onVerify={handleVerifyLogin2FA}
                  onResend={handleResendLogin2FA}
                  onChangeEmail={() => setMode('password')}
                />
              )}

              {/* Security Compliance Footer inside Card */}
              <div className="mt-7 pt-5 border-t border-gray-100 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-[12px] text-gray-500 leading-snug">
                  AES-256 Encrypted · TLS 1.3 · OAuth 2.0 · GDPR Compliant ·<br />
                  SOC 2 Type II & ISO 27001 Infrastructure
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
