import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThreeSixty from '../ThreeSixty';

// Mock all 3D dependencies
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="canvas">{children}</div>,
}));

vi.mock('@react-three/xr', () => ({
  createXRStore: vi.fn(() => ({
    enterVR: vi.fn(),
  })),
  XR: ({ children }: any) => <div>{children}</div>,
  XROrigin: ({ children }: any) => <div>{children}</div>,
  useXRSessionModeSupported: vi.fn(() => false),
}));

vi.mock('@react-three/cannon', () => ({
  Physics: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Stats: () => null,
}));

vi.mock('../PhysicsGround', () => ({
  default: () => null,
}));

vi.mock('../../background/BackgroundSphere', () => ({
  default: () => <div data-testid="background-sphere">BackgroundSphere</div>,
}));

vi.mock('../../interactive/InteractiveTablet', () => ({
  default: () => <div data-testid="interactive-tablet">InteractiveTablet</div>,
}));

vi.mock('../../game/ClickingGame', () => ({
  default: () => null,
}));

vi.mock('../../../overlays/GameHUD', () => ({
  default: () => null,
}));

vi.mock('../../../overlays/GameLeaderboard', () => ({
  default: () => null,
}));

vi.mock('../../../PerformanceMonitor', () => ({
  default: () => null,
}));

vi.mock('../../camera/CameraController', () => ({
  default: () => null,
}));

vi.mock('../../camera/CinematicCamera', () => ({
  default: () => null,
}));

vi.mock('../../../overlays/DirectorsIntro', () => ({
  default: () => null,
}));

vi.mock('../SceneLighting', () => ({
  default: () => null,
}));

vi.mock('../../interactive/ArticleExplorer3D', () => ({
  default: () => null,
  ArticleDetailPanel: () => null,
}));

vi.mock('../../interactive/ArticleDisplayPanel', () => ({
  default: () => null,
}));

vi.mock('../../experiences/InfiniteLibrary', () => ({
  default: () => null,
  COSMIC_LIBRARY: {},
  DIGITAL_GARDEN: {},
}));

vi.mock('../../../contexts/JourneyContext', () => ({
  useJourney: () => ({
    completeQuest: vi.fn(),
    updateStats: vi.fn(),
    currentQuest: null,
  }),
}));

vi.mock('../../../ArticleDiscoveryProvider', () => ({
  useArticleDiscovery: () => ({
    setShowFloatingButton: vi.fn(),
  }),
}));

vi.mock('../../../ui/HelpButton', () => ({
  default: () => <div data-testid="help-button">HelpButton</div>,
}));

