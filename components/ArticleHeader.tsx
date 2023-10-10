import React from 'react';

interface ArticleHeaderProps {
  title: string;
}

const ArticleHeader: React.FC<ArticleHeaderProps> = ({ title }) => {
  return <h1 className="article-title">{title}</h1>;
};

export default ArticleHeader;