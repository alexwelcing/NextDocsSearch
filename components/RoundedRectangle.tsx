// RoundedRectangle.tsx
import React, { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useSupabaseData } from './SupabaseDataContext';
import styles from '../styles/RetroComputerStyles.module.css';

const RoundedRectangle: React.FC = () => {
  const groupRef = useRef<THREE.Group | null>(null);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { setChatData } = useSupabaseData(); // Destructure setChatData from the context hook

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/vector-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: query }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid content-type. Expected application/json');
      }

      const data = await response.json();
      const answer = data.answers[0];
      setResponse(answer);
      setChatData({ question: query, response: answer });
    } catch (err) {
      setError('Failed to fetch response');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <group ref={groupRef} position={[12, 0, 5]} rotation={[0, Math.PI / -2, 0]}>
      <Html position={[-4.5, 2.2, 0.26]} transform occlude>
        <div className={styles.container}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question..."
              className={styles.input}
            />
            <button
              type="submit"
              disabled={isLoading}
              className={`${styles.button} ${isLoading ? styles.buttonDisabled : ''}`}
            >
              Send
            </button>
          </form>
          {isLoading && <div>Loading...</div>}
          {error && <div>Error: {error}</div>}
          {response && <div>Response: {response}</div>}
        </div>
      </Html>
    </group>
  );
};

export default RoundedRectangle;
