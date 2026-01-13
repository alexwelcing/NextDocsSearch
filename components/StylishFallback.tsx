import React from 'react';
import styled from 'styled-components';

const FallbackContainer = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #030308;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LoadingContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 2px solid rgba(0, 212, 255, 0.1);
  border-top-color: rgba(0, 212, 255, 0.8);
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadingText = styled.div`
  font-family: 'Inter', -apple-system, sans-serif;
  font-size: 14px;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.15em;
  text-transform: uppercase;
`;

const StylishFallback: React.FC = () => {
  return (
    <FallbackContainer>
      <LoadingContent>
        <Spinner />
        <LoadingText>Loading Experience</LoadingText>
      </LoadingContent>
    </FallbackContainer>
  );
};

export default StylishFallback;
