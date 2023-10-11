'use client'

import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const getBackgroundImage = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const directoryPath = path.join(process.cwd(), 'public', 'background');
    const files = fs.readdirSync(directoryPath);

    // Filter the files to include only .jpg files
    const imageFiles = files.filter((file) => file.endsWith('.jpg'));

    // Select one random image
    const randomImage = imageFiles[Math.floor(Math.random() * imageFiles.length)];

    // Return the random image
    res.status(200).json({ image: `./background/${randomImage}` });
  } catch (error) {
    res.status(500).json({ error: 'Unable to retrieve background image.' });
  }
};

export default getBackgroundImage;
