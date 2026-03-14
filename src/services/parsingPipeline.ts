import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenAI } from '@google/genai';
import { TextbookStructure } from '../types.js';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export class ParsingPipeline {
  private static DATA_DIR = path.join(process.cwd(), 'data');

  constructor() {
    if (!fs.existsSync(ParsingPipeline.DATA_DIR)) {
      fs.mkdirSync(ParsingPipeline.DATA_DIR);
    }
  }

  async processTextbook(filePath: string, originalName: string): Promise<string> {
    console.log(`Starting pipeline for: ${originalName}`);
    
    // Stage 1: Ingestion
    const rawText = await this.ingest(filePath);
    
    // Stage 2: Segmentation
    const chunks = await this.segment(rawText);
    
    // Stage 3 & 4: Structural Detection & AI Analysis
    const structuredData = await this.analyze(chunks, originalName);
    
    // Stage 5: Storage
    const outputId = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(ParsingPipeline.DATA_DIR, `${outputId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(structuredData, null, 2));
    
    return outputId;
  }

  private async ingest(filePath: string): Promise<string> {
    console.log('Stage 1: Ingesting PDF...');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  private async segment(text: string): Promise<string[]> {
    console.log('Stage 2: Segmenting text...');
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 4000,
      chunkOverlap: 400,
    });
    return await splitter.splitText(text);
  }

  private async analyze(chunks: string[], title: string): Promise<TextbookStructure> {
    console.log('Stage 3 & 4: Analyzing with AI...');
    
    const prompt = `
      You are an expert textbook parser. I have a textbook titled "${title}".
      I will provide you with segments of the text. 
      Your goal is to extract a hierarchical structure: Chapters -> Sections -> Subsections -> Topics -> Content.
      Also extract educational components: definitions, theorems, proofs, examples, exercises, key concepts, summaries.
      
      Return the result as a JSON object following this structure:
      {
        "chapters": [
          {
            "id": "ch1",
            "title": "Chapter Title",
            "sections": [
              {
                "id": "s1.1",
                "title": "Section Title",
                "subsections": [
                  {
                    "id": "ss1.1.1",
                    "title": "Subsection Title",
                    "topics": [
                      {
                        "id": "t1",
                        "title": "Topic Title",
                        "content": "Full content text...",
                        "educationalComponents": [
                          { "type": "definition", "content": "..." }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }

      Here is a segment of the text:
      ${chunks.slice(0, 5).join('\n\n---\n\n')} 
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    const text = response.text || '';
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse AI response as JSON', e);
      return { chapters: [] };
    }
  }

  getParsedData(id: string): TextbookStructure | null {
    const filePath = path.join(ParsingPipeline.DATA_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return null;
  }
}

export const pipeline = new ParsingPipeline();
