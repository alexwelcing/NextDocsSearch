// SupabaseDataContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useJourney } from './JourneyContext';
import { extractShipSignals, shipPersona } from '../lib/ai/shipPersona';

interface SupabaseData {
  id: number;
  page_id: number;
  content: string;
  token_count: number;
  embedding: number[];
  slug: string;
  heading: string;
}

interface ChatData {
  question: string;
  response: string;
}

interface ChatTurn {
  question: string;
  response: string;
}

interface SupabaseDataContextProps {
  supabaseData: SupabaseData[];
  setSupabaseData: React.Dispatch<React.SetStateAction<SupabaseData[]>>;
  chatData: ChatData;
  setChatData: React.Dispatch<React.SetStateAction<ChatData>>;
  chatHistory: ChatTurn[];
}

const SupabaseDataContext = createContext<SupabaseDataContextProps | undefined>(undefined);

export const useSupabaseData = (): SupabaseDataContextProps => {
  const context = useContext(SupabaseDataContext);
  if (!context) {
    throw new Error('useSupabaseData must be used within a SupabaseDataProvider');
  }
  return context;
};

interface SupabaseDataProviderProps {
  children: ReactNode;
}

export const SupabaseDataProvider: React.FC<SupabaseDataProviderProps> = ({ children }) => {
  const [supabaseData, setSupabaseData] = useState<SupabaseData[]>([]);
  const [chatData, setChatData] = useState<ChatData>({ question: '', response: 'Waiting for your question...' });
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(shipPersona.memory.storageKey, JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  const fetchResponse = async (question: string) => {
    try {
      // Set loading state
      setChatData(prev => ({ ...prev, response: 'Thinking...' }));
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
        setChatData({ question, response: fullResponse });
      }

      if (!fullResponse) {
        setChatData({ question, response: 'No response received.' });
        return;
      }

      const { cleanMessage, signals } = extractShipSignals(fullResponse);
      setChatData({ question, response: cleanMessage });
      applyAiSignals(signals);
      setChatHistory(prev => {
        const updated = [...prev, { question, response: cleanMessage }];
        return updated.slice(-shipPersona.memory.maxInteractions);
      });
    } catch (error) {
      console.error('Failed to fetch response:', error);
      setChatData({ question, response: 'Sorry, I could not get a response. Please try again.' });
    }
  };

  useEffect(() => {
    if (chatData.question) {
      fetchResponse(chatData.question);
    }
  }, [chatData.question]);

  return (
    <SupabaseDataContext.Provider value={{ supabaseData, setSupabaseData, chatData, setChatData, chatHistory }}>
      {children}
    </SupabaseDataContext.Provider>
  );
};
