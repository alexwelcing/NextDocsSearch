import React from 'react';

interface ArticleContentProps {
  content: string;
}

const ArticleContent: React.FC<ArticleContentProps> = ({ content }) => {
  return <div className="article-content" dangerouslySetInnerHTML={{ __html: content }}></div>;
};

export default ArticleContent;
