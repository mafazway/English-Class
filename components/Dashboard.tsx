
import React, { useState, useMemo, useRef } from 'react';
import { Student, ClassGroup, AttendanceRecord, FeeRecord, View, ExamRecord } from '../types';
import { Users, CheckCircle, FileSpreadsheet, AlertCircle, Save, Cloud, CalendarDays, MoreVertical, Plus, TrendingUp, CreditCard, RefreshCw, Upload, Sun, Wifi, WifiOff, UploadCloud, Search, X, Calendar, ArrowRight, UserPlus, Wallet, Bell, ChevronRight, GraduationCap, Clock, Award, LayoutGrid, ChevronDown } from 'lucide-react';
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

const Dashboard: React.FC<Props> = ({ students, classes, attendance, feeRecords, examRecords, onRestoreData, onNavigate, onBackupComplete, lastBackupDate, cloudConnected, onRefreshData, onAddStudentClick, isOnline = true, pendingSyncCount = 0 }) => {
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // FILTER ACTIVE STUDENTS
  const activeStudents = useMemo(() => students.filter(s => s.status !== 'temporary_suspended'), [students]);
  const totalStudents = activeStudents.length;

  // --- STATS LOGIC ---
  const normalize = (str: string | undefined) => str ? str.toString().replace(/\D/g, '') : '';

  const getAttendanceStats = (student: Student) => {
    if (student.status === 'temporary_suspended') return { p: 0, a: 0 };
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const relevantRecords = attendance.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && r.status !== 'cancelled';
    });
    const uniqueDates = Array.from(new Set(relevantRecords.map(r => r.date)));
    let p = 0; let a = 0;
    uniqueDates.forEach(date => {
        if (student.joinedDate && date < student.joinedDate) return;
        const dayRecords = relevantRecords.filter(r => r.date === date);
        const isPresent = dayRecords.some(r => r.studentIdsPresent.includes(student.id));
        if (isPresent) p++;
        else {
            const isExpected = dayRecords.some(r => {
                const rClass = normalize(r.classId);
                const sGrade = normalize(student.grade);
                return r.classId === 'general' || r.classId === 'All' || r.classId === student.grade || (rClass && sGrade && rClass === sGrade);
            });
            if (isExpected) a++;
        }
    });
    return { p, a };
  };

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return [];
    return activeStudents.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [activeStudents, searchTerm]);

  // Fee Alerts
  const feeAlerts = useMemo(() => {
    let overdueCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activeStudents.forEach(student => {
      const paymentCount = feeRecords.filter(r => r.studentId === student.id).length;
      let joinDate = new Date();
      if (student.joinedDate) {
         const [y, m, d] = student.joinedDate.split('-').map(Number);
         joinDate = new Date(y, m - 1, d);
      }
      const nextDueDate = new Date(joinDate);
      nextDueDate.setMonth(joinDate.getMonth() + paymentCount);
      nextDueDate.setDate(0); 
      nextDueDate.setHours(0,0,0,0);
      if (nextDueDate < today) overdueCount++;
    });
    return { overdueCount };
  }, [activeStudents, feeRecords]);

  // Attendance Rate Calculation
  const attendanceRate = useMemo(() => {
    const now = new Date();
    const currentRecords = attendance.filter(r => {
       const d = new Date(r.date);
       return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.status !== 'cancelled';
    });
    if (currentRecords.length === 0) return 0;
    let present = 0; let total = 0;
    currentRecords.forEach(r => {
       present += r.studentIdsPresent.length;
       // Estimate total expected (simplified)
       total += activeStudents.length; 
    });
    return total === 0 ? 0 : Math.round((present / total) * 100);
  }, [attendance, activeStudents]);

  const todaysClassesCount = useMemo(() => {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    return classes.filter(c => c.day === todayName).length;
  }, [classes]);

  // Handlers (Export/Backup/Restore preserved)
  const handleExport = async () => {
    setIsMenuOpen(false); setIsExporting(true);
    try {
      // @ts-ignore
      const XLSX = await import('xlsx');
      const studentsData = students.map(s => ({ "Admission No": s.admissionNumber, "Name": s.name, "Grade": s.grade, "Mobile": s.mobileNumber }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentsData), "Students");
      XLSX.writeFile(wb, "AcademyData.xlsx");
    } catch (e) { alert("Export failed"); } finally { setIsExporting(false); }
  };
  
  const handleRestoreClick = () => { fileInputRef.current?.click(); };
  const handleFileChange = (e: any) => { 
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
             try { onRestoreData(JSON.parse(ev.target?.result as string)); } catch(e){ alert("Invalid Backup File"); }
        };
        reader.readAsText(file);
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50" onClick={() => setIsMenuOpen(false)}>
      
      {/* 1. PROFESSIONAL HEADER */}
      <header className="bg-white/90 backdrop-blur-xl px-5 py-4 flex flex-col gap-4 sticky top-0 z-30 border-b border-gray-100 shadow-sm">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                  E
               </div>
               <div>
                 <h1 className="text-lg font-bold text-gray-900 leading-tight">English Academy</h1>
                 <p className="text-xs text-gray-500 font-medium">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
               </div>
            </div>
            
            <div className="flex items-center gap-2">
               {cloudConnected && (
                 <div className={`p-2 rounded-full border ${isOnline ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    {isOnline ? (
                         pendingSyncCount > 0 ? <UploadCloud size={18} className="text-orange-500 animate-pulse"/> : <Wifi size={18} className="text-green-600"/>
                    ) : <WifiOff size={18} className="text-red-500"/>}
                 </div>
               )}

               <button 
                  onClick={onRefreshData} 
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative"
                  title="Sync Now"
               >
                  <RefreshCw size={20} />
               </button>

               <button onClick={(e) => {e.stopPropagation(); setIsMenuOpen(!isMenuOpen)}} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative">
                  <MoreVertical size={20} />
               </button>
               
               {isMenuOpen && (
                  <div className="absolute right-4 top-16 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 animate-scale-in">
                    <button onClick={() => onNavigate('cloud-settings')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium"><Cloud size={16}/> Cloud Settings</button>
                    <button onClick={handleExport} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium"><FileSpreadsheet size={16}/> Export Excel</button>
                    <button onClick={handleRestoreClick} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 font-medium border-t border-gray-50"><Upload size={16}/> Restore Data</button>
                  </div>
               )}
            </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600" size={18} />
           <input 
             type="text" 
             placeholder="Search students..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-semibold transition-all"
           />
           {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full text-gray-600"><X size={12}/></button>}
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
      </header>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-5">
         
         {/* SEARCH RESULTS OVERLAY */}
         {searchTerm ? (
           <div className="space-y-3 animate-fade-in">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Search Results</h3>
              {filteredStudents.length === 0 ? (
                 <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">No students found</div>
              ) : (
                filteredStudents.map(s => {
                  const stats = getAttendanceStats(s);
                  return (
                    <div key={s.id} onClick={() => { onNavigate('students'); }} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm cursor-pointer hover:border-indigo-200">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">{s.name.charAt(0)}</div>
                         <div>
                            <p className="font-bold text-gray-800 text-sm">{s.name}</p>
                            <p className="text-xs text-gray-500">Grade {s.grade}</p>
                         </div>
                      </div>
                      <div className="flex gap-2 text-xs font-bold">
                         <span className="text-green-600 bg-green-50 px-2 py-1 rounded">{stats.p} P</span>
                         <span className="text-red-500 bg-red-50 px-2 py-1 rounded">{stats.a} A</span>
                      </div>
                    </div>
                  );
                })
              )}
           </div>
         ) : (
           <>
              {/* ANALYTICS SUMMARY (ACADEMY INSIGHTS) - Moved to Top */}
              <AnalyticsSummary 
                  students={students} 
                  attendance={attendance} 
                  feeRecords={feeRecords} 
              />

              {/* ALERT BANNER */}
              {feeAlerts.overdueCount > 0 && (
                <div 
                   onClick={() => onNavigate('fees')}
                   className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
                >
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                         <AlertCircle size={20} />
                      </div>
                      <div>
                         <p className="text-red-900 font-bold text-sm">Fees Attention Required</p>
                         <p className="text-red-700 text-xs">{feeAlerts.overdueCount} students have overdue payments</p>
                      </div>
                   </div>
                   <div className="bg-white text-red-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-red-100">
                      {feeAlerts.overdueCount} Overdue
                   </div>
                </div>
              )}

              {/* STATS GRID */}
              <div className="grid grid-cols-2 gap-3">
                 <div onClick={() => onNavigate('students')} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-gray-500 font-bold text-[10px] uppercase tracking-wider">Total Students</span>
                       <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg"><Users size={16} /></div>
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-1">{totalStudents}</div>
                    <div className="text-xs text-gray-400 font-medium">Active Accounts</div>
                 </div>

                 <div onClick={() => onNavigate('attendance')} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-gray-500 font-bold text-[10px] uppercase tracking-wider">Attendance</span>
                       <div className="bg-green-50 text-green-600 p-1.5 rounded-lg"><CheckCircle size={16} /></div>
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-1">{attendanceRate}%</div>
                    <div className="text-xs text-gray-400 font-medium">This Month Average</div>
                 </div>

                 <div onClick={() => onNavigate('fees')} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-gray-500 font-bold text-[10px] uppercase tracking-wider">Fee Status</span>
                       <div className="bg-orange-50 text-orange-600 p-1.5 rounded-lg"><Wallet size={16} /></div>
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-1">{activeStudents.length - feeAlerts.overdueCount}</div>
                    <div className="text-xs text-gray-400 font-medium">Paid Students</div>
                 </div>

                 <div onClick={() => onNavigate('timetable')} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-gray-500 font-bold text-[10px] uppercase tracking-wider">Classes</span>
                       <div className="bg-purple-50 text-purple-600 p-1.5 rounded-lg"><CalendarDays size={16} /></div>
                    </div>
                    <div className="text-3xl font-black text-gray-900 mb-1">{todaysClassesCount}</div>
                    <div className="text-xs text-gray-400 font-medium">Scheduled Today</div>
                 </div>
              </div>

              {/* ACTION GRID */}
              <div>
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Quick Actions</h3>
                 <div className="grid grid-cols-2 gap-3">
                    <button 
                       onClick={() => onNavigate('attendance')} 
                       className="flex items-center gap-3 p-3.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
                    >
                       <div className="bg-white/20 p-2 rounded-lg"><CheckCircle size={18} /></div>
                       <div className="text-left">
                          <div className="text-sm font-bold">Mark Attend</div>
                          <div className="text-[10px] opacity-80 font-medium">Class Register</div>
                       </div>
                    </button>

                    <button 
                       onClick={onAddStudentClick} 
                       className="flex items-center gap-3 p-3.5 bg-white border border-gray-200 text-gray-800 rounded-xl shadow-sm hover:bg-gray-50 active:scale-95 transition-transform"
                    >
                       <div className="bg-gray-100 text-gray-600 p-2 rounded-lg"><UserPlus size={18} /></div>
                       <div className="text-left">
                          <div className="text-sm font-bold">Add Student</div>
                          <div className="text-[10px] text-gray-400 font-medium">New Admission</div>
                       </div>
                    </button>

                    <button 
                       onClick={() => onNavigate('fees')} 
                       className="flex items-center gap-3 p-3.5 bg-white border border-gray-200 text-gray-800 rounded-xl shadow-sm hover:bg-gray-50 active:scale-95 transition-transform"
                    >
                       <div className="bg-orange-50 text-orange-500 p-2 rounded-lg"><CreditCard size={18} /></div>
                       <div className="text-left">
                          <div className="text-sm font-bold">Record Fee</div>
                          <div className="text-[10px] text-gray-400 font-medium">Payment Entry</div>
                       </div>
                    </button>

                    <button 
                       onClick={() => onNavigate('marks')} 
                       className="flex items-center gap-3 p-3.5 bg-white border border-gray-200 text-gray-800 rounded-xl shadow-sm hover:bg-gray-50 active:scale-95 transition-transform"
                    >
                       <div className="bg-purple-50 text-purple-500 p-2 rounded-lg"><Award size={18} /></div>
                       <div className="text-left">
                          <div className="text-sm font-bold">Add Marks</div>
                          <div className="text-[10px] text-gray-400 font-medium">Exam Results</div>
                       </div>
                    </button>
                 </div>
              </div>
              
              {/* CLOUD PROMO / STATUS */}
              <div onClick={() => onNavigate('ai-tools')} className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white relative overflow-hidden cursor-pointer shadow-lg shadow-indigo-200">
                 <div className="relative z-10 flex justify-between items-center">
                    <div>
                       <h3 className="font-bold text-lg flex items-center gap-2"><Sun size={18} className="text-yellow-300 animate-spin-slow"/> AI Teacher Assistant</h3>
                       <p className="text-indigo-100 text-xs mt-1">Generate lesson plans & messages instantly.</p>
                    </div>
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                       <ArrowRight size={20} />
                    </div>
                 </div>
                 {/* Decorative circles */}
                 <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                 <div className="absolute top-0 left-0 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
              </div>

           </>
         )}
      </div>
    </div>
  );
};

export default Dashboard;
