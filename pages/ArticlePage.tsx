import React from 'react';
import ReactMarkdown from 'react-markdown';
import ArticleContainer from '../components/ArticleContainer';
import ArticleHeader from '../components/ArticleHeader';
import Footer from '../components/ui/footer';
import StructuredDataComponent from '../components/StructuredData';
import styles from '../styles/Home.module.css';

interface ArticlePageProps {
  content: string; // Markdown content here
  title: string;
}

const ArticlePage: React.FC<ArticlePageProps> = ({ content, title }) => {
  return (
    <div className={styles.articleMain}>
      <ArticleContainer>
        <StructuredDataComponent />
        <ArticleHeader title={title} />
        <div className="article-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        <Footer
        onImageChange={function (newImage: string): void {
          throw new Error('Function not implemented.')
        }}
        showChangeScenery={false}
      />
      </ArticleContainer>
    </div>
  );
};


export default ArticlePage;
