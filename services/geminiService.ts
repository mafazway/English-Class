import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

export const generateParentMessage = async (
  studentName: string,
  parentName: string,
  topic: string,
  tone: 'formal' | 'friendly' | 'concerned'
): Promise<string> => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key is missing");
    return "AI Service Unavailable (Key Missing).";
  }

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
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate message. Please try again.";
  }
};

export const generateLessonPlan = async (
  topic: string,
  gradeLevel: string,
  duration: string
): Promise<string> => {
  if (!process.env.API_KEY) return "AI Service Unavailable (Key Missing)";

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
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate lesson plan.";
  }
};

export const analyzeStudentProgress = async (
  studentName: string,
  attendanceRate: number,
  notes: string
): Promise<string> => {
  if (!process.env.API_KEY) return "AI Service Unavailable (Key Missing)";
  
  try {
    const prompt = `
      Provide a brief 2-sentence summary of a student's standing for an English teacher's internal notes.
      Student: ${studentName}
      Attendance Rate: ${attendanceRate.toFixed(1)}%
      Teacher Notes: ${notes}
      
      Suggest one area of focus for the next class.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Analysis unavailable due to error.";
  }
}

export const analyzeExamPerformance = async (
  studentName: string,
  history: { date: string; testName: string; score: number; total: number }[]
): Promise<string> => {
  if (!process.env.API_KEY) return "AI Service Unavailable (Key Missing)";

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
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Analysis unavailable due to error.";
  }
};

export const generateContent = async (prompt: string) => {
  if (!process.env.API_KEY) return "AI Service Unavailable (Key Missing)";
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "";
  } catch (error) {
    console.error("Error generating content:", error);
    return "Failed to generate content.";
  }
};