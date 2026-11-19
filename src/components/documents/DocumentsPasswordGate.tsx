import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgSettingState } from '@/hooks/useOrgSetting';
import { verifyLoginPassword } from '@/lib/reauth';

const MAX_TRIES = 5;
const LOCK_SECONDS = 60;

/**
 * Asks for the login password every time the Documents page is opened.
 * Which roles are asked is a Business Rule (Settings -> Business Rules -> Security), on by default
 * for Super Admin and HR. The page is unmounted when the person leaves it, so the next visit asks again.
 */
export default function DocumentsPasswordGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { value: rule, isLoading } = useOrgSettingState('documents_reauth');

  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [lockedFor, setLockedFor] = useState(0);

  // Count down after too many wrong passwords.
  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);

  if (!user) return null;

  // Only roles that can open the Documents library are ever asked; the rest pass straight through.
  const role = user.role as string;
  const asked = (role === 'super_admin' || role === 'hr') && rule[role] !== false;
  if (!asked || unlocked) return <>{children}</>;

  // Wait for the saved rules so a role that was switched off is not asked for a moment first.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking || lockedFor > 0) return;
    setChecking(true);
    setError(null);
    const problem = await verifyLoginPassword(user.email, password);
    setChecking(false);
    if (!problem) {
      setPassword('');
      setUnlocked(true);
      return;
    }
    const next = fails + 1;
    setPassword('');
    if (next >= MAX_TRIES) {
      setFails(0);
      setLockedFor(LOCK_SECONDS);
    } else {
      setFails(next);
      setError(problem);
    }
  };

  return (
    <div className="flex items-center justify-center p-6 py-20">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle>Confirm your password</CardTitle>
          <CardDescription>
            Documents are protected. Type your login password to open them. You will be asked again each time you come back.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reauth-password">Password for {user.email}</Label>
              <Input
                id="reauth-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={checking || lockedFor > 0}
              />
            </div>
            {lockedFor > 0 ? (
              <p className="text-sm text-destructive" role="alert">Too many wrong passwords. Try again in {lockedFor}s.</p>
            ) : (
              error && <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={checking || lockedFor > 0 || !password}>
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open Documents'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
