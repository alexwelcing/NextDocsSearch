import type { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, OpenAIApi } from 'openai-edge';

const config = new Configuration({
  apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(config);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    // Use OpenAI to enhance the prompt for 3D generation
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an expert at describing 3D objects for generation.
          Given a user's simple prompt, enhance it with visual details like:
          - Specific shapes and forms
          - Material properties (rough, smooth, metallic, glowing, etc.)
          - Atmospheric elements (fog, lighting, particles)
          - Horror or editorial themes
          - Colors and textures

          Keep the enhanced prompt to 1-2 sentences. Be vivid and specific.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 100,
      temperature: 0.8,
    });

    const data = await completion.json();
    const enhancedPrompt = data.choices?.[0]?.message?.content || prompt;

    return res.status(200).json({
      original: prompt,
      enhanced: enhancedPrompt,
    });
  } catch (error) {
    console.error('Prompt enhancement error:', error);
    return res.status(500).json({
      error: 'Failed to enhance prompt',
      fallback: req.body.prompt,
    });
  }
}
