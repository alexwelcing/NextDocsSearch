import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ArticleImageSlideshow from '../ArticleImageSlideshow';
import { ArticleImage } from '@/pages/api/media/all-images';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <div data-testid="chevron-left">ChevronLeft</div>,
  ChevronRight: () => <div data-testid="chevron-right">ChevronRight</div>,
  X: () => <div data-testid="x-icon">X</div>,
  Image: () => <div data-testid="image-icon">Image</div>,
  Zap: () => <div data-testid="zap-icon">Zap</div>,
}));

const mockImages: ArticleImage[] = [
  {
    id: 'artwork-1',
    url: 'https://example.com/image1.jpg',
    type: 'artwork',
    title: 'AI Generated Image 1',
    alt_text: 'Test alt text 1',
    caption: 'fast tier',
    width: 1024,
    height: 768,
    is_selected: true,
    model_name: 'FLUX Schnell',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'media-2',
    url: 'https://example.com/image2.jpg',
    type: 'media',
    title: 'Uploaded Image 2',
    alt_text: 'Test alt text 2',
    width: 1920,
    height: 1080,
    created_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 'artwork-3',
    url: 'https://example.com/image3.jpg',
    type: 'artwork',
    title: 'AI Generated Image 3',
    model_name: 'FLUX Dev',
    width: 1024,
    height: 768,
    created_at: '2024-01-03T00:00:00Z',
  },
];

describe('ArticleImageSlideshow', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render loading state initially', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: [], count: 0 }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      expect(screen.getByText('Loading images...')).toBeInTheDocument();
    });

    it('should render nothing when no images are available', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: [], count: 0 }),
      });

      const { container } = render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('should render slideshow with images', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: mockImages, count: mockImages.length }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getByText('Article Gallery')).toBeInTheDocument();
      });
    });

    it('should display correct image counter', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: mockImages, count: mockImages.length }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
      });
    });

    it('should render all thumbnails', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: mockImages, count: mockImages.length }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        const thumbnails = screen.getAllByRole('button');
        // 3 thumbnails + 2 navigation buttons = 5 buttons
        expect(thumbnails.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Icon Validation', () => {
    it('should use Zap icon for artwork type', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          success: true,
          images: [mockImages[0]], // artwork type
          count: 1
        }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getAllByTestId('zap-icon').length).toBeGreaterThan(0);
      });
    });

    it('should use Image icon for media type', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({
          success: true,
          images: [mockImages[1]], // media type
          count: 1
        }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getAllByTestId('image-icon').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to next image on next button click', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: mockImages, count: mockImages.length }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
      });

      const nextButton = screen.getAllByTestId('chevron-right')[0].parentElement;
      if (nextButton) {
        fireEvent.click(nextButton);
        await waitFor(() => {
          expect(screen.getByText('2 / 3')).toBeInTheDocument();
        });
      }
    });

    it('should navigate to previous image on prev button click', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: mockImages, count: mockImages.length }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
      });

      const prevButton = screen.getAllByTestId('chevron-left')[0].parentElement;
      if (prevButton) {
        fireEvent.click(prevButton);
        await waitFor(() => {
          expect(screen.getByText('3 / 3')).toBeInTheDocument();
        });
      }
    });

    it('should navigate via thumbnail click', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: mockImages, count: mockImages.length }),
      });

      const { container } = render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
      });

      const thumbnails = container.querySelectorAll('button');
      // Click the last thumbnail (third image)
      if (thumbnails[thumbnails.length - 1]) {
        fireEvent.click(thumbnails[thumbnails.length - 1]);
        await waitFor(() => {
          expect(screen.getByText('3 / 3')).toBeInTheDocument();
        });
      }
    });
  });

  describe('API Integration', () => {
    it('should call API with correct slug', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: [], count: 0 }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article-slug" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/media/all-images?slug=test-article-slug');
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { container } = render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should prioritize selected image', async () => {
      const selectedImage = mockImages[0]; // has is_selected: true
      mockFetch.mockResolvedValue({
        json: async () => ({
          success: true,
          images: mockImages,
          selectedImage,
          count: mockImages.length
        }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        // Should show first image (selected one) initially
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
      });
    });
  });

  describe('Type Safety', () => {
    it('should handle missing optional fields gracefully', async () => {
      const minimalImage: ArticleImage = {
        id: 'test-1',
        url: 'https://example.com/test.jpg',
        type: 'media',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: [minimalImage], count: 1 }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getByText('Article Gallery')).toBeInTheDocument();
        expect(screen.getByText('Untitled')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should respond to arrow key navigation in fullscreen', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: true, images: mockImages, count: mockImages.length }),
      });

      render(<ArticleImageSlideshow articleSlug="test-article" />);

      await waitFor(() => {
        expect(screen.getByText('Article Gallery')).toBeInTheDocument();
      });

      // Click to open fullscreen
      const mainImage = screen.getAllByRole('img')[0];
      fireEvent.click(mainImage.parentElement!);

      // Test arrow keys
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
      });
    });
  });
});
