// pages/api/getPDFs.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const getPdfs = (req: NextApiRequest, res: NextApiResponse) => {
  const directoryPath = path.join(process.cwd(), 'public', 'resumes');
  // Passing directoryPath and callback function
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).json({ message: 'Unable to scan directory' });
    }
    // Filter out just the PDFs
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    return res.status(200).json({ pdfFiles });
  });
};

export default getPdfs;
