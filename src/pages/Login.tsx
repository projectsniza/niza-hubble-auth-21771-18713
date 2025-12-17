import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
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
    
    const { error } = await login(email, password);
    setIsLoading(false);
    
    if (!error) {
      // Save or clear credentials based on remember me
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, btoa(JSON.stringify({ email, password })));
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
      toast({ title: 'Welcome back!', description: 'Login successful' });
      navigate('/dashboard');
    } else {
      toast({ 
        title: 'Login failed', 
        description: error,
        variant: 'destructive' 
      });
    }
  };

  // Show nothing while checking auth status
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
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
        
        <div className="relative z-[2] p-8 pl-4 flex flex-col h-full">
          <img src={nizaCloudLogo} alt="Niza Cloud" className="w-56 xl:w-64" />
          
          <div className="flex-1"></div>

          {/* Floating Images */}
          <div className="relative h-72 mb-8">
            {/* Top pair */}
            <div className="absolute top-0 left-1 w-[71px] h-[71px] rounded-full overflow-hidden shadow-lg animate-float" style={{ animationDelay: '0s', border: '3px solid white' }}>
              <img src={hrEmployee1} alt="Team member" className="w-full h-full object-cover" />
            </div>
            <div className="absolute top-12 left-[272px] w-[80px] h-[80px] rounded-full overflow-hidden shadow-lg animate-float" style={{ animationDelay: '1s', border: '3px solid white' }}>
              <img src={hrEmployee2} alt="Team member" className="w-full h-full object-cover" />
            </div>
            {/* Bottom pair - with ~1cm (10px) gap */}
            <div className="absolute bottom-12 left-1 w-[90px] h-[90px] rounded-full overflow-hidden shadow-lg animate-float" style={{ animationDelay: '2s', border: '3px solid white' }}>
              <img src={hrEmployee3} alt="Team member" className="w-full h-full object-cover" />
            </div>
            <div className="absolute bottom-0 left-[288px] w-[80px] h-[80px] rounded-full overflow-hidden shadow-lg animate-float" style={{ animationDelay: '1.5s', border: '3px solid white' }}>
              <img src={hrEmployee4} alt="Team member" className="w-full h-full object-cover" />
            </div>
          </div>
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
            className="w-full max-w-[420px] lg:max-w-[480px] rounded-3xl p-8 lg:p-10 bg-white"
            style={{
              boxShadow: '0 0 0 1px hsl(0 0% 0% / 0.03), 0 1px 2px hsl(0 0% 0% / 0.02), 0 8px 16px hsl(0 0% 0% / 0.03), 0 24px 48px hsl(0 0% 0% / 0.04)'
            }}
          >
            {/* Premium Badge */}
            <div className="flex items-center gap-2 mb-8">
              <div 
                className="h-1 w-12 rounded-full"
                style={{ background: 'linear-gradient(90deg, hsl(162 57% 43%), hsl(48 90% 62%))' }}
              />
              <span className="text-xs font-semibold tracking-[0.15em] uppercase text-primary">
                Secure Access
              </span>
            </div>

            <div className="mb-8 lg:mb-10">
              <h2 className="text-3xl lg:text-4xl font-bold mb-3 tracking-tight text-gray-900">
                Welcome Back
              </h2>
              <p className="text-base lg:text-lg text-gray-500">
                Sign in to access your HR dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2.5 text-gray-700">
                  Email
                </label>
                <Input 
                  type="email" 
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-13 lg:h-14 text-base px-5 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 placeholder:text-gray-400"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2.5 text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <Input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-13 lg:h-14 text-base px-5 pr-12 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200 placeholder:text-gray-400"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-3">
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

              <Button 
                type="submit" 
                className="w-full h-13 lg:h-14 text-base lg:text-lg font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02] mt-4 bg-primary hover:bg-primary/90 text-white"
                style={{
                  boxShadow: '0 4px 14px hsl(162 57% 43% / 0.35)'
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-xs text-center text-gray-400">
                Contact your administrator if you need access
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
