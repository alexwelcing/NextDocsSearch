/**
 * Quiz System Component
 * Interactive quiz interface for testing knowledge of article content
 */

import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../pages/api/quiz';

interface QuizSystemProps {
  articleFilename: string;
  articleTitle: string;
  onClose: () => void;
}

export default function QuizSystem({ articleFilename, articleTitle, onClose }: QuizSystemProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<boolean[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);

  // Fetch quiz questions
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/quiz', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filename: articleFilename }),
        });

        if (!response.ok) {
          throw new Error('Failed to load quiz');
        }

        const data = await response.json();
        setQuestions(data.questions);
        setAnsweredQuestions(new Array(data.questions.length).fill(false));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [articleFilename]);

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswerSelect = (answerIndex: number) => {
    if (showExplanation) return; // Don't allow changing answer after showing explanation

    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;

    setShowExplanation(true);

    // Update score if correct
    if (selectedAnswer === currentQuestion.correctAnswer && !answeredQuestions[currentQuestionIndex]) {
      setScore((prev) => prev + 1);
      const newAnswered = [...answeredQuestions];
      newAnswered[currentQuestionIndex] = true;
      setAnsweredQuestions(newAnswered);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setQuizComplete(true);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore(0);
    setAnsweredQuestions(new Array(questions.length).fill(false));
    setQuizComplete(false);
  };

  if (loading) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#4488ff',
        fontSize: '14px',
      }}>
        Generating quiz questions...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
      }}>
        <div style={{ color: '#ff6b6b', fontSize: '14px' }}>
          {error}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(68, 136, 255, 0.3)',
            border: '1px solid #4488ff',
            borderRadius: '4px',
            padding: '8px 16px',
            color: '#ffffff',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '16px',
      }}>
        <div style={{
          fontSize: '20px',
          color: '#00ff88',
          fontWeight: 'bold',
        }}>
          Quiz Complete!
        </div>
        <div style={{
          fontSize: '16px',
          color: '#ffffff',
        }}>
          Your Score: {score} / {questions.length}
        </div>
        <div style={{
          fontSize: '14px',
          color: percentage >= 80 ? '#00ff88' : percentage >= 60 ? '#FFD700' : '#ff6b6b',
        }}>
          {percentage}%
          {percentage >= 80 ? ' - Excellent!' : percentage >= 60 ? ' - Good job!' : ' - Keep studying!'}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            onClick={handleRestartQuiz}
            style={{
              background: 'linear-gradient(135deg, #4488ff, #00ff88)',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              color: '#ffffff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            Try Again
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(68, 136, 255, 0.3)',
              border: '1px solid #4488ff',
              borderRadius: '4px',
              padding: '8px 16px',
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px',
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(68, 136, 255, 0.3)',
      }}>
        <div style={{
          fontSize: '10px',
          color: '#888888',
          marginBottom: '4px',
        }}>
          Quiz: {articleTitle}
        </div>
        <div style={{
          fontSize: '12px',
          color: '#4488ff',
        }}>
          Question {currentQuestionIndex + 1} of {questions.length} • Score: {score}/{questions.length}
        </div>
      </div>

      {/* Question */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
      }}>
        <div style={{
          fontSize: '14px',
          color: '#00ff88',
          marginBottom: '16px',
          fontWeight: 'bold',
        }}>
          {currentQuestion.question}
        </div>

        {/* Options */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = index === currentQuestion.correctAnswer;
            const showCorrect = showExplanation && isCorrect;
            const showIncorrect = showExplanation && isSelected && !isCorrect;

            return (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                disabled={showExplanation}
                style={{
                  background: showCorrect
                    ? 'rgba(0, 255, 136, 0.2)'
                    : showIncorrect
                    ? 'rgba(255, 107, 107, 0.2)'
                    : isSelected
                    ? 'rgba(68, 136, 255, 0.3)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: showCorrect
                    ? '2px solid #00ff88'
                    : showIncorrect
                    ? '2px solid #ff6b6b'
                    : isSelected
                    ? '2px solid #4488ff'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  padding: '12px',
                  color: '#ffffff',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: showExplanation ? 'default' : 'pointer',
                  fontFamily: 'monospace',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontWeight: 'bold', marginRight: '8px' }}>
                  {String.fromCharCode(65 + index)}.
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(68, 136, 255, 0.1)',
            borderLeft: '3px solid #4488ff',
            borderRadius: '4px',
          }}>
            <div style={{
              fontSize: '11px',
              color: '#4488ff',
              marginBottom: '4px',
              fontWeight: 'bold',
            }}>
              Explanation:
            </div>
            <div style={{
              fontSize: '11px',
              color: '#ffffff',
            }}>
              {currentQuestion.explanation}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(68, 136, 255, 0.3)',
      }}>
        {currentQuestionIndex > 0 && (
          <button
            onClick={handlePreviousQuestion}
            style={{
              background: 'rgba(68, 136, 255, 0.3)',
              border: '1px solid #4488ff',
              borderRadius: '4px',
              padding: '8px 12px',
              color: '#ffffff',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            ← Previous
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            padding: '8px 12px',
            color: '#ffffff',
            fontSize: '11px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          Close
        </button>

        <div style={{ flex: 1 }} />

        {!showExplanation ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedAnswer === null}
            style={{
              background: selectedAnswer === null
                ? 'rgba(68, 136, 255, 0.2)'
                : 'linear-gradient(135deg, #4488ff, #00ff88)',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              color: selectedAnswer === null ? '#666666' : '#ffffff',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: selectedAnswer === null ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace',
            }}
          >
            Submit
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            style={{
              background: 'linear-gradient(135deg, #4488ff, #00ff88)',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            {currentQuestionIndex < questions.length - 1 ? 'Next →' : 'Finish'}
          </button>
        )}
      </div>
    </div>
  );
}
