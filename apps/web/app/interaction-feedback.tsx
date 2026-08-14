'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type FeedbackTone = 'success' | 'error' | 'info';

interface FeedbackMessage {
  readonly id: number;
  readonly message: string;
  readonly tone: FeedbackTone;
}

interface InteractionFeedbackValue {
  readonly notify: (message: string, tone?: FeedbackTone) => void;
}

const emptyFeedback: InteractionFeedbackValue = { notify: () => undefined };
const InteractionFeedbackContext = createContext<InteractionFeedbackValue>(emptyFeedback);

export function useInteractionFeedback(): InteractionFeedbackValue {
  return useContext(InteractionFeedbackContext);
}

export function InteractionFeedbackProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  const notify = useCallback((message: string, tone: FeedbackTone = 'info') => {
    setFeedback({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = window.setTimeout(() => setFeedback(null), 4_000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <InteractionFeedbackContext.Provider value={value}>
      {children}
      <div aria-atomic="true" aria-live="polite" className="interaction-feedback-region">
        {feedback ? (
          <div className={`interaction-toast interaction-toast--${feedback.tone}`} key={feedback.id} role={feedback.tone === 'error' ? 'alert' : 'status'}>
            <span aria-hidden="true" className="interaction-toast-mark" />
            <span>{feedback.message}</span>
            <button aria-label="Dispensar aviso" onClick={() => setFeedback(null)} type="button">×</button>
          </div>
        ) : null}
      </div>
    </InteractionFeedbackContext.Provider>
  );
}
