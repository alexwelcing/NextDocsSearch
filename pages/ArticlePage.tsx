import React from 'react';
import ReactMarkdown from 'react-markdown';
import ArticleContainer from '../components/ArticleContainer';
import ArticleHeader from '../components/ArticleHeader';
import StructuredDataComponent from '../components/StructuredData';
import styles from '../styles/Home.module.css';
import CircleNav from '@/components/ui/CircleNav'


interface ArticlePageProps {
  content: string; // Markdown content here
  title: string;
}

const ArticlePage: React.FC<ArticlePageProps> = ({ content, title }) => {
  return (
    <div className={styles.articleMain}>
            <CircleNav />
      <ArticleContainer>
        <StructuredDataComponent />
        <ArticleHeader title={title} />
        <div className="article-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </ArticleContainer>
    </div>
  );
};


export default ArticlePage;
