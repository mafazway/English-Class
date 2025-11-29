
import { GoogleGenAI } from "@google/genai";

// Safely retrieve API Key. 
// Coding Guidelines: "The API key must be obtained exclusively from the environment variable process.env.API_KEY"
const getApiKey = () => {
  try {
    // Check if process is defined to avoid ReferenceError in strict browser envs
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore errors if process is not available
  }
  return undefined;
};

const apiKey = getApiKey();

// Initialize safely; if no key, we handle errors gracefully in the call
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateParentMessage = async (
  studentName: string,
  parentName: string,
  topic: string,
  tone: 'formal' | 'friendly' | 'concerned'
): Promise<string> => {
  if (!ai) throw new Error("API Key is missing. Please check configuration.");

  try {
    const prompt = `
      Act as an English tuition teacher.
      Write a short, professional WhatsApp message to a parent.
      
      Student Name: ${studentName}
      Parent Name: ${parentName}
      Topic/Reason: ${topic}
      Tone: ${tone}
      
      Keep it concise (under 100 words). Include placeholders for date/time if relevant.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate message.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Failed to generate message. Please try again.");
  }
};

export const generateLessonPlan = async (
  topic: string,
  gradeLevel: string,
  duration: string
): Promise<string> => {
  if (!ai) throw new Error("API Key is missing");

  try {
    const prompt = `
      Create a brief English lesson plan.
      Topic: ${topic}
      Target Audience: Grade ${gradeLevel} students
      Duration: ${duration}
      
      Format the output clearly with:
      1. Learning Objectives
      2. Warm-up activity (5 mins)
      3. Main Activity
      4. Wrap-up/Quiz idea
      
      Use simple markdown formatting.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate lesson plan.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Failed to generate lesson plan.");
  }
};

export const analyzeStudentProgress = async (
  studentName: string,
  attendanceRate: number,
  notes: string
): Promise<string> => {
  if (!ai) throw new Error("API Key is missing");
  
  try {
    const prompt = `
      Provide a brief 2-sentence summary of a student's standing for an English teacher's internal notes.
      Student: ${studentName}
      Attendance Rate: ${attendanceRate.toFixed(1)}%
      Teacher Notes: ${notes}
      
      Suggest one area of focus for the next class.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "Analysis unavailable.";
  } catch (error) {
     return "Analysis unavailable due to error.";
  }
}

export const analyzeExamPerformance = async (
  studentName: string,
  history: { date: string; testName: string; score: number; total: number }[]
): Promise<string> => {
  if (!ai) throw new Error("API Key is missing");

  try {
    const historyStr = history.map(h => `- ${h.date} (${h.testName}): ${h.score}/${h.total}`).join('\n');
    const prompt = `
      Analyze the evolution of test marks for a student named ${studentName}.
      
      Test History:
      ${historyStr}
      
      Provide a concise assessment (approx 50 words).
      1. Identify the trend (Improving, Declining, Stable).
      2. Highlight any significant jumps or drops.
      3. Give 1 encouraging remark or advice for the teacher.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not analyze performance.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Analysis unavailable due to error.";
  }
};
