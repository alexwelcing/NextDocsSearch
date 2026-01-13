import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { GameStats } from '../3d/game/ClickingGame';

interface LeaderboardEntry {
  id: number;
  player_name: string;
  score: number;
  combo_max: number;
  accuracy: number;
  created_at: string;
}

interface GameLeaderboardProps {
  playerScore: number;
  playerStats: GameStats;
  onPlayAgain: () => void;
  onClose: () => void;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
`;

const shine = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
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
  z-index: 102;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  animation: ${fadeIn} 0.3s ease-out;
`;

const ContentBox = styled.div`
  background: linear-gradient(135deg, rgba(3, 3, 8, 0.98), rgba(10, 10, 26, 0.98));
  padding: 40px;
  border-radius: 20px;
  border: 4px solid rgba(0, 212, 255, 0.5);
  box-shadow: 0 0 50px rgba(0, 212, 255, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
`;

const Title = styled.h1`
  color: white;
  font-size: 42px;
  font-weight: bold;
  margin: 0 0 10px 0;
  text-align: center;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
`;

const ScoreSummary = styled.div`
  background: rgba(0, 0, 0, 0.5);
  padding: 25px;
  border-radius: 15px;
  margin: 20px 0;
  text-align: center;
  border: 2px solid rgba(0, 212, 255, 0.4);
`;

const FinalScore = styled.div`
  color: #FFD700;
  font-size: 64px;
  font-weight: bold;
  text-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
  margin-bottom: 10px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-top: 15px;
`;

const StatItem = styled.div`
  color: white;
  font-size: 14px;
`;

const StatLabel = styled.div`
  color: #00d4ff;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 5px;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: bold;
`;

const LeaderboardSection = styled.div`
  margin: 30px 0;
`;

const SectionTitle = styled.h2`
  color: #00d4ff;
  font-size: 24px;
  margin: 0 0 15px 0;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const LeaderboardList = styled.div`
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  padding: 15px;
`;

const LeaderboardEntry = styled.div<{ isPlayer?: boolean; rank?: number }>`
  display: grid;
  grid-template-columns: 50px 1fr 100px;
  gap: 15px;
  padding: 15px;
  margin: 10px 0;
  background: ${props => {
    if (props.isPlayer) return 'linear-gradient(90deg, rgba(255, 215, 0, 0.3), rgba(255, 165, 0, 0.3))';
    if (props.rank === 1) return 'linear-gradient(90deg, rgba(255, 215, 0, 0.2), transparent)';
    if (props.rank === 2) return 'linear-gradient(90deg, rgba(192, 192, 192, 0.2), transparent)';
    if (props.rank === 3) return 'linear-gradient(90deg, rgba(205, 127, 50, 0.2), transparent)';
    return 'rgba(255, 255, 255, 0.05)';
  }};
  border-radius: 10px;
  border: 2px solid ${props => props.isPlayer ? '#FFD700' : 'transparent'};
  color: white;
  align-items: center;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.isPlayer
      ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.4), rgba(255, 165, 0, 0.4))'
      : 'rgba(255, 255, 255, 0.1)'};
    transform: translateX(5px);
  }
`;

const Rank = styled.div<{ rank: number }>`
  font-size: 28px;
  font-weight: bold;
  text-align: center;
  color: ${props => {
    if (props.rank === 1) return '#FFD700';
    if (props.rank === 2) return '#C0C0C0';
    if (props.rank === 3) return '#CD7F32';
    return '#00d4ff';
  }};
`;

const PlayerName = styled.div`
  font-size: 18px;
  font-weight: bold;
`;

const Score = styled.div`
  font-size: 24px;
  font-weight: bold;
  text-align: right;
  color: #FFD700;
`;

const NameInputSection = styled.div`
  background: rgba(0, 0, 0, 0.5);
  padding: 25px;
  border-radius: 15px;
  margin: 20px 0;
  border: 3px solid #FFD700;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
