import { useState, useEffect, useRef } from 'react';
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
  ShieldCheck 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { friendlyAuthError } from '@/lib/authErrors';
import CodeVerification from '@/components/auth/CodeVerification';
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

// The 4 Glass Tiles matching the exact icons and order from the reference design:
// 1. Calendar (left, outline)
// 2. 3-People Team (center foreground, solid silhouette, largest)
// 3. 3-Bar Chart (right, 3 rounded ascending bars)
// 4. Document (far right, folded dog-ear corner)
const GLASS_CARDS = [
  {
    id: 'calendar',
    type: 'calendar',
  },
  {
    id: 'people',
    type: 'people',
  },
  {
    id: 'chart',
    type: 'chart',
  },
  {
    id: 'document',
    type: 'document',
  },
];

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

  // Active index for the 3D Glass Carousel (1 = People card in front center, matching reference)
  const [activeCardIndex, setActiveCardIndex] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Rapid & smooth carousel rotation with minimal time gap (1.1s cycle)
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveCardIndex((prev) => (prev + 1) % GLASS_CARDS.length);
    }, 1100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  // Exact 1:1 SVGs matching the reference design icons
  const renderCardIcon = (type: string) => {
    switch (type) {
      case 'calendar':
        return (
          <svg className="w-14 h-14 sm:w-16 sm:h-16 text-[#0D7355] drop-shadow-[0_2px_8px_rgba(5,150,105,0.25)]" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="6" width="3.2" height="6" rx="1.6" fill="currentColor" />
            <rect x="30.8" y="6" width="3.2" height="6" rx="1.6" fill="currentColor" />
            <rect x="8" y="9" width="32" height="32" rx="7" stroke="currentColor" strokeWidth="2.4" />
            <path d="M8 18H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="25" r="1.8" fill="currentColor" />
            <circle cx="24" cy="25" r="1.8" fill="currentColor" />
            <circle cx="32" cy="25" r="1.8" fill="currentColor" />
            <circle cx="16" cy="33" r="1.8" fill="currentColor" />
            <circle cx="24" cy="33" r="1.8" fill="currentColor" />
            <circle cx="32" cy="33" r="1.8" fill="currentColor" />
          </svg>
        );
      case 'people':
        return (
          <svg className="w-18 h-18 sm:w-20 sm:h-20 text-[#065F46] drop-shadow-[0_4px_12px_rgba(5,150,105,0.35)]" viewBox="0 0 56 56" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="22" r="5" opacity="0.85" />
            <path d="M7 38C7 32.5 11.2 29 16.5 29C20 29 23 30.5 24.5 33C20.5 34.5 18.5 37.5 18.5 41H7V38Z" opacity="0.85" />
            <circle cx="40" cy="22" r="5" opacity="0.85" />
            <path d="M49 38C49 32.5 44.8 29 39.5 29C36 29 33 30.5 31.5 33C35.5 34.5 37.5 37.5 37.5 41H49V38Z" opacity="0.85" />
            <circle cx="28" cy="18.5" r="6.8" />
            <path d="M15.5 41C15.5 34.5 21 31 28 31C35 31 40.5 34.5 40.5 41C40.5 42 39.8 43 38 43H18C16.2 43 15.5 42 15.5 41Z" />
          </svg>
        );
      case 'chart':
        return (
          <svg className="w-14 h-14 sm:w-16 sm:h-16 text-[#0D7355] drop-shadow-[0_2px_8px_rgba(5,150,105,0.25)]" viewBox="0 0 48 48" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="27" width="6.8" height="14" rx="3.4" />
            <rect x="20.6" y="18" width="6.8" height="23" rx="3.4" />
            <rect x="31.2" y="9" width="6.8" height="32" rx="3.4" />
          </svg>
        );
      case 'document':
        return (
          <svg className="w-14 h-14 sm:w-16 sm:h-16 text-[#0D7355] drop-shadow-[0_2px_8px_rgba(5,150,105,0.25)]" viewBox="0 0 48 48" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M12 8C12 6.34 13.34 5 15 5H27L36 14V39C36 40.66 34.66 42 33 42H15C13.34 42 12 40.66 12 39V8Z" 
              strokeWidth="2.4" 
              strokeLinejoin="round"
            />
            <path d="M27 5V14H36" strokeWidth="2.4" strokeLinejoin="round" />
            <line x1="18" y1="22" x2="30" y2="22" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="18" y1="28" x2="30" y2="28" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="18" y1="34" x2="25" y2="34" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {isLoading && <NizaLoaderOverlay />}

      <div className="min-h-screen w-full relative flex items-center justify-center overflow-x-hidden overflow-y-auto bg-[#FAFCFA]">
        
        {/* ========================================================= */}
        {/* BACKGROUND ART: Photorealistic Ethereal Silk Ribbons       */}
        {/* Exactly matching the colors, curves and luminous depth    */}
        {/* ========================================================= */}
        
        {/* Top-Right Silk Ribbon Waves */}
        <div className="absolute top-0 right-0 w-[58vw] max-w-[850px] h-[52vh] max-h-[520px] pointer-events-none select-none z-0 overflow-hidden">
          <svg
            className="w-full h-full object-cover object-top-right"
            viewBox="0 0 850 520"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMaxYMin slice"
          >
            <defs>
              <linearGradient id="silkTopGold" x1="480" y1="0" x2="850" y2="300" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.85" />
                <stop offset="35%" stopColor="#FDE68A" stopOpacity="0.75" />
                <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="silkTopGreen" x1="320" y1="0" x2="850" y2="400" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.35" />
                <stop offset="30%" stopColor="#34D399" stopOpacity="0.55" />
                <stop offset="65%" stopColor="#059669" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.45" />
              </linearGradient>
            </defs>

            {/* Amber Ribbon */}
            <path
              d="M500 0 C 620 140, 740 160, 850 200 L 850 90 C 740 40, 620 20, 530 0 Z"
              fill="url(#silkTopGold)"
            />

            {/* Emerald Silk Ribbon */}
            <path
              d="M340 0 C 480 140, 670 200, 850 290 L 850 410 C 680 290, 500 170, 270 0 Z"
              fill="url(#silkTopGreen)"
            />

            {/* Silk Contour Edge Highlight */}
            <path
              d="M450 0 C 580 130, 730 190, 850 240"
              stroke="#D1FAE5"
              strokeWidth="2.5"
              strokeOpacity="0.8"
            />
          </svg>
        </div>

        {/* Bottom-Left Silk Ribbon Wave sweeping across */}
        <div className="absolute bottom-0 left-0 w-[68vw] max-w-[980px] h-[55vh] max-h-[580px] pointer-events-none select-none z-0 overflow-hidden">
          <svg
            className="w-full h-full object-cover object-bottom-left"
            viewBox="0 0 980 580"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMinYMax slice"
          >
            <defs>
              <linearGradient id="silkBottomGreen" x1="0" y1="580" x2="850" y2="280" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#047857" stopOpacity="0.75" />
                <stop offset="30%" stopColor="#059669" stopOpacity="0.6" />
                <stop offset="65%" stopColor="#10B981" stopOpacity="0.4" />
                <stop offset="90%" stopColor="#6EE7B7" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="silkBottomGold" x1="0" y1="480" x2="700" y2="400" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.45" />
                <stop offset="40%" stopColor="#FCD34D" stopOpacity="0.32" />
                <stop offset="80%" stopColor="#FEF3C7" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#FFF" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Amber Inner Ribbon */}
            <path
              d="M0 450 C 220 400, 480 450, 750 580 L 0 580 Z"
              fill="url(#silkBottomGold)"
            />

            {/* Emerald Silk Wave */}
            <path
              d="M0 320 C 200 330, 440 420, 720 580 L 0 580 Z"
              fill="url(#silkBottomGreen)"
            />

            {/* Silk Contour Highlight Edge */}
            <path
              d="M0 360 C 220 370, 450 450, 760 580"
              stroke="#D1FAE5"
              strokeWidth="2.5"
              strokeOpacity="0.7"
            />
          </svg>
        </div>

        {/* ========================================================= */}
        {/* MAIN STAGE: Centered Clean 16:9 Layout                    */}
        {/* ========================================================= */}
        <div className="relative z-10 w-full max-w-[1260px] mx-auto px-6 sm:px-10 py-8 lg:py-12 flex flex-col lg:flex-row items-center lg:items-stretch justify-between gap-10 lg:gap-14 xl:gap-20">
          
          {/* ------------------------------------------------------- */}
          {/* LEFT: Top-Left Logo, Tagline & 3D Glass Cards Carousel  */}
          {/* ------------------------------------------------------- */}
          <div className="flex-1 w-full max-w-xl flex flex-col justify-between items-start text-left min-h-[500px] lg:min-h-[560px]">
            
            {/* Top-Left Branding */}
            <div className="pt-1 sm:pt-2">
              <div className="mb-3 sm:mb-3.5">
                <img
                  src={nizaCloudLogo}
                  alt="NIZA Cloud"
                  className="h-20 sm:h-24 md:h-26 w-auto object-contain drop-shadow-[0_4px_16px_rgba(5,150,105,0.06)] select-none"
                />
              </div>

              {/* Elegant Tagline: People · Process · Performance */}
              <p className="text-base sm:text-lg md:text-xl font-medium tracking-wide text-gray-600 flex items-center gap-2">
                <span>People</span>
                <span className="text-emerald-500 font-bold">•</span>
                <span>Process</span>
                <span className="text-emerald-500 font-bold">•</span>
                <span>Performance</span>
              </p>
            </div>

            {/* ------------------------------------------------------- */}
            {/* 3D FROSTED GLASS CARDS CAROUSEL                         */}
            {/* Real translucent crystal glass squircle tiles           */}
            {/* ------------------------------------------------------- */}
            <div
              className="relative w-full max-w-md sm:max-w-lg select-none pb-2 sm:pb-4"
            >
              {/* Carousel 3D Perspective Stage */}
              <div 
                className="relative h-60 sm:h-68 flex items-center justify-center animate-float"
                style={{ perspective: '1200px' }}
              >
                {GLASS_CARDS.map((card, idx) => {
                  // Compute relative position in carousel (0 = Center front, 1 = Right, 2 = Far right, 3 = Left)
                  const offset = (idx - activeCardIndex + GLASS_CARDS.length) % GLASS_CARDS.length;

                  let transformStyle = '';
                  let zIndex = 10;
                  let opacity = 0.5;
                  let isCenter = false;

                  if (offset === 0) {
                    // Front & Center Active Card: elevated in Z, largest scale (1.14), glowing
                    isCenter = true;
                    zIndex = 40;
                    opacity = 1;
                    transformStyle = 'translate3d(0px, -8px, 60px) rotate(-1deg) scale(1.14)';
                  } else if (offset === 1) {
                    // Right Card (behind center, in front of far-right)
                    zIndex = 30;
                    opacity = 0.9;
                    transformStyle = 'translate3d(120px, 12px, 10px) rotate(8deg) scale(0.95)';
                  } else if (offset === 2) {
                    // Far Right Card (behind right card)
                    zIndex = 10;
                    opacity = 0.72;
                    transformStyle = 'translate3d(215px, 26px, -20px) rotate(16deg) scale(0.85)';
                  } else {
                    // Left Card (behind center, offset === 3)
                    zIndex = 20;
                    opacity = 0.9;
                    transformStyle = 'translate3d(-125px, 14px, 10px) rotate(-11deg) scale(0.93)';
                  }

                  return (
                    <div
                      key={card.id}
                      onClick={() => setActiveCardIndex(idx)}
                      className={`
                        absolute w-[155px] h-[195px] sm:w-[170px] sm:h-[215px] rounded-[32px] cursor-pointer
                        transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-center
                        group overflow-hidden
                      `}
                      style={{
                        transform: transformStyle,
                        zIndex,
                        opacity,
                        // Real translucent frosted crystal glass:
                        background: isCenter
                          ? 'linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(240,253,248,0.48) 50%, rgba(220,252,238,0.28) 100%)'
                          : 'linear-gradient(135deg, rgba(255,255,255,0.68) 0%, rgba(240,253,244,0.38) 50%, rgba(220,252,231,0.2) 100%)',
                        backdropFilter: 'blur(18px)',
                        WebkitBackdropFilter: 'blur(18px)',
                        boxShadow: isCenter
                          ? '0 25px 50px -12px rgba(5, 150, 105, 0.25), 0 10px 20px -5px rgba(0, 0, 0, 0.04), inset 0 2px 4px rgba(255,255,255,0.95), inset -2px -2px 6px rgba(245, 158, 11, 0.22)'
                          : '0 16px 32px -8px rgba(0, 0, 0, 0.05), inset 0 1.5px 3px rgba(255,255,255,0.85), inset -2px -2px 5px rgba(245, 158, 11, 0.15)',
                        border: isCenter
                          ? '1.6px solid rgba(255, 255, 255, 0.95)'
                          : '1.2px solid rgba(255, 255, 255, 0.82)',
                      }}
                    >
                      {/* Smooth Specular Sheen across top half */}
                      <div className="absolute inset-0 rounded-[30px] pointer-events-none bg-gradient-to-b from-white/75 via-white/10 to-transparent opacity-90" />

                      {/* Pure Icon in the center */}
                      <div className="relative transition-transform duration-500 group-hover:scale-105">
                        {renderCardIcon(card.type)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- */}
          {/* RIGHT: Floating Glassmorphism Authentication Card       */}
          {/* ------------------------------------------------------- */}
          <div className="w-full lg:w-auto flex justify-center lg:justify-end">
            <div
              className="w-full max-w-[420px] sm:max-w-[440px] rounded-[34px] p-8 sm:p-9 relative bg-white/94 backdrop-blur-2xl border border-white/95"
              style={{
                boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.06), 0 10px 25px -5px rgba(5, 150, 105, 0.03), inset 0 1px 1px rgba(255, 255, 255, 0.95)',
              }}
            >
              {/* Badge: Secure Access */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-[#E8F7F0] text-[#065F46] border border-[#A7F3D0]/60 mb-5">
                <Lock className="w-3.5 h-3.5 text-[#059669]" />
                <span>Secure Access</span>
              </div>

              {/* Title & Subtitle */}
              <div className="mb-6">
                <h2 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-gray-900 leading-tight">
                  {mode === 'code-verify'
                    ? 'Check your email'
                    : mode === 'code-request'
                    ? 'Sign in with code'
                    : mode === '2fa-verify'
                    ? '2-Step Verification'
                    : 'Welcome back'}
                </h2>
                <p className="text-[13px] sm:text-[14px] text-gray-500 mt-1">
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
                      className="block text-xs font-semibold mb-1.5 text-gray-700"
                      htmlFor="email-input"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="email-input"
                        type="email"
                        placeholder="info@nizagroup.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-[48px] pl-10 pr-4 text-sm rounded-2xl bg-[#F3F4F6] border-0 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        disabled={isLoading}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label
                      className="block text-xs font-semibold mb-1.5 text-gray-700"
                      htmlFor="password-input"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-[48px] pl-10 pr-10 text-sm rounded-2xl bg-[#F3F4F6] border-0 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all tracking-wider"
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
                        className="border-gray-300 rounded data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      />
                      <label
                        htmlFor="remember-me"
                        className="text-xs font-medium text-gray-600 cursor-pointer select-none"
                      >
                        Remember me
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/reset-password')}
                      className="text-xs font-semibold text-[#059669] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Sign In Button with exact green-to-lime gradient */}
                  <Button
                    type="submit"
                    className="w-full h-[48px] text-sm font-semibold rounded-2xl text-white shadow-[0_8px_20px_rgba(5,150,105,0.3)] hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 mt-2"
                    style={{
                      background: 'linear-gradient(90deg, #026644 0%, #059669 48%, #84CC16 100%)',
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      'Signing in...'
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4 ml-0.5" />
                      </>
                    )}
                  </Button>

                  {/* Divider */}
                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-100" />
                    </div>
                    <span className="relative bg-white px-3 text-xs text-gray-400 font-normal">or</span>
                  </div>

                  {/* Secondary: Login with email code */}
                  <button
                    type="button"
                    onClick={() => {
                      setCodeEmail(email);
                      setMode('code-request');
                    }}
                    className="w-full h-[42px] rounded-full border border-gray-200/90 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium shadow-sm flex items-center justify-center gap-2 transition-all hover:border-gray-300"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#059669]" />
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
                      className="block text-xs font-semibold mb-1.5 text-gray-700"
                      htmlFor="code-email-input"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        id="code-email-input"
                        type="email"
                        placeholder="info@nizagroup.com"
                        value={codeEmail}
                        onChange={(e) => setCodeEmail(e.target.value)}
                        className="h-[48px] pl-10 pr-4 text-sm rounded-2xl bg-[#F3F4F6] border-0 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        disabled={isSendingCode}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-[48px] text-sm font-semibold rounded-2xl text-white shadow-[0_8px_20px_rgba(5,150,105,0.3)] transition-all"
                    style={{
                      background: 'linear-gradient(90deg, #026644 0%, #059669 48%, #84CC16 100%)',
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
              <div className="mt-7 pt-4 border-t border-gray-100 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <p className="text-[11px] text-gray-400 leading-tight">
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
