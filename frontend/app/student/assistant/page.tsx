"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../../components/auth/auth-context';
import { getSubmissions, STAGES, STAGE_LABELS } from '../../../lib/store';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'What is required for my Proposal?',
  'What should Chapter 2 contain?',
  'Why might my submission be revised?',
  'How do I write a strong Methodology?',
  'What belongs in the Final Report?',
  'How are the 7 stages structured?',
];

function AssistantAvatar() {
  return (
    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 text-sm"
      style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
      🤖
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end`}>
      {!isUser && <AssistantAvatar />}
      <div
        className="max-w-[85%] sm:max-w-[78%] rounded-2xl px-3 sm:px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
        style={isUser
          ? { background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', borderBottomRightRadius: 4 }
          : { background: 'var(--bg-surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }
        }
      >
        {msg.content || <span style={{ opacity: 0.4 }}>▌</span>}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-2 sm:gap-3 items-end">
      <AssistantAvatar />
      <div className="rounded-2xl px-4 py-3 flex gap-1.5 items-center"
        style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-bounce"
            style={{ background: 'var(--text-3)', animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function StudentAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages]           = useState<Message[]>([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [studentContext, setStudentContext] = useState('');
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    getSubmissions().then(subs => {
      const mine = subs.filter(s => s.studentId === user.id);
      const approvedStages = STAGES.filter(st =>
        mine.filter(s => s.stage === st).sort((a, b) => b.version - a.version)[0]?.status === 'APPROVED'
      );
      const currentStage = STAGES.find(st => {
        const latest = mine.filter(s => s.stage === st).sort((a, b) => b.version - a.version)[0];
        return !latest || latest.status !== 'APPROVED';
      }) ?? STAGES[STAGES.length - 1];

      setStudentContext(
        `Student name: ${user.name}\n` +
        `Current stage: ${STAGE_LABELS[currentStage]} (${currentStage})\n` +
        `Approved stages: ${approvedStages.length > 0 ? approvedStages.map(s => STAGE_LABELS[s]).join(', ') : 'None yet'}\n` +
        `Submissions awaiting review: ${mine.filter(s => s.status === 'PENDING').length}\n` +
        `Submissions needing revision: ${mine.filter(s => s.status === 'REVISION_REQUIRED').length}`
      );
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLoading(true);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, studentContext }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${err.error}` }]);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: assistantText };
          return copy;
        });
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not connect. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, studentContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col gap-3 max-w-3xl mx-auto">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--info-text)' }}>Student</p>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-1)' }}>AI Assistant</h1>
        <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-3)' }}>Ask about submission requirements, stages, or revision guidance.</p>
      </div>

      {/* Message area — responsive height using small viewport height units */}
      <div
        className="overflow-y-auto rounded-2xl p-3 sm:p-4 space-y-3 sm:space-y-4"
        style={{
          height: 'max(240px, calc(100svh - 300px))',
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 sm:gap-6 py-4">
            <div className="text-center px-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mx-auto mb-3"
                style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(124,58,237,0.12))' }}>
                🤖
              </div>
              <h2 className="text-sm sm:text-base font-semibold mb-1" style={{ color: 'var(--text-1)' }}>How can I help you?</h2>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-3)' }}>
                I know everything about the 7 IPMS submission stages. Ask me anything about what's required.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center px-2 w-full">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading}
                  className="text-xs rounded-xl px-3 py-2 transition-all text-left"
                  style={{
                    background: 'var(--hover-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-2)',
                    maxWidth: '100%',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--info-border)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && messages[messages.length - 1]?.role !== 'assistant' && <TypingBubble />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="rounded-2xl p-2.5 sm:p-3 flex gap-2 sm:gap-3 items-end"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
          placeholder="Ask about submission requirements…"
          className="flex-1 resize-none bg-transparent text-sm outline-none min-w-0"
          style={{
            color: 'var(--text-1)',
            lineHeight: '1.5',
            maxHeight: 120,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
          style={{
            background: (loading || !input.trim()) ? 'var(--hover-bg)' : 'linear-gradient(135deg,#2563eb,#4f46e5)',
            color: (loading || !input.trim()) ? 'var(--text-3)' : '#fff',
          }}
        >
          {loading ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {/* Keyboard hint — hidden on mobile */}
      <p className="hidden sm:block text-center text-[10px]" style={{ color: 'var(--text-3)' }}>
        Press <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
