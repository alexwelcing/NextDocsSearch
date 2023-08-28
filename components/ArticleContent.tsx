
import React from 'react';
import ReactMarkdown from 'react-markdown';


interface ArticleContentProps {
  content: string;
}

const ArticleContent: React.FC<ArticleContentProps> = ({ content }) => {
  return <div className="article-content"><ReactMarkdown>{content}</ReactMarkdown></div>;
};

export default ArticleContent;
