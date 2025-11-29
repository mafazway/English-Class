import React, { useState } from 'react';
import { Student } from '../types';
import { generateParentMessage, generateLessonPlan, analyzeStudentProgress } from '../services/geminiService';
import { MessageSquare, BookOpen, Sparkles, Copy, Check, BrainCircuit } from 'lucide-react';
import { Button, Card, Input, Select, TextArea } from './UIComponents';

interface Props {
  students: Student[];
}

type ToolType = 'message' | 'lesson' | 'analysis';

const AITeacherAssistant: React.FC<Props> = ({ students }) => {
  const [activeTool, setActiveTool] = useState<ToolType>('message');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  // Message Tool State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [messageTopic, setMessageTopic] = useState('');
  const [messageTone, setMessageTone] = useState<'formal' | 'friendly' | 'concerned'>('friendly');

  // Lesson Tool State
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonGrade, setLessonGrade] = useState('');
  const [lessonDuration, setLessonDuration] = useState('60 mins');

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateMessage = async () => {
    if (!selectedStudentId || !messageTopic) return;
    setLoading(true);
    const student = students.find(s => s.id === selectedStudentId);
    try {
      const text = await generateParentMessage(
        student?.name || 'Student', 
        student?.parentName || 'Parent', 
        messageTopic, 
        messageTone
      );
      setResult(text);
    } catch (e) {
      setResult("Error generating message. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLesson = async () => {
    if (!lessonTopic || !lessonGrade) return;
    setLoading(true);
    try {
      const text = await generateLessonPlan(lessonTopic, lessonGrade, lessonDuration);
      setResult(text);
    } catch (e) {
      setResult("Error generating lesson plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 space-y-6">
      <div className="flex flex-col gap-2 mb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Sparkles className="text-indigo-600" />
          AI Assistant
        </h2>
        <p className="text-sm text-gray-600">Powered by Gemini 2.5 Flash. Generate content in seconds.</p>
      </div>

      {/* Tool Selector */}
      <div className="flex p-1 bg-gray-200 rounded-xl">
        {(['message', 'lesson'] as ToolType[]).map(tool => (
          <button
            key={tool}
            onClick={() => { setActiveTool(tool); setResult(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTool === tool 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tool === 'message' ? 'Parent Message' : 'Lesson Plan'}
          </button>
        ))}
      </div>

      {/* Message Generator */}
      {activeTool === 'message' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={20} className="text-indigo-500" />
            <h3 className="font-semibold">Draft Parent Message</h3>
          </div>

          <Select 
            label="Select Student" 
            value={selectedStudentId} 
            onChange={e => setSelectedStudentId(e.target.value)}
          >
            <option value="">-- Select a student --</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>

          <Input 
            label="Topic / Reason" 
            placeholder="e.g., Missing homework 3 times in a row"
            value={messageTopic}
            onChange={e => setMessageTopic(e.target.value)}
          />

          <Select 
            label="Tone"
            value={messageTone}
            onChange={e => setMessageTone(e.target.value as any)}
          >
            <option value="friendly">Friendly & Encouraging</option>
            <option value="formal">Formal & Direct</option>
            <option value="concerned">Concerned & Serious</option>
          </Select>

          <Button 
            onClick={handleGenerateMessage} 
            disabled={loading || !selectedStudentId || !messageTopic}
            className="w-full"
          >
            {loading ? 'Generating...' : 'Draft Message'}
          </Button>
        </Card>
      )}

      {/* Lesson Planner */}
      {activeTool === 'lesson' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={20} className="text-indigo-500" />
            <h3 className="font-semibold">Quick Lesson Planner</h3>
          </div>

          <Input 
            label="Topic" 
            placeholder="e.g., Past Perfect Tense"
            value={lessonTopic}
            onChange={e => setLessonTopic(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Grade Level" 
              placeholder="e.g., 8"
              value={lessonGrade}
              onChange={e => setLessonGrade(e.target.value)}
            />
            <Select 
              label="Duration"
              value={lessonDuration}
              onChange={e => setLessonDuration(e.target.value)}
            >
              <option value="30 mins">30 mins</option>
              <option value="45 mins">45 mins</option>
              <option value="60 mins">60 mins</option>
              <option value="90 mins">90 mins</option>
            </Select>
          </div>

          <Button 
            onClick={handleGenerateLesson} 
            disabled={loading || !lessonTopic || !lessonGrade}
            className="w-full"
          >
            {loading ? 'Thinking...' : 'Generate Plan'}
          </Button>
        </Card>
      )}

      {/* Result Display */}
      {result && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-600">Generated Result</label>
            <button 
              onClick={handleCopy}
              className="text-xs flex items-center gap-1 text-indigo-600 font-medium"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Text'}
            </button>
          </div>
          <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
            {result}
          </div>
        </div>
      )}
    </div>
  );
};

export default AITeacherAssistant;