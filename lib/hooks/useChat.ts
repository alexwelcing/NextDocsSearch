import { useState, useEffect, useCallback, useRef } from 'react';
import { useJourney } from '@/components/contexts/JourneyContext';
import { extractShipSignals, shipPersona } from '@/lib/ai/shipPersona';
import {
  buildStructuredAnswer,
  createIdleAnswerState,
  parseShipStreamEvent,
  type ShipAnswerState,
} from '@/lib/chat/shipAnswer';

export const SHIP_AI_IDLE_MESSAGE = 'Ship AI online. Ask something worth answering.'
export const SHIP_AI_LOADING_MESSAGE = 'Hang on. I\'m digging through the archive for something less useless than the average chatbot answer.'
export const SHIP_AI_ERROR_MESSAGE = 'The Hugging Face link coughed up a hairball. Ask again and I\'ll take another swing at it.'

export function isShipAiIdleMessage(message: string): boolean {
  return message === SHIP_AI_IDLE_MESSAGE
}

export function isShipAiLoadingMessage(message: string): boolean {
  return message === SHIP_AI_LOADING_MESSAGE
}

export function isShipAiErrorMessage(message: string): boolean {
  return message === SHIP_AI_ERROR_MESSAGE
}

export interface ChatData extends ShipAnswerState {}

export interface ArticleChatContext {
  slug?: string;
  title?: string;
  articleType?: 'fiction' | 'research';
  description?: string;
  keywords?: string[];
  content?: string;
}

export interface ChatTurn {
  question: string;
  response: string;
}

export function useChat() {
  const [chatData, setChatData] = useState<ChatData>({
    ...createIdleAnswerState(SHIP_AI_IDLE_MESSAGE)
  });

  const [chatHistory, setChatHistory] = useState<ChatTurn[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(shipPersona.memory.storageKey);
      if (saved) {
        try {
          return JSON.parse(saved) as ChatTurn[];
        } catch (error) {
          console.error('Failed to parse chat history:', error);
        }
      }
    }
    return [];
  });

  const { currentQuest, progress, missionBriefs, applyAiSignals } = useJourney();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(shipPersona.memory.storageKey, JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  const sendMessage = useCallback(async (question: string, options?: { articleContext?: ArticleChatContext }) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      // Set initial state for new message
      setChatData({
        question,
        response: SHIP_AI_LOADING_MESSAGE,
        instantResults: [],
        structuredAnswer: null,
        status: 'loading',
      });

      const historyPayload = chatHistory
        .slice(-shipPersona.memory.maxInteractions)
        .filter(entry => entry.question && entry.response);

      const response = await fetch('/api/vector-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: question,
          history: historyPayload,
          articleContext: options?.articleContext,
          questContext: {
            currentQuest,
            currentPhase: progress.currentPhase,
            completedQuests: progress.completedQuests,
            missionBrief: currentQuest ? missionBriefs[currentQuest.id] : undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let rawPayload = '';
      let finalAnswer = '';
      let structuredAnswer = null;
      let provider: string | undefined;
      let streamedSignalsApplied = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        rawPayload += chunk;

        const lines = rawPayload.split('\n');
        rawPayload = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const event = parseShipStreamEvent(trimmed);
          if (!event) {
            finalAnswer += trimmed;
            const { cleanMessage } = extractShipSignals(finalAnswer);
            setChatData(prev => ({
              ...prev,
              response: cleanMessage,
              structuredAnswer: cleanMessage ? buildStructuredAnswer(cleanMessage) : null,
              status: 'loading',
            }));
            continue;
          }

          if (event.type === 'instant-results') {
            setChatData(prev => ({
              ...prev,
              question: event.question,
              instantResults: event.items,
              status: 'loading',
            }));
          }

          if (event.type === 'answer-delta') {
            finalAnswer = event.answer;
            const { cleanMessage } = extractShipSignals(event.answer);

            setChatData(prev => ({
              ...prev,
              question: event.question,
              response: cleanMessage,
              structuredAnswer: cleanMessage ? buildStructuredAnswer(cleanMessage) : prev.structuredAnswer,
              status: 'loading',
            }));
          }

          if (event.type === 'final-answer') {
            finalAnswer = event.answer;
            structuredAnswer = event.structuredAnswer;
            provider = event.provider;
            if (event.signals?.length) {
              applyAiSignals(event.signals);
              streamedSignalsApplied = true;
            }

            setChatData(prev => ({
              ...prev,
              question: event.question,
              response: event.answer,
              structuredAnswer: event.structuredAnswer,
              provider: event.provider,
              status: 'complete',
            }));
          }

          if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }

      if (rawPayload.trim()) {
        finalAnswer += rawPayload.trim();
      }

      if (!finalAnswer) {
        setChatData(prev => ({ ...prev, response: 'No response received.', status: 'error' }));
        return;
      }

      const { cleanMessage, signals } = extractShipSignals(finalAnswer);
      const cleanedStructuredAnswer = structuredAnswer ?? (cleanMessage
        ? buildStructuredAnswer(cleanMessage)
        : null);

      setChatData(prev => ({
        ...prev,
        question,
        response: cleanMessage,
        structuredAnswer: cleanedStructuredAnswer,
        provider,
        status: 'complete',
      }));
      if (!streamedSignalsApplied) {
        applyAiSignals(signals);
      }

      setChatHistory(prev => {
        const updated = [...prev, { question, response: cleanMessage }];
        return updated.slice(-shipPersona.memory.maxInteractions);
      });
    } catch (error) {
      console.error('Failed to fetch response:', error);
      setChatData(prev => ({
        ...prev,
        response: SHIP_AI_ERROR_MESSAGE,
        structuredAnswer: null,
        status: 'error',
      }));
    } finally {
      isProcessingRef.current = false;
    }
  }, [chatHistory, currentQuest, progress, missionBriefs, applyAiSignals]);

  return {
    chatData,
    setChatData,
    chatHistory,
    sendMessage
  };
}
