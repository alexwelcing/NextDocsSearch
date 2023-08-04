import React from 'react';
import ThreeSixty from '../ThreeSixty';

interface MainProps {
  currentImage: string;
  showThreeSixty?: boolean;  // Added new prop
}

const Main: React.FC<MainProps> = ({ currentImage, showThreeSixty = true }) => {
  return (
    <div className="flex flex-col h-screen w-full justify-between">
      <div className="flex-grow relative">
        { showThreeSixty && <ThreeSixty currentImage={currentImage} isDialogOpen={false} onChangeImage={function (): void {
          throw new Error('Function not implemented.');
        } } /> }
      </div>
    </div>
  );
};

export default Main;