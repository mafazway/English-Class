
import React, { useState, useMemo } from 'react';
import { Student, AttendanceRecord, FeeRecord } from '../types';
import { BarChart3, ChevronDown, ChevronUp, Users, AlertTriangle, CheckCircle2, TrendingUp, User, UserCircle, CalendarCheck, ClipboardList } from 'lucide-react';
import { Card } from './UIComponents';

interface Props {
  students: Student[];
  attendance: AttendanceRecord[];
  feeRecords: FeeRecord[];
}

const AnalyticsSummary: React.FC<Props> = ({ students, attendance, feeRecords }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. Student Demographics & Gender
  const studentStats = useMemo(() => {
    const gradeMap: Record<string, number> = {};
    let maleCount = 0;
    let femaleCount = 0;

    students.forEach(s => {
      const g = s.grade || 'Unknown';
      gradeMap[g] = (gradeMap[g] || 0) + 1;
      
      if (s.gender === 'Female') femaleCount++;
      else maleCount++; // Default to male if undefined or Male
    });

    const total = students.length;
    const sortedGrades = Object.entries(gradeMap).sort((a, b) => 
      a[0].localeCompare(b[0], undefined, { numeric: true })
    );

    const malePct = total > 0 ? (maleCount / total) * 100 : 0;
    
    return { total, grades: sortedGrades, maleCount, femaleCount, malePct };
  }, [students]);

  // 1.5 Class-wise Gender Breakdown
  const classBreakdown = useMemo(() => {
    const groups: Record<string, { m: number, f: number }> = {};
    
    students.forEach(s => {
      const g = s.grade || 'Unknown';
      if (!groups[g]) groups[g] = { m: 0, f: 0 };
      
      if (s.gender === 'Female') groups[g].f++;
      else groups[g].m++;
    });

    return Object.entries(groups)
      .map(([grade, counts]) => ({ grade, ...counts }))
      .sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));
  }, [students]);

  // 2. Attendance Rate (Current Month)
  const attendanceStats = useMemo(() => {
    const now = new Date();
    const currentMonthRecords = attendance.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    if (currentMonthRecords.length === 0 || students.length === 0) return { rate: 0, label: 'No data yet' };

    let totalPresent = 0;
    currentMonthRecords.forEach(r => {
      totalPresent += r.studentIdsPresent.length;
    });

    // Approximation: Total slots = Number of classes held * Total Active Students
    const totalSlots = currentMonthRecords.length * students.length; 
    const rate = Math.round((totalPresent / totalSlots) * 100) || 0;
    
    return { rate, label: 'This Month' };
  }, [attendance, students]);

  // 3. Top Absentees (Risk List)
  const absenteesList = useMemo(() => {
    const absenceCount: Record<string, number> = {};
    
    attendance.forEach(r => {
      students.forEach(s => {
        if (!r.studentIdsPresent.includes(s.id)) {
           absenceCount[s.name] = (absenceCount[s.name] || 0) + 1;
        }
      });
    });

    const topRisks = Object.entries(absenceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
      
    return topRisks;
  }, [attendance, students]);

  // 4. Fee Status (Current Month)
  const feeStats = useMemo(() => {
    const now = new Date();
    let paidCount = 0;
    
    students.forEach(s => {
       const hasPaid = feeRecords.some(r => {
          const d = new Date(r.date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.studentId === s.id;
       });
       if (hasPaid) paidCount++;
    });

    const unpaidCount = students.length - paidCount;
    const paidPct = students.length > 0 ? (paidCount / students.length) * 100 : 0;

    return { paidCount, unpaidCount, paidPct };
  }, [students, feeRecords]);

  // 5. Grade-wise Performance (Today's Attendance)
  const gradePerformance = useMemo(() => {
     // Get local date string for "Today"
     const d = new Date();
     const year = d.getFullYear();
     const month = String(d.getMonth() + 1).padStart(2, '0');
     const day = String(d.getDate()).padStart(2, '0');
     const todayStr = `${year}-${month}-${day}`;

     // 1. Identify all students present today (across any class)
     const presentIds = new Set<string>();
     attendance.filter(r => r.date === todayStr).forEach(r => {
        r.studentIdsPresent.forEach(id => presentIds.add(id));
     });

     // 2. Group by Grade
     const groups: Record<string, { total: number, present: number }> = {};
     students.forEach(s => {
        const g = s.grade || 'Unknown';
        if (!groups[g]) groups[g] = { total: 0, present: 0 };
        
        groups[g].total++;
        if (presentIds.has(s.id)) groups[g].present++;
     });

     return Object.entries(groups)
        .map(([grade, stats]) => ({ grade, ...stats }))
        .sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));

  }, [students, attendance]);


  return (
    <div className="flex-shrink-0 px-4 mt-2 mb-2">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-indigo-100 text-indigo-900 font-bold text-sm active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-2">
           <BarChart3 size={18} className="text-indigo-600" />
           <span>Academy Insights</span>
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="grid grid-cols-2 gap-3 mt-3 animate-slide-up">
           
           {/* Card 1: Student Overview with Gender Ratio */}
           <Card className="p-3 bg-gradient-to-br from-indigo-50 to-white border-indigo-100 flex flex-col justify-between">
              <div className="flex items-start justify-between mb-1">
                 <h4 className="text-[10px] font-bold text-gray-500 uppercase">Total Students</h4>
                 <Users size={14} className="text-indigo-400" />
              </div>
              
              <div className="flex justify-between items-end mb-2">
                 <div className="text-2xl font-bold text-indigo-900">{studentStats.total}</div>
                 {/* Gender Bar */}
                 <div className="flex flex-col items-end gap-1 flex-1 ml-4">
                    <div className="flex text-[9px] gap-2 font-bold opacity-80">
                       <span className="text-blue-500">M: {studentStats.maleCount}</span>
                       <span className="text-pink-500">F: {studentStats.femaleCount}</span>
                    </div>
                    <div className="w-full h-1.5 bg-pink-200 rounded-full overflow-hidden flex">
                       <div className="h-full bg-blue-400" style={{ width: `${studentStats.malePct}%` }}></div>
                    </div>
                 </div>
              </div>
           </Card>

           {/* Card 2: Attendance Rate */}
           <Card className="p-3 bg-white border-gray-100">
              <div className="flex items-start justify-between mb-2">
                 <h4 className="text-[10px] font-bold text-gray-500 uppercase">Avg Attendance</h4>
                 <TrendingUp size={14} className="text-green-500" />
              </div>
              <div className="flex items-end gap-2 mb-2">
                 <span className="text-2xl font-bold text-gray-800">{attendanceStats.rate}%</span>
                 <span className="text-[9px] text-gray-400 mb-1">{attendanceStats.label}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                 <div 
                   className="bg-green-500 h-full rounded-full transition-all duration-1000" 
                   style={{ width: `${attendanceStats.rate}%` }}
                 />
              </div>
           </Card>

           {/* Card 3: Top Absentees */}
           <Card className="p-3 bg-red-50/50 border-red-100">
              <div className="flex items-start justify-between mb-2">
                 <h4 className="text-[10px] font-bold text-red-400 uppercase">Most Absent</h4>
                 <AlertTriangle size={14} className="text-red-400" />
              </div>
              <ul className="space-y-1">
                 {absenteesList.length > 0 ? (
                    absenteesList.map(([name, count]) => (
                       <li key={name} className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-700 truncate max-w-[70px] font-medium">{name}</span>
                          <span className="bg-red-100 text-red-700 px-1.5 rounded-full font-bold">{count}</span>
                       </li>
                    ))
                 ) : (
                    <span className="text-[10px] text-gray-400">No data available</span>
                 )}
              </ul>
           </Card>

           {/* Card 4: Fee Status (Pie Chart) */}
           <Card className="p-3 bg-white border-gray-100 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                 <h4 className="text-[10px] font-bold text-gray-500 uppercase">Fee Status</h4>
                 <CheckCircle2 size={14} className="text-indigo-400" />
              </div>
              
              <div className="flex items-center gap-3 mt-1">
                 {/* CSS Conic Gradient Pie Chart */}
                 <div 
                   className="w-10 h-10 rounded-full flex-shrink-0"
                   style={{ 
                     background: `conic-gradient(#4f46e5 0% ${feeStats.paidPct}%, #f3f4f6 ${feeStats.paidPct}% 100%)` 
                   }}
                 >
                    <div className="w-7 h-7 bg-white rounded-full m-1.5" />
                 </div>
                 
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-600">
                       <b className="text-indigo-600">{feeStats.paidCount}</b> Paid
                    </span>
                    <span className="text-[10px] text-gray-600">
                       <b className="text-gray-400">{feeStats.unpaidCount}</b> Unpaid
                    </span>
                 </div>
              </div>
           </Card>

           {/* NEW CARD: Class-wise Performance List */}
           <Card className="col-span-2 p-3 bg-white border-gray-100 overflow-hidden">
               <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                     <CalendarCheck size={12} /> Today's Performance by Class
                  </h4>
               </div>
               
               <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                  {gradePerformance.length === 0 ? (
                     <p className="text-xs text-center text-gray-400 py-4">No students available.</p>
                  ) : (
                     gradePerformance.map(item => {
                        const pct = item.total > 0 ? (item.present / item.total) * 100 : 0;
                        const colorClass = pct === 100 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700';
                        const barColor = pct === 100 ? 'bg-green-200' : pct >= 50 ? 'bg-indigo-200' : 'bg-orange-200';
                        
                        return (
                           <div key={item.grade} className="relative rounded-lg overflow-hidden border border-gray-100">
                              {/* Background Progress Bar */}
                              <div className={`absolute top-0 bottom-0 left-0 ${barColor} opacity-50 transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
                              
                              <div className="relative flex justify-between items-center p-2 text-xs z-10">
                                 <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800">Grade {item.grade}</span>
                                    <span className="text-[9px] text-gray-500">Total: {item.total}</span>
                                 </div>
                                 <div className="flex items-center gap-1 font-bold">
                                    {item.present > 0 ? (
                                       <span className={`${colorClass} px-1.5 py-0.5 rounded flex items-center gap-1`}>
                                          {pct === 100 ? <CheckCircle2 size={10} /> : <ClipboardList size={10} />}
                                          {item.present} Present
                                       </span>
                                    ) : (
                                       <span className="text-gray-400 text-[10px]">No Attendance</span>
                                    )}
                                 </div>
                              </div>
                           </div>
                        );
                     })
                  )}
               </div>
           </Card>

           {/* Class Breakdown (Gender) */}
           <Card className="col-span-2 p-3 bg-white border-gray-100">
              <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase">Student Breakdown by Gender</h4>
                  <Users size={14} className="text-indigo-400" />
              </div>
              
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                 {classBreakdown.map(item => (
                    <div key={item.grade} className="flex items-center justify-between border-b border-gray-50 pb-1 last:border-none">
                       <span className="text-xs font-bold text-gray-700">Grade {item.grade}</span>
                       <div className="flex gap-2">
                          <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                             <User size={10} fill="currentColor" /> {item.m}
                          </span>
                          <span className="flex items-center gap-1 bg-pink-50 text-pink-500 px-1.5 py-0.5 rounded text-[10px] font-bold">
                             <UserCircle size={10} fill="currentColor" /> {item.f}
                          </span>
                       </div>
                    </div>
                 ))}
                 {classBreakdown.length === 0 && <span className="text-xs text-gray-400">No student data.</span>}
              </div>
           </Card>

        </div>
      )}
    </div>
  );
};

export default AnalyticsSummary;
