
import React, { useState, useEffect, useMemo } from 'react';
import { Student, ClassGroup, AttendanceRecord } from '../types';
import { Save, Calendar as CalendarIcon, Check, X, ChevronLeft, ChevronRight, GraduationCap, Clock, MessageCircle, CalendarOff, CheckCheck, Coffee, ArrowRight, AlertTriangle, Search } from 'lucide-react';
import toast from 'react-hot-toast';

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
  const [searchTerm, setSearchTerm] = useState('');
  
  // Attendance State
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  
  // Communication State
  const [contactedAbsentees, setContactedAbsentees] = useState<string[]>([]);

  // Unique Options
  const uniqueStartTimes = ['All', ...Array.from(new Set(classes.map(c => c.startTime))).sort()];
  const uniqueClasses = ['All', ...Array.from(new Set(classes.map(c => c.name))).sort()];

  // Helper: Format Time
  const formatTime12Hour = (time24: string) => {
    if (!time24 || time24 === 'All') return 'All Times';
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours, 10);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${suffix}`;
  };

  // Helper: Normalize String for Comparison
  const normalize = (str: string | undefined) => {
    if (!str) return '';
    return str.toString().replace(/\D/g, ''); 
  };

  // --- DAY VALIDATION LOGIC ---
  const isClassDay = useMemo(() => {
    const dayIndex = new Date(date).getDay();
    // 0 = Sunday, 1 = Monday, 6 = Saturday
    return [0, 1, 6].includes(dayIndex);
  }, [date]);

  // --- FILTERING LOGIC ---
  const filteredStudents = useMemo(() => {
    if (!isClassDay) return [];

    return students.filter(s => {
      if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      if (selectedClassId !== 'All') {
        const classNum = normalize(selectedClassId);
        const studentNum = normalize(s.grade);
        if (classNum && studentNum) {
          if (classNum !== studentNum) return false;
        } else {
          if (s.grade !== selectedClassId) return false;
        }
      }

      if (selectedTime !== 'All') {
        const classesAtTime = classes.filter(c => c.startTime === selectedTime);
        const studentNum = normalize(s.grade);
        const matchesTime = classesAtTime.some(c => normalize(c.name) === studentNum);
        if (!matchesTime) return false;
      }
      return true;
    });
  }, [students, searchTerm, selectedClassId, selectedTime, classes, isClassDay]);

  // --- RECORD & STATUS LOGIC ---
  const currentRecord = useMemo(() => {
    const targetId = selectedClassId === 'All' ? 'general' : selectedClassId;
    return attendanceRecords.find(r => r.date === date && r.classId === targetId);
  }, [attendanceRecords, date, selectedClassId]);

  const isCancelled = currentRecord?.status === 'cancelled';

  // Load Status and Contacted List
  useEffect(() => {
    const statusMap: Record<string, boolean> = {};
    filteredStudents.forEach(s => {
      statusMap[s.id] = currentRecord ? currentRecord.studentIdsPresent.includes(s.id) : false;
    });
    setAttendanceStatus(statusMap);
    
    if (currentRecord?.contactedAbsentees) {
      setContactedAbsentees(currentRecord.contactedAbsentees);
    } else {
      setContactedAbsentees([]);
    }
  }, [date, selectedClassId, selectedTime, currentRecord, filteredStudents]);

  // --- REAL-TIME ABSENCE LOGIC (STREAK CALCULATION) ---
  const getAbsentStreak = (student: Student) => {
     // 1. Get all past records
     const pastRecords = attendanceRecords.filter(r => r.date < date);
     
     // 2. Group by Date to handle potential duplicates (e.g. 'general' vs 'grade')
     const recordsByDate: Record<string, AttendanceRecord[]> = {};
     pastRecords.forEach(r => {
        if (!recordsByDate[r.date]) recordsByDate[r.date] = [];
        recordsByDate[r.date].push(r);
     });

     // 3. Sort Dates Descending (Recent -> Oldest)
     const sortedDates = Object.keys(recordsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

     let streak = 0;

     for (const dayDate of sortedDates) {
        // STRICT RULE: Ignore Non-Class Days (Tue, Wed, Thu, Fri)
        const d = new Date(dayDate);
        const dayOfWeek = d.getDay();
        if (![0, 1, 6].includes(dayOfWeek)) continue; 

        const daysRecords = recordsByDate[dayDate];
        
        // A. Check for Cancellation (Global or Specific)
        const isDayCancelled = daysRecords.some(r => {
            const rClass = normalize(r.classId);
            const sGrade = normalize(student.grade);
            const applies = r.classId === 'general' || r.classId === 'All' || r.classId === student.grade || (rClass && sGrade && rClass === sGrade);
            return applies && r.status === 'cancelled';
        });

        if (isDayCancelled) continue; // Skip cancelled days completely

        // B. Check Attendance
        // Look for ANY active record that applies to this student for this day
        const activeRecord = daysRecords.find(r => {
            const rClass = normalize(r.classId);
            const sGrade = normalize(student.grade);
            const applies = r.classId === 'general' || r.classId === 'All' || r.classId === student.grade || (rClass && sGrade && rClass === sGrade);
            return applies && r.status !== 'cancelled';
        });

        if (activeRecord) {
             if (activeRecord.studentIdsPresent.includes(student.id)) {
                 break; // Present -> Streak Broken
             } else {
                 streak++; // Absent -> Streak Continues
             }
        }
     }
     return streak;
  };

  // --- ACTIONS ---
  const toggleAttendance = (id: string) => {
    setAttendanceStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const markAll = (isPresent: boolean) => {
    const newStatus: Record<string, boolean> = { ...attendanceStatus };
    filteredStudents.forEach(s => newStatus[s.id] = isPresent);
    setAttendanceStatus(newStatus);
    toast.success(isPresent ? "Marked all Present" : "Reset all");
  };

  const handleToggleCancel = () => {
    const classIdToSave = selectedClassId !== 'All' ? selectedClassId : 'general';
    const recordId = currentRecord?.id || crypto.randomUUID();

    if (isCancelled) {
      // Restore
      onSaveAttendance({
        id: recordId,
        classId: classIdToSave,
        date: date,
        studentIdsPresent: [],
        contactedAbsentees: [], // Reset contacts on restore
        status: 'active'
      });
      toast.success("Class Restored");
    } else {
      // Cancel
      if (!window.confirm("Are you sure you want to CANCEL this class?")) return;
      onSaveAttendance({
        id: recordId,
        classId: classIdToSave,
        date: date,
        studentIdsPresent: [],
        contactedAbsentees: [],
        status: 'cancelled'
      });
      toast.success("Class Cancelled");
    }
  };

  const handleSave = () => {
    if (!isClassDay) return; // Prevent saving on invalid days
    
    const classIdToSave = selectedClassId !== 'All' ? selectedClassId : 'general'; 
    const recordId = currentRecord?.id || crypto.randomUUID();
    const presentIds = Object.keys(attendanceStatus).filter(id => attendanceStatus[id]);
    
    onSaveAttendance({
      id: recordId,
      classId: classIdToSave,
      date: date,
      studentIdsPresent: presentIds,
      contactedAbsentees: contactedAbsentees, // Save the list of messaged parents
      status: 'active'
    });
    toast.success("Attendance Saved!");
  };

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };
  
  const jumpToNextClassDay = () => {
     const d = new Date(date);
     // Find the next Sat (6), Sun (0), or Mon (1)
     let count = 0;
     while (count < 7) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day === 0 || day === 1 || day === 6) {
           setDate(d.toISOString().split('T')[0]);
           return;
        }
        count++;
     }
  };

  const formatSLNumber = (num: string) => {
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 10 && cleaned.startsWith('0')) return '94' + cleaned.substring(1);
    if (cleaned.length === 9) return '94' + cleaned;
    if (cleaned.startsWith('94')) return cleaned;
    return cleaned;
  };

  const sendAbsentAlert = (student: Student, daysAbsent: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const number = student.whatsappNumber || student.mobileNumber;
    if (!number) return toast.error("No number found");
    
    // Tamil Message
    const message = `அஸ்ஸலாமு அலைக்கும். ${student.name} கடந்த சில நாட்களாக (${daysAbsent} Days) வகுப்பிற்கு வரவில்லை. பிள்ளையின் நலன் கருதி, வராததற்கான காரணத்தை அறியத் தந்தால் உதவியாக இருக்கும்.\nநன்றி.`;
    
    window.open(`https://wa.me/${formatSLNumber(number)}?text=${encodeURIComponent(message)}`, '_blank');
    
    // Mark as Contacted Locally
    if (!contactedAbsentees.includes(student.id)) {
       setContactedAbsentees(prev => [...prev, student.id]);
    }
  };

  return (
    <div className="p-4 pb-32 space-y-5 bg-gray-50 min-h-full">
      {/* HEADER */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Attendance</h2>
          
          {/* Controls - Only show on valid class days */}
          {isClassDay && (
            <div className="flex gap-2">
               {!isCancelled && (
                  <>
                    <button onClick={() => markAll(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 hover:text-gray-800">Reset</button>
                    <button onClick={() => markAll(true)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100">Mark All</button>
                  </>
               )}
               
               {/* CANCEL TOGGLE BUTTON */}
               <button 
                  onClick={handleToggleCancel}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 border transition-colors ${
                    isCancelled 
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                      : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                  }`}
               >
                  {isCancelled ? 'Restore Class' : 'Cancel Class'}
               </button>
            </div>
          )}
        </div>

        {/* Date Selector */}
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

        {/* Filters - Only show on valid days */}
        {isClassDay && (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search student..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 placeholder-gray-400 transition-colors text-sm font-medium"
              />
            </div>

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
                  {uniqueStartTimes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Times' : formatTime12Hour(t)}</option>)}
                </select>
              </div>
            </div>
            
            <div className="mt-4 bg-indigo-50 py-2 px-4 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-600">Students Found: {filteredStudents.length}</span>
              {isCancelled && <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">Cancelled</span>}
            </div>
          </>
        )}
      </div>

      {/* STATES: NO CLASS / CANCELLED / LIST */}
      
      {!isClassDay ? (
         // INVALID DAY STATE
         <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm border-dashed animate-fade-in text-center px-6">
            <div className="w-20 h-20 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4 border border-gray-100">
               <Coffee size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">No Classes Scheduled</h3>
            <p className="text-gray-400 text-sm mt-2 max-w-[250px]">
              Classes are only held on <strong>Saturdays</strong>, <strong>Sundays</strong>, and <strong>Mondays</strong>.
            </p>
            <button 
               onClick={jumpToNextClassDay}
               className="mt-6 flex items-center gap-2 bg-indigo-50 text-indigo-600 font-bold px-5 py-2.5 rounded-xl hover:bg-indigo-100 transition-colors"
            >
               Jump to Next Class <ArrowRight size={16} />
            </button>
         </div>
      ) : isCancelled ? (
         // CANCELLED STATE
         <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-gray-200 shadow-sm border-dashed animate-fade-in">
           <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-100">
               <CalendarOff size={32} />
           </div>
           <h3 className="text-xl font-bold text-gray-800">Class Cancelled</h3>
           <p className="text-gray-400 text-sm mt-1 max-w-[250px] text-center">
             Attendance marking is disabled for this day because the class was cancelled.
           </p>
           <button 
             onClick={handleToggleCancel} 
             className="mt-6 text-indigo-600 font-bold text-sm hover:underline bg-indigo-50 px-4 py-2 rounded-lg"
           >
             Restore Class & Attendance
           </button>
        </div>
      ) : (
        // ACTIVE STUDENT LIST
        <div className="space-y-3">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No students found.</div>
          ) : (
            filteredStudents.map(student => {
              const isPresent = !!attendanceStatus[student.id];
              const pastStreak = getAbsentStreak(student);
              const currentStreak = isPresent ? 0 : pastStreak + 1;
              const showAlert = !isPresent && currentStreak >= 2;
              const isContacted = contactedAbsentees.includes(student.id);

              return (
                <div key={student.id} className={`p-4 rounded-xl shadow-sm border flex items-center justify-between transition-all ${isPresent ? 'bg-white border-gray-200' : 'bg-red-50 border-red-100'}`}>
                  
                  <div className="flex flex-col flex-1 min-w-0 pr-2">
                    {/* Name and WhatsApp Icon Row */}
                    <div className="flex items-center gap-2">
                       <span className={`font-bold text-lg truncate ${isPresent ? 'text-gray-800' : 'text-red-700'}`}>{student.name}</span>
                       {showAlert && (
                          <button 
                             onClick={(e) => sendAbsentAlert(student, currentStreak, e)} 
                             className={`p-1.5 rounded-full transition-transform active:scale-90 shadow-sm border flex items-center justify-center ${
                               isContacted 
                                 ? 'bg-green-100 border-green-200 text-green-600' 
                                 : 'bg-green-500 border-green-600 text-white hover:bg-green-600'
                             }`}
                             title={isContacted ? "Message Sent" : "Send WhatsApp Notice"}
                          >
                             {isContacted ? <CheckCheck size={14} strokeWidth={3} /> : <MessageCircle size={14} fill="currentColor" className="text-white" />}
                          </button>
                       )}
                    </div>
                    
                    {/* Grade and Alert Badge Row */}
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider whitespace-nowrap">Gr {student.grade}</span>
                      
                      {showAlert && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={10} strokeWidth={3} />
                            {currentStreak} Days Absent
                        </span>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => toggleAttendance(student.id)}
                    className={`relative z-10 flex-shrink-0 px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 shadow-sm border active:scale-95 ${
                      isPresent 
                        ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' 
                        : 'bg-white text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-400'
                    }`}
                  >
                    {isPresent ? (
                      <> <Check size={16} strokeWidth={3} /> PRESENT </>
                    ) : (
                      <> <X size={16} strokeWidth={3} /> ABSENT </>
                    )}
                  </button>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* SAVE BUTTON - Hide on invalid days or cancelled days */}
      {isClassDay && !isCancelled && (
        <div className="fixed bottom-20 left-4 right-4 z-30">
          <button onClick={handleSave} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Save size={20} /> Save Attendance
          </button>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;
    