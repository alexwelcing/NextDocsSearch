import React from 'react';
import styled, { keyframes } from 'styled-components';

interface GameStartOverlayProps {
  onStart: () => void;
}

const pulse = keyframes`
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.05); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const OverlayContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  z-index: 101;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
`;

const ContentBox = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, rgba(130, 20, 160, 0.95), rgba(148, 25, 71, 0.95));
  padding: 40px 60px;
  border-radius: 20px;
  border: 4px solid #de7ea2;
  box-shadow: 0 0 40px rgba(222, 126, 162, 0.6);
  text-align: center;
  max-width: 600px;
`;

const Title = styled.h1`
  color: white;
  font-size: 48px;
  font-weight: bold;
  margin: 0 0 20px 0;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 3px;
`;

const Subtitle = styled.h2`
  color: #de7ea2;
  font-size: 24px;
  margin: 0 0 30px 0;
  font-weight: normal;
`;

const Instructions = styled.div`
  background: rgba(0, 0, 0, 0.5);
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 30px;
  text-align: left;
`;

const InstructionItem = styled.div`
  color: white;
  font-size: 16px;
  margin: 10px 0;
  display: flex;
  align-items: center;
  gap: 15px;

  &:before {
    content: '●';
    color: #de7ea2;
    font-size: 24px;
  }
`;

const StartButton = styled.button`
  background: linear-gradient(135deg, #FFD700, #FFA500);
  border: 4px solid white;
  color: #000;
  padding: 20px 50px;
  font-size: 28px;
  font-weight: bold;
  border-radius: 50px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 2px;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
  transition: all 0.3s ease;
  animation: ${pulse} 2s infinite;

  &:hover {
    background: linear-gradient(135deg, #FFA500, #FFD700);
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 0 50px rgba(255, 215, 0, 1);
  }

  &:active {
    transform: translate(-50%, -50%) scale(0.95);
  }
`;

const OrbIcon = styled.div`
  display: inline-block;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00BFFF, #0080FF);
  box-shadow: 0 0 15px rgba(0, 191, 255, 0.8);
  animation: ${float} 2s ease-in-out infinite;
  margin: 0 5px;
`;

const GoldenOrbIcon = styled(OrbIcon)`
  background: linear-gradient(135deg, #FFD700, #FFA500);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
`;

const GameStartOverlay: React.FC<GameStartOverlayProps> = ({ onStart }) => {
  return (
    <OverlayContainer>
      <ContentBox>
        <Title>Sphere Hunter</Title>
        <Subtitle>360° Clicking Challenge</Subtitle>

        <Instructions>
          <InstructionItem>
            Click <OrbIcon /> blue orbs for <strong>10 points</strong>
          </InstructionItem>
          <InstructionItem>
            Click <GoldenOrbIcon /> golden orbs for <strong>30 points</strong>
          </InstructionItem>
          <InstructionItem>
            Hit <strong>3+ in a row</strong> for <strong>2x multiplier</strong>
          </InstructionItem>
          <InstructionItem>
            Hit <strong>5+ in a row</strong> for <strong>3x multiplier</strong>
          </InstructionItem>
          <InstructionItem>
            Score as many points as you can in <strong>30 seconds!</strong>
          </InstructionItem>
        </Instructions>

        <StartButton onClick={onStart}>
          Start Game
        </StartButton>
      </ContentBox>
    </OverlayContainer>
  );
};

export default GameStartOverlay;
