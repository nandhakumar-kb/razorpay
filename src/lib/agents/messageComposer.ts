import { GoogleGenerativeAI } from '@google/generative-ai';

// We fall back to a mock if no API key is provided
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const model = genAI?.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function composeRecoveryMessage(
  customerName: string,
  amount: number,
  cause: string,
  action: string
): Promise<{ message: string, confidence: number }> {
  
  if (!model) {
    // Mock implementation for when API key is not present or rate limited
    return {
      message: `Hi ${customerName}, your recent payment of ₹${amount / 100} failed due to ${cause}. We have sent a link to retry.`,
      confidence: 1.0,
    };
  }

  const prompt = `
    You are a professional payment recovery assistant.
    Draft a short SMS (under 160 characters) to ${customerName} whose payment of ₹${amount / 100} just failed.
    The cause of failure was categorized as: "${cause}".
    The action we are taking is: "${action}".
    Make it polite, urgent but not threatening. 
    Only output the message text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return {
      message: response.text().trim(),
      confidence: 0.95,
    };
  } catch (error) {
    console.error("LLM Generation failed, falling back to deterministic", error);
    return {
      message: `Hi ${customerName}, your recent payment of ₹${amount / 100} failed. We have sent a link to retry.`,
      confidence: 0.5,
    };
  }
}
