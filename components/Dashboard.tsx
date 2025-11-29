
import React, { useState, useMemo, useRef } from 'react';
import { Student, ClassGroup, AttendanceRecord, FeeRecord, View, ExamRecord } from '../types';
import { Users, CheckCircle, FileSpreadsheet, AlertCircle, Save, Cloud, CalendarDays, MoreVertical, Plus, BarChart3, TrendingUp, CreditCard, RefreshCw, Upload, Sun, Bell, Wifi, WifiOff, UploadCloud } from 'lucide-react';
import { Card } from './UIComponents';
import AnalyticsSummary from './AnalyticsSummary';

interface Props {
  students: Student[];
  classes: ClassGroup[];
  attendance: AttendanceRecord[];
  feeRecords: FeeRecord[];
  examRecords: ExamRecord[];
  onRestoreData: (data: any) => void;
  onNavigate: (view: View) => void;
  onBackupComplete?: () => void;
  lastBackupDate?: string | null;
  cloudConnected?: boolean;
  onRefreshData?: () => void;
  onAddStudentClick: () => void;
  isOnline?: boolean;
  pendingSyncCount?: number;
}

// Fixed: Added Type Definitions for Props
const CircularProgress = ({ 
  value, 
  max = 4, 
  size = 36, 
  strokeWidth = 3 
}: { 
  value: number; 
  max?: number; 
  size?: number; 
  strokeWidth?: number; 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value / max, 1);
  const dash = circumference * progress;
  const color = value >= 3 ? 'text-emerald-500' : value >= 1 ? 'text-indigo-500' : 'text-gray-300';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-gray-100" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={circumference - dash} strokeLinecap="round" className={`transition-all duration-1000 ease-out ${color}`} />
      </svg>
      {/* Inner Icon/Text */}
      <div className="absolute text-[9px] font-bold text-gray-500">
         {value}
      </div>
    </div>
  );
};

