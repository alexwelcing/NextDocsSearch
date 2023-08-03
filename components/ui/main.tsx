import React from 'react';
import ThreeSixty from '../ThreeSixty';

interface MainProps {
  currentImage: string;
}

const Main: React.FC<MainProps> = ({ currentImage }) => {
  return (
    <div className="flex flex-col h-screen w-full justify-between">
      <div className="flex-grow relative">
        <ThreeSixty currentImage={currentImage} isDialogOpen={false} />
      </div>
    </div>
  );
};

export default Main;
