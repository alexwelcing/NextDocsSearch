import React, { useRef, useEffect } from 'react'
import styled from 'styled-components'

interface ArticleVideoPlayerProps {
  src: string
  title?: string
}

const PlayerWrapper = styled.div`
  position: relative;
  width: 100%;
  margin: 32px 0;
  border: 2px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  background: #000;

  @media (min-width: 900px) {
    width: 140%;
    margin-left: -20%;
  }
`

const StyledVideo = styled.video`
  display: block;
  width: 100%;
  height: auto;
`

const ArticleVideoPlayer: React.FC<ArticleVideoPlayerProps> = ({ src, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // Ensure autoplay works on mobile by playing after mount
    video.play().catch(() => {
      // Autoplay blocked — browser requires interaction; silent fail is fine
    })
  }, [])

  return (
    <PlayerWrapper>
      <StyledVideo
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label={title ? `Video for ${title}` : 'Article video'}
      />
    </PlayerWrapper>
  )
}

export default ArticleVideoPlayer
