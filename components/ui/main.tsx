import React, { useState } from 'react';
import ThreeSixty from '../ThreeSixty';
import { SearchDialog } from '../SearchDialog';

interface MainProps {
    onImageChange: (newImage: string) => void;
}

const Main: React.FC<MainProps> = ({ onImageChange }) => {
    const [currentImage, setCurrentImage] = useState<string>('./background/scifi1.jpg');

    return (
      <div className="flex flex-col h-screen w-full justify-between">
        <div className="flex-grow relative">
          <ThreeSixty currentImage={currentImage} />
        </div>
      </div>
    );
  }


export default Main;
