import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ArrowRight, ArrowUp, Eraser, Loader2, ShieldCheck, Sparkles, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

const uid = () => Math.random().toString(36).slice(2);

// ---- tiny, safe markdown renderer (bold, bullets, numbered lists, line breaks) ----
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={blocks.length} className={cn('my-1.5 space-y-1 pl-5', list.ordered ? 'list-decimal' : 'list-disc')}>
        {list.items.map((it, i) => (
          <li key={i}>{renderInline(it)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet || numbered)![1]);
      return;
    }
    flush();
    if (line.trim() === '') return;
    blocks.push(
      <p key={blocks.length} className="my-1">
        {renderInline(line.replace(/^#{1,6}\s+/, ''))}
      </p>,
    );
  });
  flush();
  return <>{blocks}</>;
}

const SUGGESTIONS: Record<string, string[]> = {
  super_admin: [
    'Which stores haven’t sent today’s daily report?',
    'Which onboardings are stuck and what’s the next step?',
    'Which documents are overdue or expiring this month?',
    'Who is working today across all stores?',
    'Who is on leave this week?',
  ],
  hr: [
    'Which onboardings are in progress and what’s next for each?',
    'Which contracts are waiting for approval?',
    'Which documents are overdue or expiring this month?',
    'Who is on leave or has pending leave requests?',
    'Which shifts are still waiting for staff to confirm?',
  ],
  manager: [
    'Who is working at my store today?',
    'Has my store sent today’s daily report?',
    'Who is on leave this week?',
    'Which shifts are still waiting for staff to confirm?',
    'Any open maintenance tickets at my store?',
  ],
  employee: [
    'When is my next shift?',
    'What shifts do I have this week?',
    'What is the status of my leave requests?',
    'How do I request leave?',
    'Any upcoming events?',
  ],
};

const WIDGET_CSS = `
@keyframes nzai-pulse { 0% { transform: scale(1); opacity: .55 } 70% { transform: scale(1.55); opacity: 0 } 100% { opacity: 0 } }
@keyframes nzai-spin { to { transform: rotate(360deg) } }
@keyframes nzai-drift { 0%,100% { transform: translate3d(0,0,0) } 50% { transform: translate3d(-18px,8px,0) } }
.nzai-halo { background: rgba(52,199,120,.55); animation: nzai-pulse 2.6s ease-out infinite; }
.nzai-ring { background: conic-gradient(from 0deg, transparent 0 60%, rgba(255,255,255,.9) 75%, transparent 90%); -webkit-mask: radial-gradient(circle, transparent 62%, #000 64%); mask: radial-gradient(circle, transparent 62%, #000 64%); animation: nzai-spin 3.2s linear infinite; }
.nzai-aurora { background: radial-gradient(60% 80% at 85% 0%, rgba(253,224,71,.35), transparent 60%), radial-gradient(50% 70% at 10% 10%, rgba(255,255,255,.18), transparent 60%); animation: nzai-drift 9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .nzai-halo, .nzai-ring, .nzai-aurora { animation: none } }
`;

export default function AiAssistantSidebar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/reset-password') || pathname.startsWith('/verify');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const role = user?.role ?? 'employee';
  const suggestions = useMemo(() => SUGGESTIONS[role] ?? SUGGESTIONS.employee, [role]);
  const scopeText =
    role === 'super_admin'
      ? 'All organisations & stores'
      : role === 'hr'
        ? user?.hrAccessLevel === 'full'
          ? 'All organisations & stores'
          : user?.hrAccessLevel === 'organization'
            ? 'Your organisation'
            : 'Your assigned stores'
        : role === 'manager'
          ? 'Your store(s)'
          : 'Your own records';

  // Keyboard shortcut: Ctrl/Cmd + J
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  // Clear conversation when the signed-in user changes (never leak another user's data)
  useEffect(() => {
    setMessages([]);
  }, [user?.id]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;

      const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
      const botId = uid();
      const history = [...messages, userMsg];
      setMessages([...history, { id: botId, role: 'assistant', content: '' }]);
      setInput('');
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (content: string, error = false) =>
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, content, error } : m)));

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Your session has expired. Please sign in again.');

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        });

        if (!res.ok || !res.body) {
          let msg = 'The assistant is unavailable right now.';
          try {
            msg = (await res.json()).error || msg;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let answer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
              if (delta) {
                answer += delta;
                patch(answer);
              }
            } catch {
              /* partial JSON, ignore */
            }
          }
        }
        if (!answer) patch('I couldn’t generate an answer. Please try rephrasing your question.', true);
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setMessages((prev) => prev.map((m) => (m.id === botId && !m.content ? { ...m, content: 'Stopped.' } : m)));
        } else {
          patch(e?.message || 'Something went wrong.', true);
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages],
  );

  if (!user) return null;
  if (isPublicPage) return null;

  return createPortal(
    <>
      <style>{WIDGET_CSS}</style>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Niza AI"
          title="Ask Niza AI (Ctrl+J)"
          className="nzai-launch group fixed bottom-5 right-5 z-[70] flex h-[60px] items-center rounded-full pl-[60px] pr-0 text-white transition-all duration-300 hover:pr-5 sm:bottom-7 sm:right-7"
        >
          {/* glow halo */}
          <span className="nzai-halo pointer-events-none absolute left-0 top-0 h-[60px] w-[60px] rounded-full" />
          {/* orb */}
          <span className="absolute left-0 top-0 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gradient-to-br from-[#0b7a4f] via-[#14905c] to-[#7cc243] shadow-[0_12px_30px_-8px_rgba(6,95,70,0.7),inset_0_2px_6px_rgba(255,255,255,0.45)] ring-1 ring-white/40 transition-transform duration-300 group-hover:scale-105">
            <span className="nzai-ring pointer-events-none absolute inset-[-3px] rounded-full" />
            <Sparkles className="relative h-6 w-6 drop-shadow transition-transform duration-500 group-hover:rotate-[18deg]" />
            <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white bg-lime-300" />
          </span>
          {/* label revealed on hover */}
          <span className="pointer-events-none ml-0 max-w-0 overflow-hidden whitespace-nowrap rounded-full bg-gradient-to-r from-[#0b7a4f] to-[#4fae3e] py-2 text-sm font-semibold opacity-0 shadow-lg transition-all duration-300 group-hover:ml-3 group-hover:max-w-[160px] group-hover:px-4 group-hover:opacity-100">
            Ask Niza AI
          </span>
        </button>
      )}

      {/* Sidebar */}
      <aside
        aria-hidden={!open}
        className={cn(
          'fixed z-[70] flex flex-col overflow-hidden bg-white/95 backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'inset-0 sm:inset-auto sm:bottom-7 sm:right-7 sm:h-[min(660px,calc(100dvh-56px))] sm:w-[410px] sm:rounded-[28px] sm:border sm:border-white',
          'shadow-[0_30px_80px_-20px_rgba(6,60,40,0.45),0_0_0_1px_rgba(16,120,80,0.08)] origin-bottom-right',
          open ? 'pointer-events-auto opacity-100 scale-100 translate-y-0' : 'pointer-events-none opacity-0 scale-90 translate-y-6',
        )}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0b6b45] via-[#11845a] to-[#5fae3c] px-5 pb-5 pt-5 text-white">
          <div className="nzai-aurora pointer-events-none absolute inset-0" />
          <svg className="pointer-events-none absolute -bottom-px left-0 h-6 w-full text-white/95" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 24 L0 14 C 80 2, 160 22, 240 12 C 310 4, 360 10, 400 6 L400 24 Z" fill="currentColor" />
          </svg>
          <div className="relative flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/40 backdrop-blur">
              <Sparkles className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#11845a] bg-lime-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold leading-tight">Niza AI</h2>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-white/80">
                <ShieldCheck className="h-3 w-3" />
                {scopeText}
              </p>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/15 hover:text-white" title="Clear chat" onClick={() => (stop(), setMessages([]))}>
                <Eraser className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/15 hover:text-white" title="Close" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col justify-center">
              <div className="mb-5 text-left">
                <p className="text-xl font-semibold tracking-tight text-foreground">Hi {user.name?.split(' ')[0] || 'there'} 👋</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask me anything about your live data. I only see what your role allows.
                </p>
              </div>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="group/s flex w-full items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60 px-4 py-3 text-left text-sm text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="flex-1">{s}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-primary opacity-0 transition-all group-hover/s:translate-x-0.5 group-hover/s:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : m.error
                        ? 'rounded-bl-md border border-destructive/30 bg-destructive/10 text-destructive'
                        : 'rounded-bl-md border border-border bg-muted/60 text-foreground',
                  )}
                >
                  {m.role === 'assistant' && !m.content ? (
                    <span className="inline-flex items-center gap-1.5 py-1 text-muted-foreground">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                    </span>
                  ) : m.role === 'assistant' ? (
                    <RichText text={m.content} />
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-card px-4 pb-4 pt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-sm transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15"
          >
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about shifts, reports, documents…"
              className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {busy ? (
              <Button type="button" size="icon" variant="secondary" className="h-9 w-9 shrink-0 rounded-xl" onClick={stop} title="Stop">
                {input ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5 fill-current" />}
              </Button>
            ) : (
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={!input.trim()} title="Send">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            AI can make mistakes. Check important details. · Ctrl+J to toggle
          </p>
        </div>
      </aside>
    </>,
    document.body,
  );
}