const Dashboard: React.FC<Props> = ({ students, classes, attendance, feeRecords, examRecords, onRestoreData, onNavigate, onBackupComplete, lastBackupDate, cloudConnected, onRefreshData, onAddStudentClick, isOnline = true, pendingSyncCount = 0 }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const totalStudents = students.length;
  const totalClasses = classes.length;
  
  // Greeting Logic
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  // Stats Logic
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthRecords = attendance.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    return students.map(student => {
      const presentCount = thisMonthRecords.filter(r => r.studentIdsPresent.includes(student.id)).length;
      return { ...student, presentCount };
    }).sort((a, b) => b.presentCount - a.presentCount);
  }, [students, attendance]);

  // Fee Alerts Logic
  const feeAlerts = useMemo(() => {
    let overdueCount = 0;
    let dueSoonCount = 0;
    students.forEach(student => {
      const records = feeRecords.filter(r => r.studentId === student.id);
      const totalPaymentsMade = records.length;
      const joinDateObj = student.joinedDate ? new Date(student.joinedDate) : new Date();
      const billingDay = joinDateObj.getDate();
      let targetMonth = joinDateObj.getMonth() + totalPaymentsMade;
      let targetYear = joinDateObj.getFullYear();
      targetYear += Math.floor(targetMonth / 12);
      targetMonth = targetMonth % 12;
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const actualDay = Math.min(billingDay, daysInTargetMonth);
      const nextDueDate = new Date(targetYear, targetMonth, actualDay);
      nextDueDate.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (nextDueDate <= today) overdueCount++;
      else {
        const diffTime = nextDueDate.getTime() - today.getTime();
        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 7 && daysUntilDue >= 0) dueSoonCount++;
      }
    });
    return { overdueCount, dueSoonCount };
  }, [students, feeRecords]);

  // Consecutive Absence Logic
  const absentAlerts = useMemo(() => {
     if (attendance.length === 0) return [];
     const alerts: {student: Student, streak: number}[] = [];
     const uniqueClassIds = Array.from(new Set(attendance.map(r => r.classId)));
     
     students.forEach(student => {
        let maxStreak = 0;
        uniqueClassIds.forEach(classId => {
           const classHistory = attendance
              .filter(r => r.classId === classId)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5); 
           let streak = 0;
           for (const record of classHistory) {
              if (!record.studentIdsPresent.includes(student.id)) streak++;
              else break;
           }
           if (streak > maxStreak) maxStreak = streak;
        });
        if (maxStreak >= 2) alerts.push({ student, streak: maxStreak });
     });
     return alerts;
  }, [students, attendance]);

  // Handlers
  const handleExport = async () => {
    setIsMenuOpen(false); setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const studentsData = students.map(s => ({ 
        "Admission No": s.admissionNumber || s.id, "Name": s.name, "Grade": s.grade, "Parent Name": s.parentName, "Mobile": s.mobileNumber, "WhatsApp": s.whatsappNumber, "Joined Date": s.joinedDate, "Notes": s.notes
      }));
      const wsStudents = XLSX.utils.json_to_sheet(studentsData);
      
      const classesData = classes.map(c => ({ "Class Name": c.name, "Day": c.day, "Start Time": c.startTime, "Schedule": c.schedule }));
      const wsClasses = XLSX.utils.json_to_sheet(classesData);

      const attendanceData = attendance.map(a => {
         const className = classes.find(c => c.id === a.classId)?.name || 'Unknown Class';
         return { "Date": a.date, "Class": className, "Present Count": a.studentIdsPresent.length };
      });
      const wsAttendance = XLSX.utils.json_to_sheet(attendanceData);

      const feeData = feeRecords.map(f => {
         const student = students.find(s => s.id === f.studentId);
         return { "Student": student?.name || 'Unknown', "Admission No": student?.admissionNumber || '', "Paid Date": f.date, "Amount": f.amount };
      });
      const wsFees = XLSX.utils.json_to_sheet(feeData);

      const examData = examRecords.map(e => {
         const student = students.find(s => s.id === e.studentId);
         return { "Student": student?.name || 'Unknown', "Admission No": student?.admissionNumber || '', "Exam": e.testName, "Date": e.date, "Score": e.score, "Total": e.total, "Percentage": ((e.score / e.total) * 100).toFixed(1) + '%' };
      });
      const wsExams = XLSX.utils.json_to_sheet(examData);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsStudents, "Students");
      XLSX.utils.book_append_sheet(wb, wsClasses, "Timetable");
      XLSX.utils.book_append_sheet(wb, wsAttendance, "Attendance");
      XLSX.utils.book_append_sheet(wb, wsFees, "Fees");
      XLSX.utils.book_append_sheet(wb, wsExams, "Marks");
      
      const fileName = `EnglishClassAcademy_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const fileData = { files: [new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })], title: 'Data Export', text: 'Exporting Excel File' };
      
      if (navigator.share && navigator.canShare && navigator.canShare(fileData)) {
        await navigator.share(fileData);
      } else {
        XLSX.writeFile(wb, fileName);
      }
    } catch (e) { console.error(e); alert("Export failed"); } finally { setIsExporting(false); }
  };

  const handleBackup = async () => {
    setIsMenuOpen(false);
    const backupData = { students, classes, attendance, feeRecords, examRecords, version: 1 };
    const jsonString = JSON.stringify(backupData, null, 2);
    const fileName = `EnglishClassAcademy_Backup_${new Date().toISOString().split('T')[0]}.json`;
    const file = new File([jsonString], fileName, { type: 'application/json' });
    const fileData = { files: [file], title: 'System Backup', text: 'Backup File' };
    try { 
      if (navigator.share && navigator.canShare && navigator.canShare(fileData)) { await navigator.share(fileData); } else {
         const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = fileName; a.click();
      }
    } catch (e) {}
  };

  const handleRestoreClick = () => { fileInputRef.current?.click(); };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
         try { 
           const json = JSON.parse(e.target?.result as string); 
           if(confirm('Restore data? This will merge with existing Cloud data.')) { onRestoreData(json); }
         } catch(e){ alert("Invalid backup file"); }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50" onClick={() => setIsMenuOpen(false)}>
      
      {/* 1. HEADER - Minimalist & Functional */}
      <header className="flex-shrink-0 bg-white px-5 py-3 flex justify-between items-center shadow-sm z-20 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-800 leading-tight">English Academy</h1>
          <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
             <Sun size={10} className="text-orange-400" /> {greeting}
          </p>
        </div>
        <div className="flex items-center gap-1 relative">
           
           {/* Offline/Sync Indicator */}
           {cloudConnected && (
             <div className="mr-1 flex items-center gap-1">
               {isOnline ? (
                 pendingSyncCount > 0 ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold animate-pulse">
                       <UploadCloud size={10} /> Syncing...
                    </div>
                 ) : (
                    <div className="text-green-500" title="Online"><Wifi size={16} /></div>
                 )
               ) : (
                 <div className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-500 rounded-full text-[10px] font-bold">
                    <WifiOff size={10} /> Offline
                 </div>
               )}
             </div>
           )}

           {onRefreshData && (
              <button onClick={(e) => {e.stopPropagation(); onRefreshData()}} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"><RefreshCw size={18} /></button>
           )}
           <button onClick={(e) => {e.stopPropagation(); setIsMenuOpen(!isMenuOpen)}} className="p-2 text-gray-800 hover:bg-gray-100 rounded-full transition-colors"><MoreVertical size={20} /></button>
           
           {/* Smart Dropdown */}
           {isMenuOpen && (
              <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 text-gray-700 py-1 animate-scale-in origin-top-right">
                <button onClick={(e) => {e.stopPropagation(); onNavigate('cloud-settings')}} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50"><Cloud size={16} className="text-indigo-500"/> Cloud Settings</button>
                <button onClick={(e) => {e.stopPropagation(); handleExport()}} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-3"><FileSpreadsheet size={16} className="text-green-600"/> {isExporting ? 'Exporting...' : 'Export Excel to Drive'}</button>
                <button onClick={(e) => {e.stopPropagation(); handleBackup()}} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-3"><Save size={16} className="text-blue-500"/> Backup to Drive / File</button>
                <button onClick={(e) => {e.stopPropagation(); handleRestoreClick()}} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-3 text-orange-600"><Upload size={16}/> Restore from Drive</button>
              </div>
           )}
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
      </header>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden min-h-0">
         
         {/* Pending Sync Alert */}
         {!isOnline && pendingSyncCount > 0 && (
            <div className="bg-orange-100 border border-orange-200 text-orange-800 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-2">
                  <WifiOff size={14} />
                  <span>{pendingSyncCount} changes waiting to sync.</span>
               </div>
            </div>
         )}
         
         {/* Analytics Section */}
         <AnalyticsSummary students={students} attendance={attendance} feeRecords={feeRecords} />

         {/* A. NOTIFICATION TICKER (Fee Alerts) */}
         {(feeAlerts.overdueCount > 0 || feeAlerts.dueSoonCount > 0) && (
            <div onClick={() => onNavigate('fees')} className="flex-shrink-0 bg-red-500 text-white rounded-lg px-3 py-2 flex items-center justify-between shadow-md shadow-red-200 cursor-pointer active:scale-[0.98] transition-transform">
               <div className="flex items-center gap-2">
                  <div className="bg-white/20 p-1 rounded-full"><AlertCircle size={14} className="text-white" /></div>
                  <span className="text-xs font-bold">Fees Attention Required</span>
               </div>
               <span className="text-[10px] bg-white text-red-600 font-bold px-2 py-0.5 rounded-full">{feeAlerts.overdueCount} Overdue</span>
            </div>
         )}
         
         {/* C. QUICK ACTION BAR */}
         <div className="flex-shrink-0 grid grid-cols-2 gap-3">
             <button onClick={() => onNavigate('attendance')} className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-xl p-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 transition-transform">
                 <CheckCircle size={18} />
                 <span className="font-bold text-sm">Mark Attend</span>
             </button>
             <button onClick={onAddStudentClick} className="bg-white text-gray-700 border border-gray-200 rounded-xl p-3 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
                 <Plus size={18} className="text-indigo-600" />
                 <span className="font-bold text-sm">Add Student</span>
             </button>
         </div>

         {/* D. MONTHLY PROGRESS (Horizontal Scroll) */}
         <div className="flex-shrink-0 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col justify-center min-h-[90px]">
            <div className="flex justify-between items-center mb-2 px-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Attendance • {new Date().toLocaleString('default', { month: 'short' })}</span>
               <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">Top Students</span>
            </div>
            {currentMonthStats.length === 0 ? (
               <div className="text-center text-xs text-gray-300 py-1">No activity yet.</div>
            ) : (
               <div className="flex overflow-x-auto gap-4 pb-1 no-scrollbar px-1 items-center">
                  {currentMonthStats.map(student => (
                     <div key={student.id} className="flex flex-col items-center gap-1.5 min-w-[56px] snap-center">
                        <div className="relative">
                           <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                              {student.photo ? <img src={student.photo} className="w-full h-full object-cover"/> : <span className="text-xs font-bold text-gray-400">{student.name.charAt(0)}</span>}
                           </div>
                           <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm ring-1 ring-gray-50">
                              <CircularProgress value={student.presentCount} size={16} strokeWidth={3} />
                           </div>
                        </div>
                        <span className="text-[9px] font-medium text-gray-600 truncate w-16 text-center">{student.name.split(' ')[0]}</span>
                     </div>
                  ))}
               </div>
            )}
         </div>

         {/* E. STATS BENTO GRID (Fills remaining space) */}
         <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
             
             {/* 1. Total Students */}
             <div onClick={() => onNavigate('students')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer active:scale-95 transition-transform hover:border-blue-200 group">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-2 group-hover:scale-110 transition-transform">
                   <Users size={20} />
                </div>
                <div>
                   <h3 className="text-2xl font-bold text-gray-800 leading-none mb-1">{totalStudents}</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Active Students</p>
                </div>
             </div>

             {/* 2. Classes */}
             <div onClick={() => onNavigate('timetable')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer active:scale-95 transition-transform hover:border-pink-200 group">
                <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 mb-2 group-hover:scale-110 transition-transform">
                   <CalendarDays size={20} />
                </div>
                <div>
                   <h3 className="text-2xl font-bold text-gray-800 leading-none mb-1">{totalClasses}</h3>
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Weekly Classes</p>
                </div>
             </div>

             {/* 3. Marks */}
             <div onClick={() => onNavigate('marks')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer active:scale-95 transition-transform hover:border-purple-200 group">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-2 group-hover:scale-110 transition-transform">
                   <TrendingUp size={20} />
                </div>
                <div>
                   <div className="flex items-end gap-1 mb-1">
                      <h3 className="text-2xl font-bold text-gray-800 leading-none">AI</h3>
                      <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded mb-0.5">Analyze</span>
                   </div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Exam Progress</p>
                </div>
             </div>

             {/* 4. Fees */}
             <div onClick={() => onNavigate('fees')} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer active:scale-95 transition-transform hover:border-orange-200 group">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-2 group-hover:scale-110 transition-transform">
                   <CreditCard size={20} />
                </div>
                <div>
                   <div className="flex items-end gap-1 mb-1">
                      <h3 className="text-2xl font-bold text-gray-800 leading-none">{feeAlerts.overdueCount > 0 ? '!' : 'OK'}</h3>
                      {feeAlerts.overdueCount > 0 && <span className="text-[9px] text-red-500 font-bold mb-0.5">Action</span>}
                   </div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Fee Status</p>
                </div>
             </div>

         </div>
         
         {/* Footer Info */}
         <div className="flex-shrink-0 text-center pb-1">
            <p className="text-[9px] text-gray-300 font-medium">English Class Academy • v2.1 (PWA)</p>
         </div>

      </div>
    </div>
  );
};

export default Dashboard;
