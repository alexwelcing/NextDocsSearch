import React from 'react';

interface VideoComponentProps {
  videoSrc: string;
}

const VideoComponent: React.FC<VideoComponentProps> = ({ videoSrc }) => {
  return <video src={videoSrc} controls></video>;
};

export default VideoComponent;
