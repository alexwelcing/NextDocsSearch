import { useState, useEffect, useCallback, useRef } from 'react';
import { useJourney } from '@/components/contexts/JourneyContext';
import {
  extractShipSignals,
  extractGamificationSignals,
  shipPersona,
} from '@/lib/ai/shipPersona';

export interface ChatData {
  question: string;
  response: string;
}

export interface ChatTurn {
  question: string;
  response: string;
}

export function useChat() {
  const [chatData, setChatData] = useState<ChatData>({ 
    question: '', 
    response: 'Ship AI online. What do you need?' 
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

  const sendMessage = useCallback(async (question: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      // Set initial state for new message
      setChatData({ question, response: 'Processing...' });
      
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
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;

        // Update response as it streams in
        setChatData(prev => ({ ...prev, response: fullResponse }));
      }

      if (!fullResponse) {
        setChatData(prev => ({ ...prev, response: 'No response received.' }));
        return;
      }

      const { cleanMessage, signals } = extractShipSignals(fullResponse);
      setChatData({ question, response: cleanMessage });
      // Only pass gamification signals to the journey context
      applyAiSignals(extractGamificationSignals(signals));
      
      setChatHistory(prev => {
        const updated = [...prev, { question, response: cleanMessage }];
        return updated.slice(-shipPersona.memory.maxInteractions);
      });
    } catch (error) {
      console.error('Failed to fetch response:', error);
      setChatData(prev => ({
        ...prev,
        response: 'System error. Try again.',
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
