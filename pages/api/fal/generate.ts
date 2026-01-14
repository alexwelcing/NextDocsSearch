
import type { NextApiRequest, NextApiResponse } from 'next';

const FAL_KEY = process.env.FAL_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { prompt, model = 'fal-ai/fast-sdxl', imageSize = 'square_hd', image_url } = req.body;

  if (!prompt && !image_url) {
    return res.status(400).json({ message: 'Prompt or image_url is required' });
  }

  if (!FAL_KEY) {
    console.error('FAL_KEY is not set');
    return res.status(503).json({ 
      message: 'Creation services are temporarily offline (configuration error).',
      code: 'CONFIG_ERROR' 
    });
  }

  try {
    let body: any = {
        enable_safety_checker: true,
        safety_tolerance: "2",
    };

    if (model === 'fal-ai/triposr') {
        if (!image_url) {
            return res.status(400).json({ message: 'image_url is required for 3D generation' });
        }
        body = {
            image_url,
        };
    } else {
        // Default text-to-image
        body = {
            prompt,
            image_size: imageSize,
            enable_safety_checker: true,
            safety_tolerance: "2",
        };
    }

    const response = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 402 || response.status === 401) {
         return res.status(503).json({ 
            message: 'Our creation magic is temporarily out of energy. Please try again later!',
            code: 'OUT_OF_CREDITS'
         });
      }
      const errorText = await response.text();
      console.error('FAL API Error:', errorText);
      throw new Error(`FAL API error: ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Generation failed:', error);
    return res.status(500).json({ 
      message: 'Failed to generate creation. Please try again.',
      code: 'GENERATION_FAILED'
    });
  }
}
