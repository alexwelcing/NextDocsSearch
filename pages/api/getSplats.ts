import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

interface SplatFile {
  filename: string
  path: string
  size: number
}

interface SplatsResponse {
  splats: SplatFile[]
  hasSplats: boolean
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SplatsResponse | { error: string }>
) {
  try {
    const splatsDir = path.join(process.cwd(), 'public', 'splats')

    // Check if the splats directory exists
    if (!fs.existsSync(splatsDir)) {
      // Directory doesn't exist, return empty array
      return res.status(200).json({ splats: [], hasSplats: false })
    }

    // Read all files in the splats directory
    const files = fs.readdirSync(splatsDir)

    // Filter for .splat, .ply, .ksplat, and .spz files (common Gaussian Splat formats)
    const splatFiles: SplatFile[] = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase()
        return ext === '.splat' || ext === '.ply' || ext === '.ksplat' || ext === '.spz'
      })
      .map(file => {
        const filePath = path.join(splatsDir, file)
        const stats = fs.statSync(filePath)
        return {
          filename: file,
          path: `/splats/${file}`,
          size: stats.size,
        }
      })
      .sort((a, b) => a.filename.localeCompare(b.filename))

    res.status(200).json({
      splats: splatFiles,
      hasSplats: splatFiles.length > 0,
    })
  } catch (error) {
    console.error('Error reading splat files:', error)
    res.status(500).json({ error: 'Failed to read splat files' })
  }
}
