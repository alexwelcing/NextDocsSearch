/**
 * Quiz Generation API
 * Generates multiple-choice quiz questions based on article content using OpenAI
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import OpenAI from 'openai';

const openAiKey = process.env.OPENAI_KEY;

const openai = new OpenAI({
  apiKey: openAiKey,
});

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizResponse {
  questions: QuizQuestion[];
  articleTitle: string;
}

interface ErrorResponse {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<QuizResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!openAiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Article filename is required' });
    }

    // Read the article content
    const articlePath = path.join(process.cwd(), 'pages', 'docs', 'articles', filename);

    if (!fs.existsSync(articlePath)) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const fileContents = fs.readFileSync(articlePath, 'utf8');
    const { data, content } = matter(fileContents);

    // Truncate content if too long (keep it under ~3000 tokens)
    const truncatedContent = content.slice(0, 12000);

    // Create the prompt for OpenAI
    const prompt = `You are a quiz generator. Based on the following article, generate 5 multiple-choice questions that test understanding of the key concepts.

Article Title: ${data.title}
Article Content:
${truncatedContent}

Generate 5 quiz questions in the following JSON format:
{
  "questions": [
    {
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

Important:
- Make questions challenging but fair
- correctAnswer should be the index (0-3) of the correct option
- Focus on key concepts and practical applications
- Make sure all options are plausible
- Keep questions concise and clear

Return ONLY valid JSON, no other text.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a quiz generator that creates educational multiple-choice questions. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    if (!completion.choices || completion.choices.length === 0) {
      return res.status(500).json({ error: 'Failed to generate quiz questions' });
    }

    const responseText = completion.choices[0].message?.content || '';

    // Parse the JSON response
    let quizData;
    try {
      quizData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText);
      return res.status(500).json({ error: 'Failed to parse quiz questions' });
    }

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      return res.status(500).json({ error: 'Invalid quiz format received' });
    }

    // Return the quiz
    res.status(200).json({
      questions: quizData.questions,
      articleTitle: data.title as string,
    });
  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
}
