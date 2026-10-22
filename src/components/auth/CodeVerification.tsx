import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/auth/OtpInput';
import { Loader2, PencilLine, RefreshCw } from 'lucide-react';

interface CodeVerificationProps {
  email: string;
  title: string;
  description?: string;
  onVerify: (code: string) => Promise<{ error: string | null }>;
  onResend: () => Promise<{ error: string | null }>;
  onChangeEmail?: () => void;
}

/**
 * Shared 6-digit code verification screen:
 * - Shows the email the code was sent to, with a "Change" option
 * - "Resend code" with a 60-second countdown cooldown
 * - 10-minute expiry hint
 * - Loading states and friendly error messages
 */
export default function CodeVerification({
  email,
  title,
  description,
  onVerify,
  onResend,
  onChangeEmail,
}: CodeVerificationProps) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(60);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const verify = async (value: string) => {
    if (isVerifying || value.length !== 6) return;
    setIsVerifying(true);
    setError(null);
    const result = await onVerify(value);
    if (result.error) {
      setError(result.error);
      setCode('');
    }
    setIsVerifying(false);
  };

  const handleResend = async () => {
    if (resendIn > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setResendNotice(null);
    const result = await onResend();
    setIsResending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setResendIn(60);
      setResendNotice(`A new code was sent to ${email}`);
      setCode('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
        <span className="truncate text-muted-foreground">
          Code sent to <span className="font-medium text-foreground">{email}</span>
        </span>
        {onChangeEmail && (
          <button
            type="button"
            onClick={onChangeEmail}
            className="ml-auto flex shrink-0 items-center gap-1 text-primary hover:underline"
          >
            <PencilLine className="h-3.5 w-3.5" />
            Change
          </button>
        )}
      </div>

      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={(value) => verify(value)}
        disabled={isVerifying}
      />

      {error && (
        <p className="text-sm font-medium text-destructive text-center" role="alert">
          {error}
        </p>
      )}
      {resendNotice && !error && (
        <p className="text-sm text-muted-foreground text-center">{resendNotice}</p>
      )}

      <Button
        type="button"
        onClick={() => verify(code)}
        className="w-full h-12 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
        disabled={isVerifying || code.length !== 6}
      >
        {isVerifying ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          'Verify code'
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
        <span className="text-muted-foreground">Didn't receive a code?</span>
        {resendIn > 0 ? (
          <span className="text-muted-foreground">Resend in {resendIn}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-60"
          >
            {isResending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Resend code
          </button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Codes expire after 10 minutes
      </p>
    </div>
  );
}
