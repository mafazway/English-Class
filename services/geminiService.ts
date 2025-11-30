import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google Generative AI client
// The API key must be obtained from process.env.API_KEY
const apiKey = process.env.API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Using gemini-1.5-flash as a stable default for this SDK
const MODEL_NAME = "gemini-1.5-flash";

export const generateParentMessage = async (
  studentName: string,
  parentName: string,
  topic: string,
  tone: 'formal' | 'friendly' | 'concerned'
): Promise<string> => {
  try {
    if (!apiKey) {
      console.warn("Gemini API Key is missing");
      return "AI Service Unavailable (Key Missing).";
    }

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
      Act as an English tuition teacher.
      Write a short, professional WhatsApp message to a parent.
      
      Student Name: ${studentName}
      Parent Name: ${parentName}
      Topic/Reason: ${topic}
      Tone: ${tone}
      
      Keep it concise (under 100 words). Include placeholders for date/time if relevant.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
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
  try {
    if (!apiKey) return "AI Service Unavailable (Key Missing)";

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
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
  try {
    if (!apiKey) return "AI Service Unavailable (Key Missing)";
    
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
      Provide a brief 2-sentence summary of a student's standing for an English teacher's internal notes.
      Student: ${studentName}
      Attendance Rate: ${attendanceRate.toFixed(1)}%
      Teacher Notes: ${notes}
      
      Suggest one area of focus for the next class.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Analysis unavailable due to error.";
  }
}

export const analyzeExamPerformance = async (
  studentName: string,
  history: { date: string; testName: string; score: number; total: number }[]
): Promise<string> => {
  try {
    if (!apiKey) return "AI Service Unavailable (Key Missing)";

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Analysis unavailable due to error.";
  }
};

export const generateContent = async (prompt: string) => {
  try {
    if (!apiKey) {
      console.warn("Gemini API Key is missing. Please check your .env file.");
      return "AI Service Unavailable (Key Missing)";
    }

    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error("Error generating content:", error);
    return "Failed to generate content. Please try again.";
  }
};