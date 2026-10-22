import { useRef } from 'react';
import { Input } from '@/components/ui/input';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

const LENGTH = 6;

/**
 * Clean 6-digit OTP input: auto-focus, auto-advance between boxes,
 * backspace navigation and full paste support.
 */
export function OtpInput({ value, onChange, onComplete, disabled, autoFocus = true }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  const focusIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(LENGTH - 1, index));
    inputRefs.current[clamped]?.focus();
    inputRefs.current[clamped]?.select();
  };

  const emit = (arr: string[]) => {
    const next = arr.join('').replace(/\D/g, '');
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
    return next;
  };

  const setDigit = (index: number, digit: string) => {
    const arr = [...digits];
    arr[index] = digit;
    emit(arr);
    if (digit && index < LENGTH - 1) focusIndex(index + 1);
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length > 1) {
      // Multiple digits typed or pasted into one box: fill forward
      const arr = [...digits];
      for (let i = 0; i < cleaned.length && index + i < LENGTH; i++) {
        arr[index + i] = cleaned[i];
      }
      const next = emit(arr);
      focusIndex(Math.min(index + cleaned.length, LENGTH - 1));
      if (next.length === LENGTH) inputRefs.current[LENGTH - 1]?.blur();
      return;
    }
    setDigit(index, cleaned);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const arr = [...digits];
        arr[index - 1] = '';
        emit(arr);
        focusIndex(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusIndex(index - 1);
    } else if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      e.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    onChange(pasted);
    if (pasted.length === LENGTH) {
      inputRefs.current[LENGTH - 1]?.blur();
      onComplete?.(pasted);
    } else {
      focusIndex(pasted.length);
    }
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {digits.map((digit, i) => (
        <Input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          value={digit}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          className="h-12 w-11 sm:w-12 rounded-xl border-gray-200 bg-gray-50/60 text-center text-lg font-semibold text-foreground px-0 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200"
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
