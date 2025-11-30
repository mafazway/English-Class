
import React, { useState, useMemo, useRef } from 'react';
import { Student, ExamRecord } from '../types';
import { Plus, TrendingUp, TrendingDown, Minus, Sparkles, Trash2, BarChart3, X, Calendar, User, Trophy, Activity, History, Layers, Save, AlertCircle, AlertTriangle, Edit2, Search } from 'lucide-react';
import { Button, Card, Input, Select } from './UIComponents';
import { analyzeExamPerformance } from '../services/geminiService';
import toast from 'react-hot-toast';

interface Props {
  students: Student[];
  examRecords: ExamRecord[];
  onAddExamRecord: (record: ExamRecord) => void;
  onUpdateExamRecord: (record: ExamRecord) => void;
  onDeleteExamRecord: (id: string) => void;
}

const MarksTracker: React.FC<Props> = ({ students, examRecords, onAddExamRecord, onUpdateExamRecord, onDeleteExamRecord }) => {
  const [viewMode, setViewMode] = useState<'individual' | 'bulk'>('individual');
  
  // --- Individual View State ---
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(''); // Search State
  const [formData, setFormData] = useState({
    studentId: '',
    testName: '',
    score: '',
    total: '100',
    date: new Date().toISOString().slice(0, 10)
  });
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Bulk View State ---
  const [bulkGrade, setBulkGrade] = useState('');
  const [bulkExamName, setBulkExamName] = useState('');
  const [bulkSubject, setBulkSubject] = useState('English');
  const [bulkTotal, setBulkTotal] = useState('100');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkMarks, setBulkMarks] = useState<Record<string, string>>({}); // { studentId: score }

  // --- Derived Data ---

  // Unique Grades for Dropdown
  const uniqueGrades = useMemo(() => {
    return Array.from(new Set(students.map(s => s.grade))).sort();
  }, [students]);

  // Bulk Students List
  const bulkStudents = useMemo(() => {
    if (!bulkGrade) return [];
    return students
      .filter(s => s.grade === bulkGrade)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, bulkGrade]);

  // 1. Overview Records (Filtered by Search or Recent 5)
  const filteredOverviewRecords = useMemo(() => {
    // If search is empty, return only last 5 records
    if (!searchTerm.trim()) {
      return [...examRecords]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
    }

    // If searching, filter all records
    const term = searchTerm.toLowerCase();
    return examRecords.filter(r => {
       const student = students.find(s => s.id === r.studentId);
       const sName = student ? student.name.toLowerCase() : '';
       return sName.includes(term) || r.testName.toLowerCase().includes(term);
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [examRecords, searchTerm, students]);

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

  const openModal = (record?: ExamRecord) => {
    if (record) {
      setEditingId(record.id);
      setFormData({
        studentId: record.studentId,
        testName: record.testName,
        score: record.score.toString(),
        total: record.total.toString(),
        date: record.date
      });
    } else {
      setEditingId(null);
      setFormData(prev => ({ 
        ...prev, 
        studentId: selectedStudentId || prev.studentId || '', // Pre-select if filter is active
        score: '', 
        testName: '' 
      }));
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.score || !formData.total) return;

    const newRecord: ExamRecord = {
      id: editingId || Date.now().toString(),
      studentId: formData.studentId,
      date: formData.date,
      testName: formData.testName || 'Monthly Test',
      score: parseFloat(formData.score),
      total: parseFloat(formData.total)
    };

    if (editingId) {
      onUpdateExamRecord(newRecord);
      toast.success("Mark updated successfully");
    } else {
      onAddExamRecord(newRecord);
      toast.success("Mark saved successfully");
    }
    
    setIsModalOpen(false);
  };

  const handleBulkMarkChange = (studentId: string, value: string) => {
    setBulkMarks(prev => ({
      ...prev,
      [studentId]: value
    }));
  };

  const handleBulkSave = () => {
    if (!bulkGrade || !bulkExamName || !bulkSubject) {
      toast.error("Please select Grade, Exam Name and Subject");
      return;
    }

    const entries = Object.entries(bulkMarks);
    if (entries.length === 0) {
      toast.error("No marks entered");
      return;
    }

    const total = parseFloat(bulkTotal) || 100;
    const testName = `${bulkExamName} - ${bulkSubject}`;
    let savedCount = 0;

    entries.forEach(([studentId, scoreStr]) => {
      if (scoreStr.trim() === '') return;
      const score = parseFloat(scoreStr);
      
      if (!isNaN(score)) {
        if (score > total) {
           // Skip invalid scores or clamp them? Skipping for safety.
           return;
        }

        const newRecord: ExamRecord = {
          id: crypto.randomUUID(),
          studentId,
          date: bulkDate,
          testName: testName,
          score: score,
          total: total
        };
        onAddExamRecord(newRecord);
        savedCount++;
      }
    });

    if (savedCount > 0) {
      toast.success(`Saved marks for ${savedCount} students!`);
      // Reset marks but keep setup
      setBulkMarks({});
    } else {
      toast.error("No valid marks to save.");
    }
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
      {/* Header & View Toggle */}
      <div className="flex flex-col gap-3 bg-white p-4 rounded-b-3xl shadow-sm border-b border-gray-100 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Marks</h2>
          
          {/* View Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('individual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'individual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
            >
              Individual
            </button>
            <button 
              onClick={() => setViewMode('bulk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'bulk' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
            >
              Bulk Entry
            </button>
          </div>
        </div>
        
        {viewMode === 'individual' ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
               <Select 
                 value={selectedStudentId} 
                 onChange={e => { setSelectedStudentId(e.target.value); setAnalysisResult(''); setSearchTerm(''); }}
                 className="!mb-0 !border-gray-200 !bg-gray-50 !rounded-xl !py-2.5 !text-sm"
               >
                 <option value="">Overview (Search / Recent)</option>
                 {students.map(s => (
                   <option key={s.id} value={s.id}>{s.name}</option>
                 ))}
               </Select>
            </div>
            <button 
                onClick={() => openModal()}
                className="bg-indigo-600 text-white px-3 py-2 rounded-xl shadow-md shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center"
            >
                <Plus size={20} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
             {/* Bulk Filters Header */}
             <select 
               value={bulkGrade} 
               onChange={e => setBulkGrade(e.target.value)}
               className="bg-indigo-50 border-indigo-100 text-indigo-700 font-bold text-sm rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
             >
               <option value="">Select Grade</option>
               {uniqueGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
             </select>
             
             <input 
               type="text" 
               placeholder="Exam (e.g. Term 1)"
               value={bulkExamName}
               onChange={e => setBulkExamName(e.target.value)}
               className="bg-white border-gray-200 text-gray-900 border text-sm rounded-xl px-3 py-2 w-32 outline-none focus:ring-2 focus:ring-indigo-500"
             />

             <input 
               type="text" 
               placeholder="Subject"
               value={bulkSubject}
               onChange={e => setBulkSubject(e.target.value)}
               className="bg-white border-gray-200 text-gray-900 border text-sm rounded-xl px-3 py-2 w-28 outline-none focus:ring-2 focus:ring-indigo-500"
             />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="px-1">
        
        {/* ================= BULK ENTRY VIEW ================= */}
        {viewMode === 'bulk' && (
          <div className="px-2 animate-fade-in space-y-4">
             {/* Secondary Inputs */}
             <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <div>
                   <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Max Marks</label>
                   <input 
                     type="number" 
                     value={bulkTotal}
                     onChange={e => setBulkTotal(e.target.value)}
                     className="w-full font-bold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Date</label>
                   <input 
                     type="date" 
                     value={bulkDate}
                     onChange={e => setBulkDate(e.target.value)}
                     className="w-full font-bold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
                   />
                </div>
             </div>

             {/* Student List Grid */}
             {!bulkGrade ? (
                <div className="text-center py-10 text-gray-400">
                  <Layers size={48} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Select a Grade above to start.</p>
                </div>
             ) : bulkStudents.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                   <p className="text-sm">No students found in Grade {bulkGrade}</p>
                </div>
             ) : (
                <div className="space-y-2 pb-20">
                   {bulkStudents.map(student => {
                      const currentMark = bulkMarks[student.id] || '';
                      const isFilled = currentMark !== '';
                      const isInvalid = parseFloat(currentMark) > parseFloat(bulkTotal);

                      return (
                         <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isFilled ? (isInvalid ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-200') : 'bg-white border-gray-200'}`}>
                            <div>
                               <p className="font-bold text-gray-800">{student.name}</p>
                               <p className="text-xs text-gray-500">{student.admissionNumber || 'No ID'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                               <input 
                                 type="number" 
                                 placeholder="-" 
                                 value={currentMark}
                                 onChange={e => handleBulkMarkChange(student.id, e.target.value)}
                                 className={`w-20 text-center font-bold text-lg py-2 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${isInvalid ? 'text-red-600 border-red-300' : 'text-gray-900 border-gray-300'}`}
                               />
                               {isInvalid && <AlertTriangle className="text-red-500" size={16} />}
                            </div>
                         </div>
                      );
                   })}
                </div>
             )}

             {/* Floating Save Button */}
             {bulkGrade && bulkStudents.length > 0 && (
                <div className="fixed bottom-24 left-4 right-4 z-30">
                  <button 
                    onClick={handleBulkSave} 
                    className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Save size={20} /> Save All Marks
                  </button>
                </div>
             )}
          </div>
        )}

        {/* ================= INDIVIDUAL VIEW ================= */}
        {viewMode === 'individual' && !selectedStudentId && (
          <div className="space-y-4 animate-fade-in px-3">
             {/* Search Bar */}
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search student name..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
             </div>

             <div className="flex items-center gap-2 text-gray-500 mb-2">
                <History size={16} />
                <span className="text-sm font-bold uppercase tracking-wide">
                   {searchTerm ? 'Search Results' : 'Recently Added'}
                </span>
             </div>

             {filteredOverviewRecords.length === 0 ? (
               <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                 <BarChart3 size={48} className="mx-auto mb-2 opacity-20" />
                 <p className="text-sm">No records found.</p>
                 {!searchTerm && <p className="text-xs">Tap the + button to add one.</p>}
               </div>
             ) : (
              filteredOverviewRecords.map(record => {
                 const pct = Math.round((record.score / record.total) * 100);
                 const studentName = getStudentName(record.studentId);
                 
                 return (
                   <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden group">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      <div>
                         <p className="font-bold text-gray-800 text-sm">{studentName}</p>
                         <p className="text-xs text-gray-500">{record.testName} • {record.date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                           <span className="text-lg font-bold text-indigo-900">{pct}%</span>
                           <p className="text-[10px] text-gray-400">{record.score}/{record.total}</p>
                        </div>
                        
                        <div className="flex gap-1">
                          <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               openModal(record);
                             }}
                             className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                             title="Edit Record"
                          >
                             <Edit2 size={16} />
                          </button>
                          <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               if(confirm('Are you sure you want to delete this mark?')) {
                                 onDeleteExamRecord(record.id);
                                 toast.success("Record deleted");
                               }
                             }}
                             className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                             title="Delete Record"
                          >
                             <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                   </div>
                 );
               })
             )}
          </div>
        )}

        {viewMode === 'individual' && selectedStudentId && (
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
                        <div className="flex gap-1">
                          <button 
                               onClick={() => openModal(record)}
                               className="text-gray-300 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors"
                             >
                                <Edit2 size={16} />
                          </button>
                          <button 
                               onClick={() => { if(confirm('Delete this record?')) onDeleteExamRecord(record.id); }}
                               className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                             >
                                <Trash2 size={16} />
                          </button>
                        </div>
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

      {/* ADD/EDIT EXAM MODAL (INDIVIDUAL) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up sm:animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="text-indigo-600" /> {editingId ? 'Edit Result' : 'Add Result'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <Select 
                label="Student" 
                value={formData.studentId} 
                onChange={e => setFormData({...formData, studentId: e.target.value})}
                required
                disabled={!!editingId} // Disable student change when editing
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
                <Button type="submit" className="w-full text-lg py-3 shadow-lg shadow-indigo-100">
                  {editingId ? 'Update Result' : 'Save Result'}
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
