import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const getBackgroundImage = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const directoryPath = path.join(process.cwd(), 'public', 'background');
    const files = fs.readdirSync(directoryPath);

    // Filter the files to include only .jpg files
    const imageFiles = files.filter((file) => file.endsWith('.jpg'));
    const imageUrls = imageFiles.map((file) => `/background/${file}`);

    // Select one random image
    const randomImage = imageFiles[Math.floor(Math.random() * imageFiles.length)];
    const shouldListOnly = req.query.mode === 'list' || req.query.list === '1';

    // Return the random image
    if (shouldListOnly) {
      res.status(200).json({ images: imageUrls });
      return;
    }

    res.status(200).json({
      image: `/background/${randomImage}`,
      images: imageUrls,
      count: imageUrls.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to retrieve background image.' });
  }
};

export default getBackgroundImage;