`;

const CongratulationsText = styled.div`
  color: #FFD700;
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 2px;
  background: linear-gradient(90deg, #FFD700, #FFA500, #FFD700);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shine} 2s linear infinite;
`;

const NameInput = styled.input`
  width: 100%;
  padding: 15px;
  font-size: 20px;
  border: 3px solid rgba(0, 212, 255, 0.5);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  text-align: center;
  margin-bottom: 15px;
  font-weight: bold;

  &:focus {
    outline: none;
    border-color: #FFD700;
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
`;

const Button = styled.button<{ primary?: boolean }>`
  background: ${props => props.primary
    ? 'linear-gradient(135deg, #FFD700, #FFA500)'
    : 'rgba(255, 255, 255, 0.1)'};
  border: 3px solid ${props => props.primary ? 'white' : 'rgba(0, 212, 255, 0.5)'};
  color: ${props => props.primary ? '#000' : 'white'};
  padding: 15px 40px;
  font-size: 20px;
  font-weight: bold;
  border-radius: 50px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 25px ${props => props.primary ? 'rgba(255, 215, 0, 0.8)' : 'rgba(0, 212, 255, 0.4)'};
  }

  &:active {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadingText = styled.div`
  color: #00d4ff;
  text-align: center;
  font-size: 18px;
  padding: 20px;
`;

const GameLeaderboard: React.FC<GameLeaderboardProps> = ({
  playerScore,
  playerStats,
  onPlayAgain,
  onClose,
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isTopFive, setIsTopFive] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/game/get-leaderboard');
      
      // Check if response is ok and has content
      if (!response.ok) {
        console.error('Leaderboard API error:', response.status, response.statusText);
        setLeaderboard([]);
        setIsTopFive(true); // Allow submission if API is down
        return;
      }

      const text = await response.text();
      if (!text) {
        console.warn('Empty response from leaderboard API');
        setLeaderboard([]);
        setIsTopFive(true);
        return;
      }

      const data = JSON.parse(text);
      const leaderboardData = data.leaderboard || [];
      setLeaderboard(leaderboardData);

      // Check if player made top 5
      if (leaderboardData.length < 5 || playerScore > leaderboardData[4]?.score) {
        setIsTopFive(true);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      setLeaderboard([]);
      setIsTopFive(true); // Allow submission even if fetch fails
    } finally {
      setLoading(false);
    }
  }, [playerScore]);

  // Fetch leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSubmitScore = async () => {
    if (!playerName.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/game/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName.trim(),
          score: playerStats.score,
          combo_max: playerStats.comboMax,
          accuracy: playerStats.accuracy,
          total_clicks: playerStats.totalClicks,
          successful_clicks: playerStats.successfulClicks,
        }),
      });

      if (response.ok) {
        setHasSubmitted(true);
        // Refresh leaderboard
        await fetchLeaderboard();
      }
    } catch (error) {
      console.error('Failed to submit score:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OverlayContainer>
      <ContentBox>
        <Title>Game Over!</Title>

        <ScoreSummary>
          <FinalScore>{playerScore.toLocaleString()}</FinalScore>
          <StatLabel>Final Score</StatLabel>

          <StatsGrid>
            <StatItem>
              <StatLabel>Max Combo</StatLabel>
              <StatValue>{playerStats.comboMax}x</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Accuracy</StatLabel>
              <StatValue>{playerStats.accuracy.toFixed(1)}%</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Hits</StatLabel>
              <StatValue>{playerStats.successfulClicks}</StatValue>
            </StatItem>
            <StatItem>
              <StatLabel>Total Clicks</StatLabel>
              <StatValue>{playerStats.totalClicks}</StatValue>
            </StatItem>
          </StatsGrid>
        </ScoreSummary>

        {isTopFive && !hasSubmitted && (
          <NameInputSection>
            <CongratulationsText>🏆 You Made the Top 5! 🏆</CongratulationsText>
            <NameInput
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitScore()}
              maxLength={20}
              autoFocus
            />
            <Button
              primary
              onClick={handleSubmitScore}
              disabled={!playerName.trim() || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Score'}
            </Button>
          </NameInputSection>
        )}

        <LeaderboardSection>
          <SectionTitle>🏆 Top 5 Leaderboard 🏆</SectionTitle>
          <LeaderboardList>
            {loading ? (
              <LoadingText>Loading leaderboard...</LoadingText>
            ) : leaderboard.length === 0 ? (
              <LoadingText>Be the first to set a high score!</LoadingText>
            ) : (
              leaderboard.map((entry, index) => (
                <LeaderboardEntry
                  key={entry.id}
                  rank={index + 1}
                  isPlayer={hasSubmitted && entry.player_name === playerName.trim()}
                >
                  <Rank rank={index + 1}>#{index + 1}</Rank>
                  <PlayerName>{entry.player_name}</PlayerName>
                  <Score>{entry.score.toLocaleString()}</Score>
                </LeaderboardEntry>
              ))
            )}
          </LeaderboardList>
        </LeaderboardSection>

        <ButtonGroup>
          <Button primary onClick={onPlayAgain}>
            Play Again
          </Button>
          <Button onClick={onClose}>
            Close
          </Button>
        </ButtonGroup>
      </ContentBox>
    </OverlayContainer>
  );
};

export default GameLeaderboard;
