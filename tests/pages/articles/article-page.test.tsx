import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js modules
vi.mock('next/head', () => ({
  default: ({ children }: any) => children,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('next/image', () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/articles/test-article',
    query: { slug: 'test-article' },
    push: vi.fn(),
  }),
}));

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div data-testid="markdown-content">{children}</div>,
}));

// Mock components
vi.mock('@/components/ArticleContainer', () => ({
  default: ({ children }: any) => <div data-testid="article-container">{children}</div>,
}));

vi.mock('@/components/StructuredData', () => ({
  default: () => null,
}));

vi.mock('@/components/ArticleClassification', () => ({
  default: () => <div data-testid="article-classification">Classification</div>,
  inferClassificationFromSlug: vi.fn(() => ({})),
}));

vi.mock('@/components/ui/CircleNav', () => ({
  default: () => <div data-testid="circle-nav">CircleNav</div>,
}));

vi.mock('@/components/ui/MarkdownImage', () => ({
  default: () => null,
}));

vi.mock('@/components/ArticleDiscoveryProvider', () => ({
  useArticleDiscovery: () => ({
    openModal: vi.fn(),
    setCurrentArticle: vi.fn(),
  }),
}));

vi.mock('@/components/ui/HandwrittenNote', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/DeskSurface', () => ({
  default: () => <div data-testid="desk-surface">DeskSurface</div>,
}));

vi.mock('@/components/ArticleImageSlideshow', () => ({
  default: ({ articleSlug }: any) => (
    <div data-testid="article-image-slideshow">Slideshow: {articleSlug}</div>
  ),
}));

vi.mock('lucide-react', () => ({
  Compass: () => <div>Compass</div>,
  Star: () => <div>Star</div>,
  ArrowRight: () => <div>ArrowRight</div>,
}));

describe('Article Page Integration', () => {
  const mockArticleProps = {
    title: 'Test Article Title',
    date: '2024-01-01T00:00:00Z',
    author: ['Test Author'],
    content: '# Test Content\n\nThis is test content.',
    description: 'Test description',
    keywords: ['test', 'article'],
    ogImage: 'https://example.com/og-image.jpg',
    videoURL: '',
    readingTime: 5,
    relatedArticles: [],
    slug: 'test-article',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Integration', () => {
    it('should render ArticleImageSlideshow component', async () => {
      // Dynamic import to avoid ESM issues in tests
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('article-image-slideshow')).toBeInTheDocument();
      });
    });

    it('should pass correct slug to ArticleImageSlideshow', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} slug="custom-slug" />);

      await waitFor(() => {
        const slideshow = screen.getByTestId('article-image-slideshow');
        expect(slideshow).toHaveTextContent('custom-slug');
      });
    });

    it('should render DeskSurface component', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('desk-surface')).toBeInTheDocument();
      });
    });

    it('should render article classification', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('article-classification')).toBeInTheDocument();
      });
    });
  });

  describe('Article Metadata', () => {
    it('should display article title', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Article Title')).toBeInTheDocument();
      });
    });

    it('should display reading time', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByText(/5 min read/i)).toBeInTheDocument();
      });
    });

    it('should display author information', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Test Author/i)).toBeInTheDocument();
      });
    });
  });

  describe('Component Order', () => {
    it('should render components in correct order', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      const { container } = render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        const classification = screen.getByTestId('article-classification');
        const slideshow = screen.getByTestId('article-image-slideshow');

        // Get positions in DOM
        const classificationPosition = Array.from(container.querySelectorAll('*')).indexOf(
          classification
        );
        const slideshowPosition = Array.from(container.querySelectorAll('*')).indexOf(slideshow);

        // Slideshow should come after classification
        expect(slideshowPosition).toBeGreaterThan(classificationPosition);
      });
    });
  });

  describe('OG Image Handling', () => {
    it('should use provided ogImage', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;
      const customOgImage = 'https://example.com/custom-og.jpg';

      render(<ArticlePage {...mockArticleProps} ogImage={customOgImage} />);

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        const ogImage = images.find(img => img.getAttribute('src')?.includes('custom-og'));
        expect(ogImage).toBeDefined();
      });
    });

    it('should handle missing ogImage gracefully', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} ogImage="" />);

      await waitFor(() => {
        // Should still render without crashing
        expect(screen.getByText('Test Article Title')).toBeInTheDocument();
      });
    });
  });

  describe('Content Rendering', () => {
    it('should render markdown content', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
      });
    });

    it('should render video if videoURL provided', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(
        <ArticlePage
          {...mockArticleProps}
          videoURL="https://www.youtube.com/watch?v=test123"
        />
      );

      await waitFor(() => {
        const iframe = screen.getByTitle(/youtube/i) || document.querySelector('iframe');
        expect(iframe).toBeDefined();
      });
    });
  });

  describe('Navigation Elements', () => {
    it('should render internal links', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Speculative AI Hub/i)).toBeInTheDocument();
        expect(screen.getByText(/Agent Futures/i)).toBeInTheDocument();
      });
    });

    it('should render discovery section', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Discover Related Articles/i)).toBeInTheDocument();
      });
    });
  });

  describe('Related Articles', () => {
    it('should render related articles when provided', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;
      const relatedArticles = [
        {
          slug: 'related-1',
          title: 'Related Article 1',
          description: 'Description 1',
          ogImage: '',
        },
      ];

      render(<ArticlePage {...mockArticleProps} relatedArticles={relatedArticles} />);

      await waitFor(() => {
        expect(screen.getByText('Related Article 1')).toBeInTheDocument();
      });
    });

    it('should not render related section when empty', async () => {
      const ArticlePage = (await import('../../../pages/articles/[slug]')).default;

      render(<ArticlePage {...mockArticleProps} relatedArticles={[]} />);

      await waitFor(() => {
        expect(screen.queryByText(/Related Articles/i)).not.toBeInTheDocument();
      });
    });
  });
});
