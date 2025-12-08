import React, { useState, useEffect, useMemo } from 'react';
import { Student, ClassGroup, AttendanceRecord } from '../types';
import { Save, Calendar as CalendarIcon, Check, X, ChevronLeft, ChevronRight, GraduationCap, Clock, MessageCircle, CalendarOff, CheckCheck, Coffee, ArrowRight, AlertTriangle, Search, Filter, FileText, CheckSquare, BarChart3, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface AttendanceTrackerProps {
  students: Student[];
  classes: ClassGroup[];
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance: (record: AttendanceRecord) => void;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({ students = [], classes = [], attendanceRecords = [], onSaveAttendance }) => {
  const getTodayString = () => new Date().toISOString().split('T')[0];

  // --- VIEW MODE STATE ---
  const [mode, setMode] = useState<'mark' | 'report'>('mark');

  // --- MARKING MODE STATE ---
  const [date, setDate] = useState(getTodayString());
  const [selectedClassId, setSelectedClassId] = useState<string>('All');
  const [selectedTime, setSelectedTime] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- REPORT MODE STATE ---
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(getTodayString());
  const [reportGradeFilter, setReportGradeFilter] = useState('All');

  // Attendance State
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  
  // Communication State
  const [contactedAbsentees, setContactedAbsentees] = useState<string[]>([]);

  // Unique Options - Trim whitespace to prevent duplicates (e.g. "Grade 6" vs "Grade 6 ")
  const uniqueStartTimes = ['All', ...Array.from(new Set(classes.map(c => c.startTime ? c.startTime.trim() : ''))).filter(Boolean).sort()];
  const uniqueClasses = ['All', ...Array.from(new Set(classes.map(c => c.name ? c.name.trim() : ''))).filter(Boolean).sort()];
  const uniqueGrades = ['All', ...Array.from(new Set(students.map(s => s.grade))).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}))];

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

  // --- FUTURE DATE CHECK ---
  const isFutureDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);
    return selected > today;
  }, [date]);

  // --- FILTERING LOGIC ---
  const filteredStudents = useMemo(() => {
    if (mode === 'report') return []; // Handled separately

    if (!isClassDay) return [];

    // Force user to select a filter (Grade or Time) or search before showing list
    if (selectedClassId === 'All' && selectedTime === 'All' && !searchTerm) {
      return [];
    }

    return students.filter(s => {
      // 0. STATUS CHECK: Suspended students are hidden from attendance
      if (s.status === 'temporary_suspended') return false;

      // 1. JOIN DATE CHECK: Ignore students who haven't joined yet
      if (s.joinedDate && date < s.joinedDate) return false;

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
  }, [students, searchTerm, selectedClassId, selectedTime, classes, isClassDay, mode, date]);

  const isWaitingForFilter = isClassDay && selectedClassId === 'All' && selectedTime === 'All' && !searchTerm;

  // --- RECORD & STATUS LOGIC (HIERARCHICAL) ---
  const generalRecord = useMemo(() => attendanceRecords.find(r => r.date === date && r.classId === 'general'), [attendanceRecords, date]);
  const specificRecord = useMemo(() => selectedClassId === 'All' ? null : attendanceRecords.find(r => r.date === date && r.classId === selectedClassId), [attendanceRecords, date, selectedClassId]);

  // Status Hierarchy: Specific > General
  // If Specific Record exists (active/cancelled), use it.
  // Else fall back to General Record.
  const isCancelled = useMemo(() => {
      if (selectedClassId === 'All') return generalRecord?.status === 'cancelled';
      return specificRecord ? specificRecord.status === 'cancelled' : generalRecord?.status === 'cancelled';
  }, [selectedClassId, generalRecord, specificRecord]);


  // Load Status and Contacted List
  useEffect(() => {
    // 1. Calculate Presence based on ALL records for this day (Aggregate View)
    const statusMap: Record<string, boolean> = {};
    const contactedSet = new Set<string>();

    const todaysRecords = attendanceRecords.filter(r => r.date === date);

    students.forEach(s => {
       // Check if student is present in ANY record for today (Grade specific OR General)
       const isPresentAnywhere = todaysRecords.some(r => r.studentIdsPresent.includes(s.id));
       statusMap[s.id] = isPresentAnywhere;
    });
    
    // Aggregate contacted status
    todaysRecords.forEach(r => {
        if(r.contactedAbsentees) {
            r.contactedAbsentees.forEach(id => contactedSet.add(id));
        }
    });

    setAttendanceStatus(statusMap);
    setContactedAbsentees(Array.from(contactedSet));
    
  }, [date, attendanceRecords, students]);

  // --- REPORT STATISTICS LOGIC ---
  const reportData = useMemo(() => {
    if (mode !== 'report') return [];

    // 1. Filter Records by Date Range
    const rangeRecords = attendanceRecords.filter(r => 
       r.date >= reportStartDate && 
       r.date <= reportEndDate && 
       r.status !== 'cancelled'
    );

    // 2. Identify Unique Dates in this range (to avoid double counting double classes)
    const uniqueDates = Array.from(new Set(rangeRecords.map(r => r.date))).sort();

    // 3. Filter Students by Grade
    // NOTE: Suspended students MIGHT appear in reports if they were active during that period,
    // but the prompt implies "off attendance". For simplicity, we filter suspended unless they have records?
    // User request: "off his attendance until he joints again". Usually implies hidden from marking.
    // For reports, it's safer to exclude them if they are CURRENTLY suspended, OR include them?
    // Let's hide them to keep stats clean as per "dashboard shows only available".
    const targetStudents = students.filter(s => {
        if (s.status === 'temporary_suspended') return false; // Exclude from report
        if (reportGradeFilter !== 'All' && s.grade !== reportGradeFilter) return false;
        return true;
    });

    // 4. Calculate Stats for each student
    const stats = targetStudents.map(student => {
       let presentDays = 0;
       let absentDays = 0;
       let totalExpectedDays = 0;

       uniqueDates.forEach(dayDate => {
          // CHECK JOIN DATE
          if (student.joinedDate && dayDate < student.joinedDate) return;

          const dayRecords = rangeRecords.filter(r => r.date === dayDate);
          
          // A. Was student present in ANY record today?
          const isPresent = dayRecords.some(r => r.studentIdsPresent.includes(student.id));

          if (isPresent) {
             presentDays++;
             totalExpectedDays++;
          } else {
             // B. Was student EXPECTED today?
             const isExpected = dayRecords.some(r => {
                const rClass = normalize(r.classId);
                const sGrade = normalize(student.grade);
                return r.classId === 'general' || r.classId === 'All' || r.classId === student.grade || (rClass && sGrade && rClass === sGrade);
             });

             if (isExpected) {
                absentDays++;
                totalExpectedDays++;
             }
          }
       });

       const percentage = totalExpectedDays > 0 ? Math.round((presentDays / totalExpectedDays) * 100) : 0;

       return {
          ...student,
          presentDays,
          absentDays,
          totalExpectedDays,
          percentage
       };
    });

    // Sort by Name
    return stats.sort((a,b) => a.name.localeCompare(b.name));

  }, [mode, reportStartDate, reportEndDate, reportGradeFilter, attendanceRecords, students]);


  // --- REAL-TIME ABSENCE LOGIC (STREAK CALCULATION) ---
  const getAbsentStreak = (student: Student) => {
     // 1. Get all past records
     const pastRecords = attendanceRecords.filter(r => r.date < date);
     
     // 2. Group by Date
     const recordsByDate: Record<string, AttendanceRecord[]> = {};
     pastRecords.forEach(r => {
        if (!recordsByDate[r.date]) recordsByDate[r.date] = [];
        recordsByDate[r.date].push(r);
     });

     // 3. Sort Dates Descending
     const sortedDates = Object.keys(recordsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

     let streak = 0;

     for (const dayDate of sortedDates) {
        // CHECK JOIN DATE: Stop if we go before they joined
        if (student.joinedDate && dayDate < student.joinedDate) break;

        // STRICT RULE: Ignore Non-Class Days
        const d = new Date(dayDate);
        const dayOfWeek = d.getDay();
        if (![0, 1, 6].includes(dayOfWeek)) continue; 

        const daysRecords = recordsByDate[dayDate];
        
        // Filter out cancelled records first
        const activeRecords = daysRecords.filter(r => r.status !== 'cancelled');

        if (activeRecords.length === 0) continue;

        // CHECK 1: Was the student marked present in ANY record for this day?
        const isPresent = activeRecords.some(r => r.studentIdsPresent.includes(student.id));

        if (isPresent) {
           break; // Streak ends (They were present)
        }

        // CHECK 2: If not present, did any record APPLY to them?
        const wasExpected = activeRecords.some(r => {
            const rClass = normalize(r.classId);
            const sGrade = normalize(student.grade);
            return r.classId === 'general' || r.classId === 'All' || r.classId === student.grade || (rClass && sGrade && rClass === sGrade);
        });

        if (wasExpected) {
            streak++;
        }
     }
     return streak;
  };

  // --- ACTIONS ---
  const toggleAttendance = (id: string) => {
    setAttendanceStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const markAll = (isPresent: boolean) => {
    if (filteredStudents.length === 0) return;
    const newStatus: Record<string, boolean> = { ...attendanceStatus };
    filteredStudents.forEach(s => newStatus[s.id] = isPresent);
    setAttendanceStatus(newStatus);
    toast.success(isPresent ? "Marked visible students Present" : "Reset visible students");
  };

  const handleToggleCancel = () => {
    const classIdToSave = selectedClassId !== 'All' ? selectedClassId : 'general';
    
    // Determine ID: If we have a specific record matching our save target, use it. Otherwise new.
    let recordId = crypto.randomUUID();
    if (classIdToSave === 'general' && generalRecord) recordId = generalRecord.id;
    if (classIdToSave !== 'general' && specificRecord) recordId = specificRecord.id;

    if (isCancelled) {
      // Restore
      onSaveAttendance({
        id: recordId,
        classId: classIdToSave,
        date: date as any,
        studentIdsPresent: [],
        contactedAbsentees: [], 
        status: 'active'
      });
      toast.success("Class Restored");
    } else {
      // Cancel
      if (!window.confirm(`Are you sure you want to CANCEL ${selectedClassId === 'All' ? 'ALL classes' : 'this class'} for today?`)) return;
      onSaveAttendance({
        id: recordId,
        classId: classIdToSave,
        date: date as any,
        studentIdsPresent: [],
        contactedAbsentees: [],
        status: 'cancelled'
      });
      toast.success("Class Cancelled");
    }
  };

  const handleSave = () => {
    if (!isClassDay) return; 
    
    const classIdToSave = selectedClassId !== 'All' ? selectedClassId : 'general'; 
    
    // ID Resolution for Save
    let recordId = crypto.randomUUID();
    if (classIdToSave === 'general' && generalRecord) recordId = generalRecord.id;
    if (classIdToSave !== 'general' && specificRecord) recordId = specificRecord.id;
    
    const presentIds = Object.keys(attendanceStatus).filter(id => attendanceStatus[id]);
    
    onSaveAttendance({
      id: recordId,
      classId: classIdToSave,
      date: date as any,
      studentIdsPresent: presentIds,
      contactedAbsentees: contactedAbsentees,
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

  const setRangeWholeYear = () => {
     const y = new Date().getFullYear();
     setReportStartDate(`${y}-01-01`);
     setReportEndDate(`${y}-12-31`);
  };

  const setRangeThisMonth = () => {
     const d = new Date();
     const y = d.getFullYear();
     const m = d.getMonth() + 1;
     // First day
     setReportStartDate(`${y}-${String(m).padStart(2, '0')}-01`);
     // Today
     setReportEndDate(getTodayString());
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
    
    // 1. Update Local State
    let updatedContactedList = [...contactedAbsentees];
    if (!contactedAbsentees.includes(student.id)) {
       updatedContactedList.push(student.id);
       setContactedAbsentees(updatedContactedList);
    }

    // 2. IMMEDIATE SAVE to persist the 'Contacted' double-tick
    // We reuse the logic from handleSave to ensure consistency
    const classIdToSave = selectedClassId !== 'All' ? selectedClassId : 'general';
    let recordId = crypto.randomUUID();
    if (classIdToSave === 'general' && generalRecord) recordId = generalRecord.id;
    if (classIdToSave !== 'general' && specificRecord) recordId = specificRecord.id;

    const presentIds = Object.keys(attendanceStatus).filter(id => attendanceStatus[id]);

    onSaveAttendance({
      id: recordId,
      classId: classIdToSave,
      date: date as any,
      studentIdsPresent: presentIds,
      contactedAbsentees: updatedContactedList, // Use the updated list
      status: 'active'
    });
  };

  return (
    <div className="p-4 pb-32 space-y-5 bg-gray-50 min-h-full">
      {/* HEADER & TOGGLE */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-4 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Attendance</h2>
          
          {/* Mode Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setMode('mark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'mark' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CheckSquare size={14} /> Mark
            </button>
            <button 
              onClick={() => setMode('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileText size={14} /> Report
            </button>
          </div>
        </div>

        {/* --- MARK MODE CONTROLS --- */}
        {mode === 'mark' && (
          <>
             {isClassDay && (
               <div className="flex justify-end gap-2 mb-3">
                  {!isCancelled && !isWaitingForFilter && (
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

             {/* Date Selector */}
             <div className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-2xl mb-4 shadow-sm">
                <button onClick={() => changeDate(-1)} className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"><ChevronLeft size={20} /></button>
                <div className="text-center">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
                  <div className="flex items-center gap-2 text-lg font-extrabold text-indigo-900">
                    <CalendarIcon size={18} className="text-indigo-500 mb-1" />
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent outline-none cursor-pointer w-auto text-center" />
                  </div>
                  {isFutureDate && (
                     <div className="text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full inline-block mt-1">
                       Future Date
                     </div>
                  )}
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
          </>
        )}

        {/* --- REPORT MODE CONTROLS --- */}
        {mode === 'report' && (
           <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Start Date</label>
                    <input 
                      type="date" 
                      value={reportStartDate} 
                      onChange={(e) => setReportStartDate(e.target.value)} 
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 font-bold text-sm"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">End Date</label>
                    <input 
                      type="date" 
                      value={reportEndDate} 
                      onChange={(e) => setReportEndDate(e.target.value)} 
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 font-bold text-sm"
                    />
                 </div>
              </div>

              <div className="flex gap-2">
                 <button onClick={setRangeThisMonth} className="flex-1 py-2 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg border border-indigo-100 hover:bg-indigo-100">
                    This Month
                 </button>
                 <button onClick={setRangeWholeYear} className="flex-1 py-2 bg-purple-50 text-purple-600 text-xs font-bold rounded-lg border border-purple-100 hover:bg-purple-100">
                    Whole Year
                 </button>
              </div>

              <div>
                 <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Filter by Grade</label>
                 <select 
                   value={reportGradeFilter} 
                   onChange={(e) => setReportGradeFilter(e.target.value)}
                   className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white font-bold text-sm text-gray-700 outline-none"
                 >
                    {uniqueGrades.map(g => <option key={g} value={g}>{g === 'All' ? 'All Grades' : `Grade ${g}`}</option>)}
                 </select>
              </div>
           </div>
        )}
      </div>

      {/* --- CONTENT AREA: LISTS --- */}
      
      {mode === 'mark' ? (
        <>
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
            ) : isWaitingForFilter ? (
              // WAITING FOR FILTER STATE
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300 animate-fade-in">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-300 rounded-full flex items-center justify-center mb-4">
                     <Filter size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700">Select a Grade or Time</h3>
                  <p className="text-sm text-gray-400 mt-1">Please choose a filter to view students.</p>
              </div>
            ) : (
              // ACTIVE STUDENT LIST
              <div className="space-y-3">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">No students found matching your criteria.</div>
                ) : (
                  filteredStudents.map(student => {
                    const isPresent = !!attendanceStatus[student.id];
                    const pastStreak = getAbsentStreak(student);
                    
                    // Only count current absence if it's NOT a future date AND NOT cancelled
                    const currentStreak = isPresent ? 0 : ((isFutureDate || isCancelled) ? 0 : pastStreak + 1);
                    
                    // Only show alerts if not in future AND streak is 2 or more
                    const showAlert = !isPresent && currentStreak >= 2 && !isFutureDate;
                    
                    const isContacted = contactedAbsentees.includes(student.id);

                    // --- MONTHLY STATS BADGE (Search Mode Only) ---
                    const monthlyStats = searchTerm ? (() => {
                       const dObj = new Date(date);
                       const m = dObj.getMonth();
                       const y = dObj.getFullYear();
                       const monthRecords = attendanceRecords.filter(r => {
                          const rd = new Date(r.date);
                          return rd.getMonth() === m && rd.getFullYear() === y && r.status !== 'cancelled';
                       });
                       // GROUP BY DATE
                       const uniqueDates = Array.from(new Set(monthRecords.map(r => r.date)));
                       
                       let p = 0; 
                       let a = 0;
                       
                       uniqueDates.forEach(dayDate => {
                          // CHECK JOIN DATE
                          if (student.joinedDate && dayDate < student.joinedDate) return;

                          const dayRecords = monthRecords.filter(r => r.date === dayDate);
                          // Present in ANY record for this day?
                          const isPresent = dayRecords.some(r => r.studentIdsPresent.includes(student.id));
                          if (isPresent) {
                              p++;
                          } else {
                              // Expected in ANY record?
                              const isExpected = dayRecords.some(r => {
                                  const rClass = normalize(r.classId);
                                  const sGrade = normalize(student.grade);
                                  return r.classId === 'general' || r.classId === 'All' || r.classId === student.grade || (rClass && sGrade && rClass === sGrade);
                              });
                              if (isExpected) a++;
                          }
                       });
                       return { p, a, month: dObj.toLocaleString('default', { month: 'short' }) };
                    })() : null;

                    return (
                      <div key={student.id} className={`p-4 rounded-xl shadow-sm border flex items-center justify-between transition-all ${isPresent ? 'bg-white border-gray-200' : 'bg-red-50 border-red-100'}`}>
                        
                        <div className="flex flex-col flex-1 min-w-0 pr-2">
                          {/* Name and WhatsApp Icon Row */}
                          <div className="flex items-center gap-2">
                             <span className={`font-bold text-lg truncate ${isPresent ? 'text-gray-800' : 'text-red-700'}`}>{student.name}</span>
                             
                             {/* WhatsApp Inquiry Button - Shows ONLY on 2nd day absent (streak >= 2) */}
                             {showAlert && (
                                <button 
                                   onClick={(e) => sendAbsentAlert(student, currentStreak, e)} 
                                   className={`p-1.5 rounded-full transition-transform active:scale-90 shadow-sm border flex items-center justify-center ${
                                     isContacted 
                                       ? 'bg-green-100 border-green-200 text-green-600' 
                                       : 'bg-green-500 border-green-600 text-white hover:bg-green-600'
                                   }`}
                                   title={isContacted ? "Inquiry Sent" : "Send Absence Inquiry"}
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
                            
                             {/* MONTHLY STATS BADGE */}
                             {monthlyStats && (
                                 <div className="flex items-center gap-1.5 text-[10px] font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-indigo-700 animate-fade-in">
                                    <span className="text-indigo-400 uppercase">{monthlyStats.month}:</span>
                                    <span className="text-green-600">{monthlyStats.p} Present</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-red-500">{monthlyStats.a} Absent</span>
                                 </div>
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
        </>
      ) : (
         // --- REPORT MODE VIEW ---
         <div className="space-y-3 animate-slide-up">
            <div className="flex justify-between items-center px-2">
               <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Attendance Report</h3>
               <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg font-bold">{reportData.length} Students</span>
            </div>

            {reportData.length === 0 ? (
               <div className="text-center py-10 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                  <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No records found for this period.</p>
               </div>
            ) : (
               reportData.map(stat => (
                  <div key={stat.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                     <div className="flex justify-between items-start mb-2">
                        <div>
                           <h4 className="font-bold text-gray-800 text-lg">{stat.name}</h4>
                           <span className="text-xs text-gray-400 font-medium">Grade {stat.grade}</span>
                        </div>
                        <div className="text-right">
                           <div className="text-2xl font-bold text-indigo-900">{stat.percentage}%</div>
                           <div className="text-[10px] text-gray-400 uppercase font-bold">Attendance</div>
                        </div>
                     </div>

                     {/* Progress Bar */}
                     <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                        <div 
                           className={`h-full transition-all duration-1000 ${stat.percentage >= 75 ? 'bg-green-500' : stat.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                           style={{ width: `${stat.percentage}%` }}
                        />
                     </div>

                     <div className="flex gap-2">
                        <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-2 text-center">
                           <div className="text-lg font-bold text-green-700 leading-none">{stat.presentDays}</div>
                           <div className="text-[9px] font-bold text-green-400 uppercase mt-1">Present</div>
                        </div>
                        <div className="flex-1 bg-red-50 border border-red-100 rounded-lg p-2 text-center">
                           <div className="text-lg font-bold text-red-700 leading-none">{stat.absentDays}</div>
                           <div className="text-[9px] font-bold text-red-400 uppercase mt-1">Absent</div>
                        </div>
                        <div className="flex-1 bg-gray-50 border border-gray-100 rounded-lg p-2 text-center">
                           <div className="text-lg font-bold text-gray-700 leading-none">{stat.totalExpectedDays}</div>
                           <div className="text-[9px] font-bold text-gray-400 uppercase mt-1">Total Days</div>
                        </div>
                     </div>
                  </div>
               ))
            )}
         </div>
      )}

      {/* SAVE BUTTON - Hide on invalid days or cancelled days or in report mode */}
      {/* UPDATE: Removed '!isWaitingForFilter' so button is always visible in mark mode on class days */}
      {mode === 'mark' && isClassDay && !isCancelled && (
        <div className="fixed bottom-24 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="w-full max-w-md px-4 pointer-events-auto">
            <button onClick={handleSave} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Save size={20} /> Save Attendance
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;