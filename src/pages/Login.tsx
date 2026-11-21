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

// Only the email is remembered; the old key that also held the password is removed on load.
const LEGACY_REMEMBER_KEY = 'niza_remember_credentials';
const REMEMBER_ME_KEY = 'niza_remember_email';


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'password' | '2fa-verify'>('password');
  const [loginChallengeToken, setLoginChallengeToken] = useState<string | null>(null);
  const [pendingLoginCredentials, setPendingLoginCredentials] = useState<{ email: string; password: string } | null>(null);
  const { login, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();


  // Load saved credentials on mount
  useEffect(() => {
    try {
      const legacy = localStorage.getItem(LEGACY_REMEMBER_KEY);
      if (legacy) {
        localStorage.removeItem(LEGACY_REMEMBER_KEY);
        try {
          const { email: legacyEmail } = JSON.parse(atob(legacy));
          if (legacyEmail) localStorage.setItem(REMEMBER_ME_KEY, legacyEmail);
        } catch { /* unreadable old value: just drop it */ }
      }
      const savedEmail = localStorage.getItem(REMEMBER_ME_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch { /* storage blocked (private mode): nothing to restore */ }
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
          localStorage.setItem(REMEMBER_ME_KEY, email.trim().toLowerCase());
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
            localStorage.setItem(REMEMBER_ME_KEY, email.trim().toLowerCase());
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
      localStorage.setItem(REMEMBER_ME_KEY, pendingLoginCredentials.email.trim().toLowerCase());
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

  if (authLoading) {
    return <NizaLoaderFullPage />;
  }



  return (
    <>
      {isLoading && <NizaLoaderOverlay />}

      <div className="h-[100dvh] w-full relative overflow-hidden bg-[#F4F9F6]">
        {/* Soft ambient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(55% 55% at 22% 38%, rgba(209,250,229,0.75) 0%, rgba(244,249,246,0) 70%), radial-gradient(40% 50% at 100% 60%, rgba(254,243,199,0.55) 0%, rgba(244,249,246,0) 70%), radial-gradient(60% 40% at 30% 100%, rgba(187,247,208,0.5) 0%, rgba(244,249,246,0) 70%)',
          }}
        />
        <div className="absolute -left-40 bottom-[-14rem] w-[60rem] h-[26rem] rounded-[100%] bg-gradient-to-tr from-emerald-100/70 via-white/0 to-transparent blur-2xl pointer-events-none" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-[1500px] items-center justify-center gap-[4vw] px-5 py-5 sm:px-[5vw] lg:justify-between lg:py-[4.5vh]">
          {/* LEFT: branding, headline and animated graphic */}
          <div className="hidden lg:flex h-full min-w-0 flex-1 max-w-[760px] flex-col items-start text-left">
            <img
              src={nizaCloudLogo}
              alt="NIZA Cloud"
              className="h-[clamp(46px,9.5vh,92px)] w-auto shrink-0 object-contain select-none"
            />

            <div className="mt-[4.5vh] inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#DDF3E8] px-[clamp(10px,1.5vh,16px)] py-[clamp(4px,0.8vh,8px)] text-[clamp(12px,1.8vh,17px)] font-medium text-[#14573F]">
              <LayoutGrid className="h-[clamp(14px,2vh,19px)] w-[clamp(14px,2vh,19px)] text-[#16A163]" fill="currentColor" />
              <span>HR Workspace</span>
            </div>

            <h1 style={{ animation: 'niza-rise .8s .12s cubic-bezier(.2,.7,.2,1) both' }} className="mt-[2.2vh] shrink-0 text-[clamp(34px,7.2vh,70px)] font-semibold leading-[1.04] tracking-tight text-[#141C18]">
              People, Process &amp;
              <br />
              <span
                className="font-bold bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg, #7FA412 0%, #3E9A2E 45%, #148A4B 100%)' }}
              >
                Performance
              </span>
            </h1>

            <div className="mt-[2.6vh] h-[clamp(3px,0.5vh,5px)] w-[clamp(72px,11vh,108px)] shrink-0 rounded-full bg-gradient-to-r from-[#0F8A57] to-[#34C46F]" />

            <div className="relative min-h-0 w-full flex-1 -mt-[4vh] -mb-[2vh]">
              <div className="absolute bottom-0 left-0 h-full max-w-full" style={{ aspectRatio: '620 / 500' }}>
                <LoginHeroGraphic />
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- */}
          {/* RIGHT: Floating Glassmorphism Authentication Card       */}
          {/* ------------------------------------------------------- */}
          <div className="flex h-full w-full max-h-full items-center justify-center lg:w-auto lg:justify-end">
            <div
              className="relative flex max-h-full w-full max-w-[460px] lg:w-[clamp(440px,62vh,580px)] lg:max-w-none flex-col overflow-y-auto overflow-x-hidden rounded-[clamp(26px,4.2vh,36px)] border border-white/80 bg-white/[0.97] px-[min(clamp(24px,5vh,52px),6vw)] py-[min(clamp(20px,4.2vh,48px),6vw)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                boxShadow: '0 44px 90px -34px rgba(6, 95, 70, 0.32), 0 14px 32px -20px rgba(6, 95, 70, 0.2), inset 0 1px 0 rgba(255, 255, 255, 1)',
                animation: 'niza-rise .7s cubic-bezier(.2,.7,.2,1) both',
              }}
            >
              {/* Silk swoosh in the top-right corner */}
              <svg className="absolute top-0 right-0 w-[48%] h-auto pointer-events-none" viewBox="0 0 260 110" fill="none" aria-hidden="true">
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
              <div className="relative mb-[2.4vh] inline-flex self-start items-center gap-2 rounded-full bg-[#E6F4D9] py-[clamp(4px,0.8vh,8px)] pl-[clamp(8px,1vh,10px)] pr-[clamp(12px,1.8vh,18px)] text-[clamp(12px,1.8vh,17px)] font-medium text-[#14573F]">
                <ShieldCheck className="h-[clamp(16px,2.5vh,22px)] w-[clamp(16px,2.5vh,22px)] text-[#0F7A4F]" strokeWidth={1.8} />
                <span>Secure Access</span>
              </div>

              {/* Title & Subtitle */}
              <div className="relative mb-[2.8vh]">
                <h2 className="text-[min(clamp(28px,5.4vh,50px),8.4vw)] font-bold leading-tight tracking-tight text-[#0F3D2E]">
                  {mode === '2fa-verify'
                    ? '2-Step Verification'
                    : 'Welcome back'}
                </h2>
                <p className="mt-[0.6vh] text-[min(clamp(13px,2vh,19px),3.9vw)] text-gray-500">
                  {mode === '2fa-verify'
                    ? 'Enter the 6-digit security code sent to your email'
                    : 'Sign in to access your HR dashboard'}
                </p>
              </div>

              {/* --------------------------------------------------- */}
              {/* Password Login Form (Default)                       */}
              {/* --------------------------------------------------- */}
              {mode === 'password' && (
                <form onSubmit={handleSubmit} className="space-y-[2.2vh]">
                  {/* Email Input */}
                  <div>
                    <label
                      className="mb-2 block text-[13px] font-semibold tracking-wide text-[#14332A]"
                      htmlFor="email-input"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#7D9488] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="email-input"
                        type="email"
                        placeholder="info@nizagroup.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-[clamp(42px,6.4vh,58px)] pl-11 pr-4 text-[15px] rounded-xl bg-[#F6F9F7] border border-[#D9E5DE] text-gray-900 placeholder:text-[#A3B3AA] shadow-none focus-visible:outline-none focus:bg-white focus:border-[#0F8A57] focus:ring-4 focus:ring-emerald-500/15 transition-[border-color,box-shadow,background-color] duration-200"
                        disabled={isLoading}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label
                      className="mb-2 block text-[13px] font-semibold tracking-wide text-[#14332A]"
                      htmlFor="password-input"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#7D9488] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-[clamp(42px,6.4vh,58px)] pl-11 pr-11 text-[15px] rounded-xl bg-[#F6F9F7] border border-[#D9E5DE] text-gray-900 placeholder:text-[#A3B3AA] shadow-none focus-visible:outline-none focus:bg-white focus:border-[#0F8A57] focus:ring-4 focus:ring-emerald-500/15 transition-[border-color,box-shadow,background-color] duration-200 tracking-wider"
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#7D9488] transition-colors hover:bg-emerald-50 hover:text-[#0F7A4F]"
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
                        className="text-[min(clamp(13px,1.9vh,16px),3.7vw)] font-medium text-gray-700 cursor-pointer select-none"
                      >
                        Remember me
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/reset-password')}
                      className="text-[min(clamp(13px,1.9vh,16px),3.7vw)] font-medium text-[#0F7A4F] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Sign In Button with exact green-to-lime gradient */}
                  <Button
                    type="submit"
                    className="group relative overflow-hidden w-full h-[clamp(44px,6.6vh,60px)] text-[16px] font-semibold rounded-full text-white shadow-[0_16px_30px_-12px_rgba(5,120,80,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_38px_-12px_rgba(5,120,80,0.66)] active:translate-y-0 active:scale-[0.99] disabled:opacity-80 flex items-center justify-center gap-2 mt-4"
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
                </form>
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
              <div className="mt-[3vh] flex items-center gap-3 rounded-xl bg-[#F3F8F5] px-4 py-3">
                <ShieldCheck className="w-6 h-6 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-[min(clamp(10.5px,1.55vh,13px),2.9vw)] text-gray-500 leading-snug">
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
