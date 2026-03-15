/**
 * AI-powered content generation utilities.
 * All functions call the OpenAI-compatible proxy and cache results in localStorage.
 */
import OpenAI from 'openai';
import { userKey } from './userContext';

const BASE_URL = 'https://vjioo4r1vyvcozuj.us-east-2.aws.endpoints.huggingface.cloud/v1';
const MODEL = 'openai/gpt-oss-120b';

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: (import.meta as any).env.VITE_OPENAI_API_KEY ?? 'test',
    baseURL: BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function cacheKey(prefix: string, id: string): string {
  return userKey(`ai-${prefix}-${id}`);
}

function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded — ignore */ }
}

async function chatJSON<T>(prompt: string): Promise<T | null> {
  try {
    const ai = getClient();
    const resp = await ai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const text = resp.choices[0]?.message?.content ?? '{}';
    return JSON.parse(text) as T;
  } catch (e) {
    console.error('AI chatJSON error:', e);
    return null;
  }
}

async function chatText(prompt: string): Promise<string | null> {
  try {
    const ai = getClient();
    const resp = await ai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
    });
    return resp.choices[0]?.message?.content ?? null;
  } catch (e) {
    console.error('AI chatText error:', e);
    return null;
  }
}

// ── Quiz Generation ────────────────────────────────────────────────────────

export interface GeneratedQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * Generate multiple-choice comprehension questions from section text.
 * Results are cached by a hash of the section title.
 */
export async function generateQuizzes(
  sectionTitle: string,
  textExcerpt: string,
  count: number = 3
): Promise<GeneratedQuiz[]> {
  const key = cacheKey('quiz', sectionTitle.replace(/\W+/g, '_').slice(0, 40));
  const cached = getCache<GeneratedQuiz[]>(key);
  if (cached && cached.length >= count) return cached;

  const prompt = `You are a study assistant. Based on the following text from a section titled "${sectionTitle}", generate exactly ${count} multiple-choice comprehension questions.

TEXT:
${textExcerpt.slice(0, 2000)}

Return ONLY a JSON object in this exact format:
{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "Brief explanation of the correct answer"}]}

Rules:
- Each question must have exactly 4 options
- correctIndex is 0-based (0 = first option)
- Questions should test understanding, not just recall
- Make distractors plausible but clearly wrong
- Keep questions focused on the content provided`;

  const result = await chatJSON<{ questions: GeneratedQuiz[] }>(prompt);
  const questions = result?.questions ?? [];
  if (questions.length > 0) setCache(key, questions);
  return questions;
}

// ── Flashcard Generation ───────────────────────────────────────────────────

export interface GeneratedFlashcard {
  term: string;
  definition: string;
}

/**
 * Generate flashcard term/definition pairs from section text.
 */
export async function generateFlashcards(
  sectionTitle: string,
  textExcerpt: string,
  count: number = 5
): Promise<GeneratedFlashcard[]> {
  const key = cacheKey('flash', sectionTitle.replace(/\W+/g, '_').slice(0, 40));
  const cached = getCache<GeneratedFlashcard[]>(key);
  if (cached && cached.length >= count) return cached;

  const prompt = `You are a study assistant. Based on the following text from a section titled "${sectionTitle}", generate exactly ${count} flashcards with key terms and concise definitions.

TEXT:
${textExcerpt.slice(0, 2000)}

Return ONLY a JSON object in this exact format:
{"flashcards": [{"term": "Key Term", "definition": "Clear, concise definition (1-2 sentences)"}]}

Rules:
- Focus on the most important concepts and terms
- Definitions should be student-friendly and concise
- Include technical terms that appear in the text`;

  const result = await chatJSON<{ flashcards: GeneratedFlashcard[] }>(prompt);
  const cards = result?.flashcards ?? [];
  if (cards.length > 0) setCache(key, cards);
  return cards;
}

// ── Nightly Review Summary ─────────────────────────────────────────────────

export interface ReviewSummary {
  headline: string;
  recap: string;
  keyTakeaways: string[];
  studyTip: string;
}

/**
 * Generate a nightly review summary for a day's worth of sections.
 */
export async function generateReviewSummary(
  bookTitle: string,
  dayNumber: number,
  sections: { title: string; textExcerpt?: string; sectionType: string }[]
): Promise<ReviewSummary | null> {
  const key = cacheKey('review', `${bookTitle.replace(/\W+/g, '_').slice(0, 20)}_day${dayNumber}`);
  const cached = getCache<ReviewSummary>(key);
  if (cached) return cached;

  const sectionSummaries = sections.map(s =>
    `Section: "${s.title}" (${s.sectionType})\n${s.textExcerpt?.slice(0, 600) ?? 'No text available.'}`
  ).join('\n\n');

  const prompt = `You are a study assistant creating a nightly review digest. The student is studying "${bookTitle}" and just completed Day ${dayNumber}.

SECTIONS COVERED:
${sectionSummaries}

Return ONLY a JSON object in this exact format:
{"headline": "One catchy headline summarizing the day (max 10 words)", "recap": "A 2-3 paragraph engaging recap of what was covered, written in a magazine-style editorial tone. Reference specific concepts from the text.", "keyTakeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"], "studyTip": "One actionable study tip related to the material covered today"}`;

  const result = await chatJSON<ReviewSummary>(prompt);
  if (result) setCache(key, result);
  return result;
}

// ── Scholar Tips ───────────────────────────────────────────────────────────

/**
 * Generate a contextual study tip based on what the student is currently working on.
 */
export async function generateScholarTip(
  bookTitle: string,
  currentSection?: string,
  recentQuizAccuracy?: number
): Promise<string | null> {
  // Cache for 1 hour by rounding timestamp
  const hourKey = Math.floor(Date.now() / 3600000).toString();
  const key = cacheKey('tip', hourKey);
  const cached = getCache<string>(key);
  if (cached) return cached;

  const context = currentSection
    ? `They are currently studying "${currentSection}" in "${bookTitle}".`
    : `They are studying "${bookTitle}".`;
  const quizNote = recentQuizAccuracy !== undefined
    ? ` Their recent quiz accuracy is ${recentQuizAccuracy}%.`
    : '';

  const prompt = `You are a study coach. ${context}${quizNote}

Give ONE short, specific, actionable study tip (2-3 sentences max). Reference a proven learning technique like active recall, spaced repetition, the Feynman technique, interleaving, or elaborative interrogation. Make it feel personalized and encouraging. Do not use bullet points.`;

  const result = await chatText(prompt);
  if (result) setCache(key, result);
  return result;
}

// ── Improved Scholar Summary ───────────────────────────────────────────────

/**
 * Generate a detailed, contextual summary of a section.
 */
export async function generateScholarSummary(
  sectionTitle: string,
  textExcerpt: string,
  bookTitle: string
): Promise<string | null> {
  const prompt = `You are an expert study assistant. A student is reading a section titled "${sectionTitle}" from "${bookTitle}".

Here is the text they're studying:
${textExcerpt.slice(0, 2000)}

Write a helpful study summary that:
1. Identifies the 3-5 most important concepts in this section
2. Explains each concept clearly and concisely
3. Highlights connections between concepts
4. Ends with a "What to focus on" note

Use bullet points for the key concepts. Keep the total summary under 300 words. Write in a clear, engaging style appropriate for a student.`;

  return chatText(prompt);
}
