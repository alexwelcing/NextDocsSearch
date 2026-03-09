import React, { useRef, useState, useCallback } from 'react'
import styled from 'styled-components'

interface VideoComponentProps {
  videoSrc: string
  poster?: string
  title?: string
  description?: string
  width?: number
  height?: number
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
}

const VideoWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 860px;
  margin: 2rem auto;
  border-radius: 4px;
  overflow: hidden;
  background: #0a0a0f;
  border: 1px solid rgba(255, 255, 255, 0.08);
`

const StyledVideo = styled.video`
  display: block;
  width: 100%;
  height: auto;
  background: #000;
`

const VideoOverlay = styled.button<{ $visible: boolean }>`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  cursor: pointer;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity 0.3s;
  pointer-events: ${(p) => (p.$visible ? 'auto' : 'none')};

  &:focus-visible {
    outline: 2px solid #00d4ff;
    outline-offset: -2px;
  }

  svg {
    width: 64px;
    height: 64px;
    fill: rgba(255, 255, 255, 0.9);
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
  }
`

const VideoCaption = styled.figcaption`
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Courier New', monospace;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
`

const VideoComponent: React.FC<VideoComponentProps> = ({
  videoSrc,
  poster,
  title,
  description,
  width,
  height,
  autoPlay = false,
  muted = true,
  loop = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showOverlay, setShowOverlay] = useState(!autoPlay)

  const handlePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
      setIsPlaying(true)
      setShowOverlay(false)
    } else {
      video.pause()
      setIsPlaying(false)
      setShowOverlay(true)
    }
  }, [])

  const handleEnded = useCallback(() => {
    if (!loop) {
      setIsPlaying(false)
      setShowOverlay(true)
    }
  }, [loop])

  return (
    <figure style={{ margin: 0 }}>
      <VideoWrapper>
        <StyledVideo
          ref={videoRef}
          src={videoSrc}
          poster={poster}
          width={width}
          height={height}
          controls
          controlsList="nodownload"
          preload="metadata"
          playsInline
          muted={muted}
          loop={loop}
          autoPlay={autoPlay}
          onPlay={() => {
            setIsPlaying(true)
            setShowOverlay(false)
          }}
          onPause={() => {
            setIsPlaying(false)
            setShowOverlay(true)
          }}
          onEnded={handleEnded}
          aria-label={title || 'Article video'}
        >
          <track kind="metadata" />
          Your browser does not support the video tag.
        </StyledVideo>

        <VideoOverlay
          $visible={showOverlay && !autoPlay}
          onClick={handlePlay}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
          tabIndex={showOverlay ? 0 : -1}
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5v14l11-7z" />
          </svg>
        </VideoOverlay>
      </VideoWrapper>

      {(title || description) && (
        <VideoCaption>{title || description}</VideoCaption>
      )}
    </figure>
  )
}

export default VideoComponent
