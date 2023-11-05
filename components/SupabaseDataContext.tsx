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
      const response = await fetch('/api/vector-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      setChatData({ question, response: data.response });
    } catch (error) {
      console.error('Failed to fetch response:', error);
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
