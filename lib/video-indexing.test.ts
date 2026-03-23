import { describe, expect, it } from 'vitest'

import {
  buildArticleVideoReference,
  getVideoEmbedUrl,
  getVideoWatchPagePath,
  getVideoWatchPageUrl,
} from '@/lib/video-indexing'

describe('video indexing helpers', () => {
  it('builds stable watch page paths and urls', () => {
    expect(getVideoWatchPagePath('threshold-02-the-closing-window')).toBe(
      '/videos/threshold-02-the-closing-window'
    )

    expect(
      getVideoWatchPageUrl('https://www.alexwelcing.com/', 'threshold-02-the-closing-window')
    ).toBe('https://alexwelcing.com/videos/threshold-02-the-closing-window')
  })

  it('normalizes youtube urls into embed urls', () => {
    expect(getVideoEmbedUrl('https://www.youtube.com/watch?v=-dJu9VyIw64')).toBe(
      'https://www.youtube.com/embed/-dJu9VyIw64'
    )
    expect(getVideoEmbedUrl('https://youtu.be/Z_w2EEPDXt8?si=4Fc2EGHOjOfVAE0G')).toBe(
      'https://www.youtube.com/embed/Z_w2EEPDXt8'
    )
    expect(getVideoEmbedUrl('https://www.youtube.com/shorts/abc123')).toBe(
      'https://www.youtube.com/embed/abc123'
    )
  })

  it('builds hosted video references for local article videos', () => {
    expect(
      buildArticleVideoReference({
        siteUrl: 'https://alexwelcing.com',
        slug: 'threshold-02-the-closing-window',
        title: 'The Closing Window',
        description: 'A translator watches language shift.',
        articleVideo: '/images/article-videos/threshold-02-the-closing-window.mp4',
        thumbnailUrl: 'https://alexwelcing.com/images/og/threshold-02-the-closing-window.svg',
        uploadDate: '2027-06-22',
      })
    ).toMatchObject({
      watchPagePath: '/videos/threshold-02-the-closing-window',
      watchPageUrl: 'https://alexwelcing.com/videos/threshold-02-the-closing-window',
      contentUrl: 'https://alexwelcing.com/images/article-videos/threshold-02-the-closing-window.mp4',
      embedUrl: 'https://alexwelcing.com/videos/threshold-02-the-closing-window',
      mimeType: 'video/mp4',
    })
  })

  it('builds embedded video references for external article videos', () => {
    expect(
      buildArticleVideoReference({
        siteUrl: 'https://alexwelcing.com',
        slug: 'meta-quest-3',
        title: 'Meta Quest 3 vs. Apple Vision Pro',
        description: 'A VR market analysis.',
        videoURL: 'https://www.youtube.com/watch?v=-dJu9VyIw64',
        thumbnailUrl: 'https://alexwelcing.com/images/og/meta-quest-3.svg',
        uploadDate: '2023-10-11',
      })
    ).toMatchObject({
      watchPagePath: '/videos/meta-quest-3',
      watchPageUrl: 'https://alexwelcing.com/videos/meta-quest-3',
      embedUrl: 'https://www.youtube.com/embed/-dJu9VyIw64',
    })
  })
})
