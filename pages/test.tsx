import React from 'react';
import { ConnectorProvider, useConnector } from '@/components/Connector';
import { SearchDialog } from '@/components/SearchDialog';
import ThreeSixty from '@/components/ThreeSixty';

const InteractivePage = () => {
    // ...

    // Function to handle scene change command
    const handleChangeSceneCommand = (scene: string) => {
      // Logic to change the ThreeJS scene
      // Example: Update the current image or dispatch an action to update the current scene
      dispatch({ type: 'SET_SCENE', scene });
    };

    return (
      <ConnectorProvider>
        <SearchDialog onChangeSceneCommand={handleChangeSceneCommand} />
        <ThreeSixty currentImage={state.current_scene} ... />
        {/* Other components */}
      </ConnectorProvider>
    );
  };