import React, { useState, useEffect } from 'react';
import { Student, ClassGroup, AttendanceRecord } from '../types';
import { Save, Calendar as CalendarIcon, Check, X, RotateCcw, ChevronLeft, ChevronRight, GraduationCap, Clock, MessageCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AttendanceTrackerProps {
  students: Student[];
  classes: ClassGroup[];
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance: (record: AttendanceRecord) => void;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({ students = [], classes = [], attendanceRecords = [], onSaveAttendance }) => {
  const getTodayString = () => new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(getTodayString());
  const [selectedClassId, setSelectedClassId] = useState<string>('All');
  const [selectedTime, setSelectedTime] = useState<string>('All');
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // Unique Options
  const uniqueStartTimes = ['All', ...Array.from(new Set(classes.map(c => c.startTime))).sort()];
  const uniqueClasses = ['All', ...Array.from(new Set(classes.map(c => c.name))).sort()];

  // --- STRICT FILTERING LOGIC ---
  const filteredStudents = students.filter(s => {
    // 1. Grade Matching
    let matchesGrade = true;
    if (selectedClassId !== 'All') {
      const classNum = selectedClassId.match(/\d+/);
      const studentNum = s.grade?.match(/\d+/);
      if (classNum && studentNum) {
        if (classNum[0] !== studentNum[0]) matchesGrade = false;
      } else {
         if (!s.grade?.includes(selectedClassId)) matchesGrade = false; 
      }
    }

    // 2. Time Matching (Intersection)
    let matchesTime = true;
    if (selectedTime !== 'All') {
      const activeClassesAtTime = classes.filter(c => c.startTime === selectedTime);
      if (s.grade) {
         matchesTime = activeClassesAtTime.some(c => c.name.includes(s.grade));
      } else {
         matchesTime = false;
      }
    }

    return matchesGrade && matchesTime;
  });

  // Load Existing Attendance
  useEffect(() => {
    const record = attendanceRecords.find(r => r.date === date && (selectedClassId === 'All' || r.classId === selectedClassId));
    const statusMap: Record<string, boolean> = {};
    
    // Iterate over FILTERED students to prep status
    filteredStudents.forEach(s => {
      statusMap[s.id] = record ? record.studentIdsPresent.includes(s.id) : false;
    });
    setAttendanceStatus(statusMap);
  }, [date, selectedClassId, selectedTime, attendanceRecords]); // Removing 'students' from dependency to avoid loop

  // --- FIXED TOGGLE FUNCTION ---
  const toggleAttendance = (id: string) => {
    setAttendanceStatus(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      return newState;
    });
  };

  const markAll = (isPresent: boolean) => {
    const newStatus: Record<string, boolean> = { ...attendanceStatus };
    filteredStudents.forEach(s => newStatus[s.id] = isPresent);
    setAttendanceStatus(newStatus);
    toast.success(isPresent ? "Marked all Present" : "Reset all");
  };

  const handleSave = () => {
    const classIdToSave = selectedClassId !== 'All' ? selectedClassId : 'general'; 
    const presentIds = Object.keys(attendanceStatus).filter(id => attendanceStatus[id]);
    
    onSaveAttendance({
      id: crypto.randomUUID(),
      classId: classIdToSave,
      date: date,
      studentIdsPresent: presentIds
    });
    toast.success("Attendance Saved!");
  };

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  // Helper for WhatsApp
  const formatSLNumber = (num: string) => {
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 10 && cleaned.startsWith('0')) return '94' + cleaned.substring(1);
    if (cleaned.length === 9) return '94' + cleaned;
    if (cleaned.startsWith('94')) return cleaned;
    return cleaned;
  };

  const sendAbsentAlert = (student: Student, streak: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const number = student.whatsappNumber || student.mobileNumber;
    if (!number) return toast.error("No number found");
    const message = `⚠️ *தொடர் வருகையின்மை (Consecutive Absence)*\n\nஅஸ்ஸலாமு அலைக்கும்,\n\nகடந்த *${streak} வகுப்புகளுக்கு* தொடர்ந்து *${student.name}* சமூகமளிக்கவில்லை என்பதைத் தெரிவித்துக்கொள்கிறோம்.\n\nகாரணத்தை அறியத் தந்தால் உதவியாக இருக்கும்.\n\nநன்றி,\nEnglish Class Academy.`;
    window.open(`https://wa.me/${formatSLNumber(number)}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="p-4 pb-24 space-y-5 bg-gray-50 min-h-full">
      {/* --- HEADER UI (User Preferred) --- */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Attendance</h2>
          <div className="flex gap-2">
             <button onClick={() => markAll(false)} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:text-red-500" title="Reset"><RotateCcw size={18} /></button>
             <button onClick={() => markAll(true)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg">Mark All</button>
          </div>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-2xl mb-4 shadow-sm">
          <button onClick={() => changeDate(-1)} className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><ChevronLeft size={20} /></button>
          <div className="text-center">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
            <div className="flex items-center gap-2 text-lg font-extrabold text-indigo-900">
              <CalendarIcon size={18} className="text-indigo-500 mb-1" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent outline-none cursor-pointer w-auto text-center" />
            </div>
          </div>
          <button onClick={() => changeDate(1)} className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><ChevronRight size={20} /></button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><GraduationCap size={16} className="text-gray-400" /></div>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none appearance-none cursor-pointer">
              {uniqueClasses.map(c => <option key={c} value={c}>{c === 'All' ? 'All Grades' : c}</option>)}
            </select>
          </div>
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Clock size={16} className="text-gray-400" /></div>
            <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full pl-10 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 outline-none appearance-none cursor-pointer">
              {uniqueStartTimes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Times' : t}</option>)}
            </select>
          </div>
        </div>
        
        {/* Count Banner */}
        <div className="mt-4 bg-indigo-50 py-2 px-4 rounded-xl flex justify-between items-center">
           <span className="text-xs font-bold text-indigo-600">Students Found: {filteredStudents.length}</span>
        </div>
      </div>

      {/* STUDENT LIST */}
      <div className="space-y-3">
        {filteredStudents.map(student => {
          const isPresent = !!attendanceStatus[student.id];
          const streak = student.consecutiveAbsences || 0; 
          // Show Alert: Absent NOW + (Streak >= 2 OR Attendance < 50%)
          // Note: Using hard check for Streak >= 2 as requested.
          const showAlert = !isPresent && streak >= 2 && !dismissedAlerts.includes(student.id);

          return (
            <div key={student.id} className={`p-4 rounded-xl shadow-sm border flex items-center justify-between transition-all ${isPresent ? 'bg-white border-gray-200' : 'bg-red-50 border-red-100'}`}>
              
              <div className="flex flex-col">
                <span className={`font-bold ${isPresent ? 'text-gray-800' : 'text-red-700'}`}>{student.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Gr {student.grade}</span>
                  {showAlert && (
                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2">
                      <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">⚠️ {streak}d</span>
                      <button onClick={(e) => sendAbsentAlert(student, streak, e)} className="bg-green-500 text-white p-1 rounded-full hover:bg-green-600 shadow-sm z-20 relative"><MessageCircle size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDismissedAlerts(prev => [...prev, student.id]); }} className="text-gray-400 p-1 z-20 relative"><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* ROBUST TOGGLE SWITCH */}
              <div 
                onClick={() => toggleAttendance(student.id)}
                className={`relative w-14 h-8 rounded-full cursor-pointer transition-colors duration-200 ease-in-out flex items-center p-1 z-10 ${isPresent ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div 
                  className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out flex items-center justify-center ${isPresent ? 'translate-x-6' : 'translate-x-0'}`}
                >
                  {isPresent ? <Check size={14} className="text-green-600" /> : <X size={14} className="text-gray-400" />}
                </div>
              </div>

            </div>
          );
        })}
      </div>

      <div className="fixed bottom-20 left-4 right-4 z-30">
        <button onClick={handleSave} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <Save size={20} /> Save Attendance
        </button>
      </div>
    </div>
  );
};

export default AttendanceTracker;