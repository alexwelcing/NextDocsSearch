import React, { ReactNode } from 'react';

type ArticleContainerProps = {
  children: ReactNode;
};

const ArticleContainer: React.FC<ArticleContainerProps> = ({ children }) => {
  return <div className="article-container">{children}</div>;
};

export default ArticleContainer;
