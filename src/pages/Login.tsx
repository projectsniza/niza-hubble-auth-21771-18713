import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { NizaLoaderFullPage, NizaLoaderOverlay } from '@/components/ui/niza-loader';
import { Eye, EyeOff } from 'lucide-react';
import nizaCloudLogo from '@/assets/niza-cloud-logo.png';
import hrEmployee1 from '@/assets/hr-employee-1.jpg';
import hrEmployee2 from '@/assets/hr-employee-2.jpg';
import hrEmployee3 from '@/assets/hr-employee-3.jpg';
import hrEmployee4 from '@/assets/hr-employee-4.jpg';

const REMEMBER_ME_KEY = 'niza_remember_credentials';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Validation Error',
        description: 'Please enter both email and password',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await login(email, password);

      if (error) {
        toast({
          title: 'Login failed',
          description: error,
          variant: 'destructive'
        });
        return;
      }

      // Save or clear credentials based on remember me
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, btoa(JSON.stringify({ email, password })));
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      toast({ title: 'Welcome back!', description: 'Login successful' });
      // Don't navigate here - let the useEffect handle navigation once user state updates
      // The useEffect at line 43 will navigate when user becomes truthy
    } finally {
      setIsLoading(false);
    }
  };

  // Show nothing while checking auth status
  if (authLoading) {
    return <NizaLoaderFullPage />;
  }

  return (
    <>
      {/* Loading overlay during login */}
      {isLoading && <NizaLoaderOverlay />}
      
      <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Left Panel - Desktop Only */}
      <div className="relative hidden lg:flex lg:flex-1 flex-col border-r border-border" 
           style={{ 
             background: 'linear-gradient(180deg, hsl(0 0% 100%) 16.43%, hsla(155 60% 93% / 0.54) 44.71%, hsl(155 70% 73%) 100%)',
             overflow: 'hidden'
           }}>
        <svg className="absolute top-0 right-0 z-[1]" viewBox="0 0 593 470" fill="none" preserveAspectRatio="xMaxYMin meet" style={{ width: '70%', height: '70%' }}>
          <path d="M8.44398 0.617329H592.052V469.547C592.052 48.6499 274.052 498.547 366.552 250.047C459.052 1.5472 419.436 102.82 419.436 102.82C419.436 102.82 343.17 209.048 201.552 208.547C124.426 208.274 104.783 140.619 188.052 102.82C319.337 43.2233 149.498 31.3712 120.052 23.0472C56.1705 4.98889 22.6081 1.25634 8.44398 0.617329H0.0516663C0.0516663 0.617329 2.59244 0.353338 8.44398 0.617329Z" fill="url(#paint0_linear)" stroke="hsl(162 57% 43%)"/>
          <defs>
            <linearGradient id="paint0_linear" x1="592.659" y1="0.617318" x2="376.315" y2="504.04" gradientUnits="userSpaceOnUse">
              <stop offset="0.0734679" stopColor="hsl(48 90% 62%)"/>
              <stop offset="0.458691" stopColor="hsl(162 57% 43%)"/>
            </linearGradient>
          </defs>
        </svg>
        
        <div className="relative z-[2] p-10 xl:p-12 flex flex-col h-full">
          <img src={nizaCloudLogo} alt="Niza Cloud" className="w-56 xl:w-64" />

          <div className="mt-12 max-w-sm">
            <h1 className="text-3xl xl:text-4xl font-bold text-gray-900 leading-tight tracking-tight">
              Empower your workforce.
            </h1>
            <p className="mt-3 text-base text-gray-600 leading-relaxed">
              The all-in-one HR platform built for modern teams.
            </p>
          </div>

          <div className="flex-1"></div>

          {/* Floating Images */}
          <div className="relative h-72 mb-8">
            {/* Top pair */}
            <div className="absolute top-0 left-1 w-[71px] h-[71px] rounded-full overflow-hidden shadow-lg animate-float ring-1 ring-black/5" style={{ animationDelay: '0s', border: '3px solid white' }}>
              <img src={hrEmployee1} alt="Team member" className="w-full h-full object-cover" />
            </div>
            <div className="absolute top-12 left-[272px] w-[80px] h-[80px] rounded-full overflow-hidden shadow-lg animate-float ring-1 ring-black/5" style={{ animationDelay: '1s', border: '3px solid white' }}>
              <img src={hrEmployee2} alt="Team member" className="w-full h-full object-cover" />
            </div>
            {/* Bottom pair */}
            <div className="absolute bottom-12 left-1 w-[90px] h-[90px] rounded-full overflow-hidden shadow-lg animate-float ring-1 ring-black/5" style={{ animationDelay: '2s', border: '3px solid white' }}>
              <img src={hrEmployee3} alt="Team member" className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-0 left-[288px] w-[80px] h-[80px] rounded-full overflow-hidden shadow-lg animate-float ring-1 ring-black/5" style={{ animationDelay: '1.5s', border: '3px solid white' }}>
              <img src={hrEmployee4} alt="Team member" className="w-full h-full object-cover" />
            </div>
          </div>

          <p className="text-xs text-gray-500 tracking-wide">
            © {new Date().getFullYear()} Niza Group · All rights reserved
          </p>
        </div>
      </div>

      {/* Right Panel - Premium White Design */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0 relative overflow-hidden bg-white">
        {/* Subtle Background Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.4]"
          style={{
            background: 'radial-gradient(circle at 20% 80%, hsl(162 40% 95%) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(48 60% 97%) 0%, transparent 50%)'
          }}
        />

        {/* Mobile Header */}
        <div className="lg:hidden pt-8 pb-12 px-6 text-center relative z-10">
          <img src={nizaCloudLogo} alt="Niza Cloud" className="w-40 mx-auto mb-4" />
          <div className="flex justify-center gap-2 mt-4">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md ring-2 ring-primary/20">
              <img src={hrEmployee1} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md ring-2 ring-primary/20 -ml-3">
              <img src={hrEmployee2} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md ring-2 ring-primary/20 -ml-3">
              <img src={hrEmployee3} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-md ring-2 ring-primary/20 -ml-3">
              <img src={hrEmployee4} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-start lg:items-center justify-center px-5 py-6 lg:p-8 xl:p-12 -mt-6 lg:mt-0 relative z-10">
          <div 
            className="w-full max-w-[420px] lg:max-w-[460px] rounded-3xl p-8 lg:p-10 bg-white border border-gray-100"
            style={{
              boxShadow: '0 1px 2px hsl(0 0% 0% / 0.04), 0 8px 24px hsl(0 0% 0% / 0.04), 0 24px 56px hsl(0 0% 0% / 0.06)'
            }}
          >
            {/* Premium Badge */}
            <div className="flex items-center gap-3 mb-7">
              <div 
                className="h-1 w-10 rounded-full"
                style={{ background: 'linear-gradient(90deg, hsl(162 57% 43%), hsl(48 90% 62%))' }}
              />
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-primary">
                Secure Access
              </span>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl lg:text-[2rem] font-bold mb-2 tracking-tight text-gray-900 leading-tight">
                Welcome back
              </h2>
              <p className="text-sm lg:text-base text-gray-500 leading-relaxed">
                Sign in to access your HR dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700" htmlFor="email-input">
                  Email
                </label>
                <Input 
                  id="email-input"
                  type="email" 
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 lg:h-13 text-[15px] px-4 rounded-xl border-gray-200 bg-gray-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 placeholder:text-gray-400"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700" htmlFor="password-input">
                  Password
                </label>
                <div className="relative">
                  <Input 
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 lg:h-13 text-[15px] px-4 pr-12 rounded-xl border-gray-200 bg-gray-50/60 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 placeholder:text-gray-400"
                    disabled={isLoading}
                    autoComplete="current-password"
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

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2.5">
                  <Checkbox 
                    id="remember-me" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label 
                    htmlFor="remember-me" 
                    className="text-sm font-medium text-gray-600 cursor-pointer select-none"
                  >
                    Remember me
                  </label>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 lg:h-13 text-base font-semibold rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] mt-2 bg-primary hover:bg-primary/90 text-white"
                style={{
                  boxShadow: '0 6px 18px hsl(162 57% 43% / 0.32)'
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-7 pt-5 border-t border-gray-100">
              <p className="text-xs text-center text-gray-400">
                Contact your administrator if you need access
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
