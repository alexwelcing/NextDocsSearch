// SupabaseDataContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

interface SupabaseDataContextProps {
  supabaseData: SupabaseData[];
  setSupabaseData: React.Dispatch<React.SetStateAction<SupabaseData[]>>;
  chatData: ChatData;
  setChatData: React.Dispatch<React.SetStateAction<ChatData>>;
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

  const fetchResponse = async (question: string) => {
    try {
      // Set loading state
      setChatData(prev => ({ ...prev, response: 'Thinking...' }));

      const response = await fetch('/api/vector-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: question }), // API expects 'prompt' not 'question'
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
      }
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
    <SupabaseDataContext.Provider value={{ supabaseData, setSupabaseData, chatData, setChatData }}>
      {children}
    </SupabaseDataContext.Provider>
  );
};
