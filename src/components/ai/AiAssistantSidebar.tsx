import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUp, Eraser, Loader2, ShieldCheck, Sparkles, Square, X } from 'lucide-react';
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
    'Which store sent the daily report first today?',
    'Which branches have not sent their daily report today?',
    'Who is clocked in right now?',
    'Summarise today across all stores',
  ],
  hr: [
    'Which store sent the daily report first today?',
    'Who has leave coming up?',
    'How many employees are active vs deactivated?',
    'Which documents are overdue?',
  ],
  manager: [
    'Has my store sent today’s daily report?',
    'Who is clocked in at my store right now?',
    'Any open maintenance tickets?',
    'Who is on leave soon?',
  ],
  employee: [
    'When did I last clock in?',
    'What is the status of my leave requests?',
    'Any upcoming events?',
    'How do I request leave?',
  ],
};

export default function AiAssistantSidebar() {
  const { user } = useAuth();
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

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Ask Niza AI (Ctrl+J)"
          className="group fixed bottom-6 right-6 z-40 flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent pl-4 pr-5 text-white shadow-[0_10px_30px_-8px_rgba(6,95,70,0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-8px_rgba(6,95,70,0.7)] active:scale-95"
        >
          <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12" />
          <span className="text-sm font-semibold">Ask AI</span>
        </button>
      )}

      {/* Sidebar */}
      <aside
        aria-hidden={!open}
        className={cn(
          'fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-border bg-card shadow-[-20px_0_50px_-20px_rgba(16,40,30,0.25)] transition-transform duration-300 ease-out sm:w-[420px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border px-5 py-4">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-tight text-foreground">Niza AI</h2>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-primary" />
                Scope: {scopeText}
              </p>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Clear chat" onClick={() => (stop(), setMessages([]))}>
                <Eraser className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Close" onClick={() => setOpen(false)}>
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
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-secondary"
                  >
                    {s}
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
              placeholder="Ask about reports, staff, clock-ins…"
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
    </>
  );
}