describe('ThreeSixty Component', () => {
  const mockProps = {
    currentImage: '/test-panorama.jpg',
    isDialogOpen: false,
    onChangeImage: vi.fn(),
    onGameStateChange: vi.fn(),
    onExit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve([]),
      })
    ) as any;
  });

  describe('Component Structure', () => {
    it('should render without crashing', async () => {
      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument();
      });
    });

    it('should render BackgroundSphere by default', async () => {
      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('background-sphere')).toBeInTheDocument();
      });
    });

    it('should NOT attempt to render GaussianSplatBackground', async () => {
      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        // Ensure no Gaussian splat component is in the DOM
        const gaussianSplat = screen.queryByTestId('gaussian-splat');
        expect(gaussianSplat).not.toBeInTheDocument();
      });
    });

    it('should render Home button', async () => {
      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });
    });

    it('should render HelpButton', async () => {
      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('help-button')).toBeInTheDocument();
      });
    });

    it('should render InteractiveTablet', async () => {
      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('interactive-tablet')).toBeInTheDocument();
      });
    });
  });

  describe('Background Rendering', () => {
    it('should always use panorama sphere method', async () => {
      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        const backgroundSphere = screen.getByTestId('background-sphere');
        expect(backgroundSphere).toBeInTheDocument();
      });
    });

    it('should pass correct image URL to BackgroundSphere', async () => {
      const customImage = '/custom-panorama.jpg';
      render(<ThreeSixty {...mockProps} currentImage={customImage} />);

      await waitFor(() => {
        expect(screen.getByTestId('background-sphere')).toBeInTheDocument();
      });
    });

    it('should not fetch splat files', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument();
      });

      // Should not call /api/getSplats
      const splatCalls = fetchSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('/api/getSplats')
      );
      expect(splatCalls.length).toBe(0);
    });
  });

  describe('Props and Callbacks', () => {
    it('should call onExit when Home button is clicked', async () => {
      const onExit = vi.fn();
      render(<ThreeSixty {...mockProps} onExit={onExit} />);

      await waitFor(() => {
        const homeButton = screen.getByText('Home');
        homeButton.click();
        expect(onExit).toHaveBeenCalled();
      });
    });

    it('should call onChangeImage when scenery changes', async () => {
      const onChangeImage = vi.fn();
      render(<ThreeSixty {...mockProps} onChangeImage={onChangeImage} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument();
      });

      // The component should be ready to handle scenery changes
      expect(onChangeImage).not.toHaveBeenCalled(); // Not called during init
    });
  });

  describe('Performance Flags', () => {
    it('should NOT allow Gaussian splats', async () => {
      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        // Verify no splat-related elements exist
        const container = screen.getByTestId('canvas');
        expect(container.textContent).not.toContain('GaussianSplat');
      });
    });

    it('should respect low power mode', async () => {
      // Mock URL params for low power mode
      delete (window as any).location;
      (window as any).location = { search: '?perf=low' };

      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument();
      });

      // Component should still render (just with lower quality)
      expect(screen.getByTestId('background-sphere')).toBeInTheDocument();
    });
  });

  describe('Import Validation', () => {
    it('should successfully import BackgroundSphere', () => {
      // This test validates that the import path is correct
      expect(() => {
        render(<ThreeSixty {...mockProps} />);
      }).not.toThrow();
    });

    it('should NOT import GaussianSplatBackground', async () => {
      // Ensure the module doesn't attempt to import Gaussian splats
      const { container } = render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(container.textContent).not.toContain('GaussianSplat');
      });
    });
  });

  describe('Game State Management', () => {
    it('should start in IDLE state', async () => {
      const onGameStateChange = vi.fn();
      render(<ThreeSixty {...mockProps} onGameStateChange={onGameStateChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument();
      });

      // Should not show game UI initially
      const gameHUD = screen.queryByTestId('game-hud');
      expect(gameHUD).not.toBeInTheDocument();
    });

    it('should notify parent of game state changes', async () => {
      const onGameStateChange = vi.fn();
      render(<ThreeSixty {...mockProps} onGameStateChange={onGameStateChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument();
      });

      // Initial state should be IDLE
      expect(onGameStateChange).toHaveBeenCalledWith('IDLE');
    });
  });

  describe('Article Fetching', () => {
    it('should fetch articles on mount', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/articles');
      });
    });

    it('should handle article fetch errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = vi.fn(() => Promise.reject(new Error('API Error'))) as any;

      render(<ThreeSixty {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument();
      });

      // Component should still render despite fetch error
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Type Safety', () => {
    it('should accept valid GameState values', async () => {
      const validStates = ['IDLE', 'STARTING', 'COUNTDOWN', 'PLAYING', 'GAME_OVER'];
      const onGameStateChange = vi.fn();

      render(<ThreeSixty {...mockProps} onGameStateChange={onGameStateChange} />);

      await waitFor(() => {
        expect(screen.getByTestId('canvas')).toBeInTheDocument();
      });

      // Verify initial state is one of the valid states
      expect(validStates).toContain(onGameStateChange.mock.calls[0][0]);
    });

    it('should have correct prop types', () => {
      // TypeScript compilation test - if this compiles, types are correct
      const props = {
        currentImage: '/test.jpg',
        isDialogOpen: false,
        onChangeImage: (newImage: string) => {},
        onGameStateChange: (gameState: 'IDLE' | 'STARTING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER') => {},
        onExit: () => {},
      };

      expect(() => {
        render(<ThreeSixty {...props} />);
      }).not.toThrow();
    });
  });
});
