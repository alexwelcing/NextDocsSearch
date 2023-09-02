import React from 'react';
import { Html } from '@react-three/drei';
import { ArticleText } from './ArticleTextStyling';
import { ArticleControls } from './ArticleButton';
import TabletBackground from './TabletBackground';

function ArticleDisplay({ articleText, onNext, onPrev }: { articleText: string; onNext: () => void; onPrev: () => void }) {
    return (
      <>
        <TabletBackground />
        <Html position={[0, 0, -0.5]}>
          <ArticleText text={articleText} />
          <ArticleControls onNext={onNext} onPrev={onPrev} />
        </Html>
      </>
    );
  }

  export { ArticleDisplay };
