
import React, { useState, useMemo } from 'react';
import { Student, ExamRecord } from '../types';
import { Plus, TrendingUp, TrendingDown, Minus, Sparkles, Trash2, BarChart3, X, Calendar, User, Trophy, Activity, History } from 'lucide-react';
import { Button, Card, Input, Select } from './UIComponents';
import { analyzeExamPerformance } from '../services/geminiService';

interface Props {
  students: Student[];
  examRecords: ExamRecord[];
  onAddExamRecord: (record: ExamRecord) => void;
  onDeleteExamRecord: (id: string) => void;
}

const MarksTracker: React.FC<Props> = ({ students, examRecords, onAddExamRecord, onDeleteExamRecord }) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    studentId: '',
    testName: '',
    score: '',
    total: '100',
    date: new Date().toISOString().slice(0, 10)
  });

  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Derived Data ---

  // 1. Recent Global History (Last 5 records)
  const recentRecords = useMemo(() => {
    return [...examRecords]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [examRecords]);

  // 2. Selected Student History
  const studentRecords = useMemo(() => {
    if (!selectedStudentId) return [];
    return examRecords
      .filter(r => r.studentId === selectedStudentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedStudentId, examRecords]);

  // 3. Student Statistics
  const studentStats = useMemo(() => {
    if (studentRecords.length === 0) return null;
    
    const totalPercentage = studentRecords.reduce((acc, r) => acc + ((r.score / r.total) * 100), 0);
    const average = Math.round(totalPercentage / studentRecords.length);
    
    const bestRecord = studentRecords.reduce((prev, current) => {
      return ((prev.score / prev.total) > (current.score / current.total)) ? prev : current;
    });

    return {
      average,
      bestSubject: bestRecord.testName,
      bestScore: Math.round((bestRecord.score / bestRecord.total) * 100),
      count: studentRecords.length
    };
  }, [studentRecords]);

  // --- Handlers ---

  const openModal = () => {
    setFormData(prev => ({ 
      ...prev, 
      studentId: selectedStudentId || prev.studentId || '', // Pre-select if filter is active
      score: '', 
      testName: '' 
    }));
    setIsModalOpen(true);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.score || !formData.total) return;

    const newRecord: ExamRecord = {
      id: Date.now().toString(),
      studentId: formData.studentId,
      date: formData.date,
      testName: formData.testName || 'Monthly Test',
      score: parseFloat(formData.score),
      total: parseFloat(formData.total)
    };

    onAddExamRecord(newRecord);
    setIsModalOpen(false);
  };

  const handleAnalyze = async () => {
    if (!selectedStudentId) return;
    setIsAnalyzing(true);
    const student = students.find(s => s.id === selectedStudentId);
    
    if (student && studentRecords.length > 0) {
      const result = await analyzeExamPerformance(student.name, studentRecords);
      setAnalysisResult(result);
    }
    setIsAnalyzing(false);
  };

  // Robust Name Lookup
  const getStudentName = (id: string) => {
    const s = students.find(student => student.id === id);
    return s ? s.name : 'Unknown Student';
  };

  return (
    <div className="pb-24 space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-col gap-3 bg-white p-4 rounded-b-3xl shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Marks Tracker</h2>
          
          {/* Main Add Button in Header */}
          <button 
            onClick={openModal}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={18} strokeWidth={2.5} /> Add Mark
          </button>
        </div>
        
        <div className="relative">
           <Select 
             value={selectedStudentId} 
             onChange={e => { setSelectedStudentId(e.target.value); setAnalysisResult(''); }}
             className="!mb-0 !border-gray-200 !bg-gray-50 !rounded-xl !py-2.5 !text-sm"
           >
             <option value="">Overview (Recent Activity)</option>
             {students.map(s => (
               <option key={s.id} value={s.id}>{s.name}</option>
             ))}
           </Select>
           {!selectedStudentId && (
             <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-400">
               Select student for details
             </div>
           )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-1">
        
        {/* VIEW 1: RECENT ACTIVITY (No Student Selected) */}
        {!selectedStudentId && (
          <div className="space-y-4 animate-fade-in px-3">
             <div className="flex items-center gap-2 text-gray-500 mb-2">
                <History size={16} />
                <span className="text-sm font-bold uppercase tracking-wide">Recently Added</span>
             </div>

             {recentRecords.length === 0 ? (
               <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                 <BarChart3 size={48} className="mx-auto mb-2 opacity-20" />
                 <p className="text-sm">No marks recorded yet.</p>
                 <p className="text-xs">Tap the + button to add one.</p>
               </div>
             ) : (
               recentRecords.map(record => {
                 const pct = Math.round((record.score / record.total) * 100);
                 const studentName = getStudentName(record.studentId);
                 
                 return (
                   <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      <div>
                         <p className="font-bold text-gray-800 text-sm">{studentName}</p>
                         <p className="text-xs text-gray-500">{record.testName} • {record.date}</p>
                      </div>
                      <div className="text-right">
                         <span className="text-lg font-bold text-indigo-900">{pct}%</span>
                         <p className="text-[10px] text-gray-400">{record.score}/{record.total}</p>
                      </div>
                   </div>
                 );
               })
             )}
          </div>
        )}

        {/* VIEW 2: STUDENT DETAILS (Student Selected) */}
        {selectedStudentId && (
          <div className="space-y-4 animate-slide-up px-1">
             
             {/* 1. Summary Cards */}
             {studentStats && (
               <div className="grid grid-cols-2 gap-3">
                  <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-md shadow-indigo-200 relative overflow-hidden">
                     <Activity className="absolute right-2 top-2 text-indigo-400 opacity-50" size={40} />
                     <p className="text-indigo-200 text-xs font-medium uppercase mb-1">Average</p>
                     <h3 className="text-3xl font-bold">{studentStats.average}%</h3>
                     <p className="text-[10px] opacity-80 mt-1">{studentStats.count} tests taken</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                     <Trophy className="absolute right-2 top-2 text-yellow-500 opacity-20" size={40} />
                     <p className="text-gray-400 text-xs font-bold uppercase mb-1">Best Result</p>
                     <h3 className="text-3xl font-bold text-gray-800">{studentStats.bestScore}%</h3>
                     <p className="text-[10px] text-gray-500 mt-1 truncate">{studentStats.bestSubject}</p>
                  </div>
               </div>
             )}

             {/* 2. Mini Chart Visualization */}
             {studentRecords.length > 1 && (
               <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                  <div className="flex justify-between items-end h-24 gap-2 min-w-[200px] px-2">
                     {studentRecords.slice(0, 7).reverse().map((r, i) => {
                        const pct = (r.score / r.total) * 100;
                        return (
                           <div key={i} className="flex flex-col items-center gap-1 group w-full">
                              <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mb-auto">{Math.round(pct)}%</span>
                              <div className="w-2 bg-indigo-100 rounded-full relative h-full flex items-end overflow-hidden">
                                 <div 
                                    className={`w-full rounded-t-full transition-all duration-1000 ${pct >= 75 ? 'bg-green-400' : pct >= 50 ? 'bg-indigo-400' : 'bg-red-400'}`} 
                                    style={{ height: `${pct}%` }} 
                                 />
                              </div>
                              <span className="text-[9px] text-gray-400 truncate max-w-[30px]">{r.date.slice(5)}</span>
                           </div>
                        )
                     })}
                  </div>
               </div>
             )}

             {/* 3. AI Analysis */}
             <div className="flex justify-between items-center mt-2">
               <h3 className="font-bold text-gray-700">Detailed History</h3>
               <button 
                 onClick={handleAnalyze}
                 disabled={isAnalyzing || studentRecords.length < 2}
                 className="text-xs font-bold flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors disabled:opacity-50"
               >
                 <Sparkles size={14} />
                 {isAnalyzing ? 'Thinking...' : 'AI Insight'}
               </button>
             </div>

             {analysisResult && (
               <div className="bg-gradient-to-br from-indigo-50 to-white p-4 rounded-xl border border-indigo-100 text-sm text-gray-700 leading-relaxed animate-fade-in shadow-sm">
                 {analysisResult}
               </div>
             )}

             {/* 4. History List */}
             <div className="space-y-2 pb-20">
                {studentRecords.map((record) => {
                   const pct = Math.round((record.score / record.total) * 100);
                   return (
                     <div key={record.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${pct >= 75 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>
                              {pct}
                           </div>
                           <div>
                              <p className="font-bold text-gray-800 text-sm">{record.testName}</p>
                              <p className="text-xs text-gray-400">{record.date}</p>
                           </div>
                        </div>
                        <button 
                             onClick={() => { if(confirm('Delete?')) onDeleteExamRecord(record.id); }}
                             className="text-gray-300 hover:text-red-500 p-2"
                           >
                              <Trash2 size={16} />
                        </button>
                     </div>
                   );
                })}
                {studentRecords.length === 0 && (
                   <div className="text-center py-8 text-gray-400">No history for this student.</div>
                )}
             </div>
          </div>
        )}
      </div>

      {/* ADD EXAM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up sm:animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="text-indigo-600" /> Add Exam Result
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <Select 
                label="Student" 
                value={formData.studentId} 
                onChange={e => setFormData({...formData, studentId: e.target.value})}
                required
              >
                <option value="">-- Select Student --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>

              <Input 
                 label="Test Name" 
                 placeholder="e.g. Term 1 Final" 
                 value={formData.testName}
                 onChange={e => setFormData({...formData, testName: e.target.value})}
                 required
              />
              
              <Input 
                label="Date" 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Score" 
                  type="number" 
                  placeholder="0" 
                  value={formData.score}
                  onChange={e => setFormData({...formData, score: e.target.value})}
                  required
                />
                <Input 
                  label="Total Marks" 
                  type="number" 
                  placeholder="100" 
                  value={formData.total}
                  onChange={e => setFormData({...formData, total: e.target.value})}
                  required
                />
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full text-lg py-3">
                  Save Result
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarksTracker;
