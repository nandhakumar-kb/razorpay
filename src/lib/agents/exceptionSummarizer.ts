import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const model = genAI?.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function summarizeExceptions(exceptions: any[]): Promise<string> {
  if (exceptions.length === 0) return "No unrecoverable exceptions in this batch.";

  if (!model) {
    return `There are ${exceptions.length} escalated exceptions in the recent batch that require manual review.`;
  }

  const prompt = `
    You are a financial operations assistant.
    Review the following list of escalated/unrecoverable failed transactions:
    ${JSON.stringify(exceptions, null, 2)}
    
    Provide a plain-English, 2-paragraph summary of the main reasons for these escalations, and what the merchant should do (e.g. contact specific customers).
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("LLM Generation failed for summary", error);
    return `There are ${exceptions.length} escalated exceptions that require manual review. Error generating AI summary.`;
  }
}
