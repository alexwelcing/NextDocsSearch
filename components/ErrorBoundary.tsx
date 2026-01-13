/**
 * ErrorBoundary - Catch and handle React errors gracefully
 *
 * Prevents the entire app from crashing when a component error occurs.
 * Shows a user-friendly fallback UI and logs errors for debugging.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for catching React component errors
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI with improved styling
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 10, 10, 0.95)',
            color: '#fff',
            fontFamily: 'monospace',
            padding: '20px',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '30px',
              background: 'rgba(26, 26, 26, 0.9)',
              border: '1px solid #333',
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                marginBottom: '16px',
              }}
            >
              ⚠️
            </div>
            <h2
              style={{
                fontSize: '18px',
                color: '#ff6b6b',
                marginBottom: '12px',
                margin: 0,
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#aaa',
                marginBottom: '20px',
                lineHeight: 1.5,
              }}
            >
              An error occurred while rendering this component. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details
                style={{
                  marginBottom: '20px',
                  textAlign: 'left',
                  fontSize: '12px',
                  color: '#666',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    marginBottom: '8px',
                    color: '#888',
                  }}
                >
                  Error details
                </summary>
                <pre
                  style={{
                    background: '#111',
                    padding: '12px',
                    borderRadius: '6px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    textAlign: 'left',
                    margin: 0,
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(0, 212, 255, 0.15)',
                  border: '1px solid rgba(0, 212, 255, 0.4)',
                  borderRadius: '6px',
                  color: '#00d4ff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255, 107, 107, 0.15)',
                  border: '1px solid rgba(255, 107, 107, 0.4)',
                  borderRadius: '6px',
                  color: '#ff6b6b',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Convenience wrapper for 3D scene errors
 */
export function Scene3DErrorBoundary({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <ErrorBoundary
      fallback={
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0f',
            color: '#666',
            fontFamily: 'monospace',
            fontSize: '14px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <div>Failed to load 3D scene</div>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
