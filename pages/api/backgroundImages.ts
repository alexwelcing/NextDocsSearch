// pages/api/backgroundImages.ts

import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

const getBackgroundImages = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Get the path to the background images directory
    const directoryPath = path.join(process.cwd(), 'public', 'background')

    // Use a synchronous method to read the directory contents
    const files = fs.readdirSync(directoryPath)

    // Filter the files to include only .jpg files
    const imageFiles = files.filter((file) => file.endsWith('.jpg'))

    // Return the list of image files
    res.status(200).json(imageFiles)
  } catch (error) {
    // Catch any unexpected error
    res.status(500).json({ error: 'Unable to retrieve background images.' })
  }
}

export default getBackgroundImages