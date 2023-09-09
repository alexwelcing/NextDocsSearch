import React from 'react';
import { ArticleData } from './ArticleTextDisplay';
import ArticleDisplayBox from './ArticleDisplayBox';

interface ArticleControlsProps {
  articles: ArticleData[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}

const ArticleControls: React.FC<ArticleControlsProps> = ({ articles, currentIndex, setCurrentIndex }) => {
  const article = articles[currentIndex];

  const handleNext = () => setCurrentIndex(prev => Math.min(prev + 1, articles.length - 1));
  const handlePrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  return (
    <group position={[0, 1, -5]}>
      <ArticleDisplayBox article={article} handleNext={handleNext} handlePrev={handlePrev} />
    </group>
  );
};

export default ArticleControls;
