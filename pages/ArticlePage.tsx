import React from 'react';
import ArticleContainer from '../components/ArticleContainer';
import ArticleHeader from '../components/ArticleHeader';
import ArticleContent from '../components/ArticleContent';
import ArticleFooter from '../components/ArticleFooter';
import StructuredDataComponent from '../components/StructuredData';

const ArticlePage: React.FC = () => {
  return (
    <ArticleContainer>
      <StructuredDataComponent />
      <ArticleHeader title="Article Title" />
      <ArticleContent content="Article content here" />
      <ArticleFooter />
    </ArticleContainer>
  );
};

export default ArticlePage;
