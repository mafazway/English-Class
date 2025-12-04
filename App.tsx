import React, { useState, useEffect } from 'react';
import { Student, ClassGroup, AttendanceRecord, FeeRecord, ExamRecord, View, CloudConfig } from './types';
import Dashboard from './components/Dashboard';
import StudentManager from './components/StudentManager';
import Timetable from './components/Timetable';
import AttendanceTracker from './components/AttendanceTracker';
import FeeTracker from './components/FeeTracker';
import MarksTracker from './components/MarksTracker';
import CloudSettings from './components/CloudSettings';
import AITeacherAssistant from './components/AITeacherAssistant';
import QuickActionFab from './components/QuickActionFab';
import PromotionManager from './components/PromotionManager';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LayoutGrid, Users, Calendar, BarChart3, CheckSquare, CreditCard } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useOfflineSync } from './hooks/useOfflineSync';
import { supabaseConfig } from './supabaseConfig';

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [view, setView] = useState<View>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [examRecords, setExamRecords] = useState<ExamRecord[]>([]);
  
  // UX State
  const [shouldOpenStudentModal, setShouldOpenStudentModal] = useState(false);
  
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({
    url: supabaseConfig.url,
    key: supabaseConfig.key,
    connected: true
  });

  const [dbClient, setDbClient] = useState<SupabaseClient | null>(() => 
    createClient(supabaseConfig.url, supabaseConfig.key)
  );

  const [showPromotion, setShowPromotion] = useState(false);
  const currentYear = new Date().getFullYear();

  // --- OFFLINE SYNC HOOK ---
  const { isOnline, queueSize, syncMutation, processQueue } = useOfflineSync(dbClient);

  // --- PERSISTENCE & INIT ---

  // Load from Local Storage on Mount
  useEffect(() => {
    const loadData = () => {
      try {
        const s = localStorage.getItem('students');
        const c = localStorage.getItem('classes');
        const a = localStorage.getItem('attendance');
        const f = localStorage.getItem('fees');
        const e = localStorage.getItem('exams');
        // Removed local storage check for cloudConfig to enforce hardcoded credentials

        if (s) setStudents(JSON.parse(s));
        if (c) setClasses(JSON.parse(c));
        if (a) setAttendance(JSON.parse(a));
        if (f) setFeeRecords(JSON.parse(f));
        if (e) setExamRecords(JSON.parse(e));
        
      } catch (err) {
        console.error("Failed to load local data", err);
      }
    };
    loadData();

    // Check for Promotion (Jan 1-15)
    const today = new Date();
    if (today.getMonth() === 0 && today.getDate() <= 15) {
       const hasPromoted = localStorage.getItem(`promoted_${currentYear}`);
       if (!hasPromoted) setShowPromotion(true);
    }
  }, [currentYear]);

  // Save to Local Storage on Change
  useEffect(() => localStorage.setItem('students', JSON.stringify(students)), [students]);
  useEffect(() => localStorage.setItem('classes', JSON.stringify(classes)), [classes]);
  useEffect(() => localStorage.setItem('attendance', JSON.stringify(attendance)), [attendance]);
  useEffect(() => localStorage.setItem('fees', JSON.stringify(feeRecords)), [feeRecords]);
  useEffect(() => localStorage.setItem('exams', JSON.stringify(examRecords)), [examRecords]);
  
  // Cloud Client Init
  useEffect(() => {
    localStorage.setItem('cloudConfig', JSON.stringify(cloudConfig));
    if (cloudConfig.connected && cloudConfig.url && cloudConfig.key) {
      try {
        setDbClient(createClient(cloudConfig.url, cloudConfig.key));
      } catch (e) {
        console.error("Invalid Supabase Config", e);
        setDbClient(null);
      }
    } else {
      setDbClient(null);
    }
  }, [cloudConfig]);

  // Trigger sync queue when dbClient becomes available
  useEffect(() => {
    if (dbClient && isOnline) {
      processQueue();
    }
  }, [dbClient, isOnline, processQueue]);


  // --- SYNC HANDLERS ---
  
  const fetchAllData = async () => {
     if (!dbClient || !isOnline) return;
     try {
       // Fetch all tables
       const [sRes, cRes, aRes, fRes, eRes] = await Promise.all([
         dbClient.from('students').select('*'),
         dbClient.from('classes').select('*'),
         dbClient.from('attendance').select('*'),
         dbClient.from('fees').select('*'),
         dbClient.from('exams').select('*')
       ]);

       if (sRes.data) {
         // Map snake_case (DB) to camelCase (App)
         const mappedStudents = sRes.data.map((x: any) => ({
            id: x.id,
            admissionNumber: x.admission_number,
            name: x.name,
            parentName: x.parent_name,
            mobileNumber: x.mobile_number,
            whatsappNumber: x.whatsapp_number,
            grade: x.grade,
            gender: x.gender,
            notes: x.notes,
            joinedDate: x.joined_date,
            photo: x.photo,
            lastReminderSentAt: x.last_reminder_sent_at,
            lastInquirySentDate: x.last_inquiry_sent_date
         }));
         setStudents(mappedStudents);
       }
       
       if (cRes.data) {
         setClasses(cRes.data.map((x: any) => ({
           id: x.id, name: x.name, day: x.day, startTime: x.start_time, schedule: x.schedule
         })));
       }

       if (aRes.data) {
         setAttendance(aRes.data.map((x: any) => ({
            id: x.id, 
            classId: x.class_id, 
            date: x.date, 
            studentIdsPresent: x.student_ids_present || [], 
            contactedAbsentees: x.contacted_absentees || [],
            status: x.status
         })));
       }

       if (fRes.data) {
          setFeeRecords(fRes.data.map((x: any) => ({
             id: x.id, 
             studentId: x.student_id, 
             amount: x.amount, 
             date: x.paid_date, 
             notes: x.notes, 
             receiptSent: x.receipt_sent,
             billingMonth: x.billing_month,
             nextDueDate: x.next_due_date
          })));
       }

       if (eRes.data) {
          setExamRecords(eRes.data.map((x: any) => ({
             id: x.id, studentId: x.student_id, testName: x.subject, score: x.marks, total: x.total, date: x.exam_date
          })));
       }

       toast.success("Sync Complete");
     } catch (err) {
       console.error(err);
       toast.error("Sync Failed");
     }
  };

  // --- CRUD HANDLERS (UPDATED FOR OFFLINE SYNC) ---

  const addStudent = async (s: Student): Promise<boolean> => {
    // 1. Local Duplicate Check
    const mobileToCheck = s.mobileNumber?.trim();
    if (mobileToCheck) {
      const match = students.find(st => st.mobileNumber === mobileToCheck);
      if (match) {
        const isSameName = match.name.toLowerCase().trim() === s.name.toLowerCase().trim();
        if (isSameName) {
           toast.error(`Duplicate: '${match.name}' already exists locally.`);
           return false;
        }
        const isSibling = window.confirm(`Number registered to "${match.name}". Is "${s.name}" a sibling?`);
        if (!isSibling) return false;
      }
    }

    // 2. Optimistic Update
    setStudents(prev => [...prev, s]);

    // 3. Sync Mutation (UPSERT)
    const dbPayload = {
      id: s.id, 
      admission_number: s.admissionNumber || '', 
      name: s.name, 
      parent_name: s.parentName || '', 
      mobile_number: s.mobileNumber || '', 
      whatsapp_number: s.whatsappNumber || '', 
      grade: s.grade || '', 
      gender: s.gender || 'Male',
      notes: s.notes || '', 
      joined_date: s.joinedDate || null, 
      photo: s.photo || null,
      last_reminder_sent_at: s.lastReminderSentAt || null,
      last_inquiry_sent_date: s.lastInquirySentDate || null
    };

    return await syncMutation('students', 'UPSERT', dbPayload);
  };

  const updateStudent = async (s: Student) => {
    setStudents(prev => prev.map(st => st.id === s.id ? s : st));
    
    const dbPayload = {
      id: s.id,
      admission_number: s.admissionNumber, 
      name: s.name, 
      parent_name: s.parentName, 
      mobile_number: s.mobileNumber, 
      whatsapp_number: s.whatsappNumber, 
      grade: s.grade, 
      gender: s.gender,
      notes: s.notes, 
      joined_date: s.joinedDate, 
      photo: s.photo,
      last_reminder_sent_at: s.lastReminderSentAt,
      last_inquiry_sent_date: s.lastInquirySentDate
    };
    syncMutation('students', 'UPSERT', dbPayload);
  };

  const deleteStudent = async (id: string) => {
    if (!dbClient) return;
    
    const toastId = toast.loading("Deleting student and related data...");

    try {
      // Delete Child Records FIRST
      await dbClient.from('fees').delete().eq('student_id', id);
      await dbClient.from('exams').delete().eq('student_id', id);

      // Delete the Student LAST
      const { error } = await dbClient.from('students').delete().eq('id', id);

      if (error) throw error;

      toast.success("Student deleted successfully!", { id: toastId });
      
      fetchAllData();
      
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error("Failed to delete: " + error.message, { id: toastId });
    }
  };

  const addClass = (c: ClassGroup) => {
    setClasses(prev => [...prev, c]);
    const dbPayload = {
       id: c.id, name: c.name, day: c.day, start_time: c.startTime, schedule: c.schedule
    };
    syncMutation('classes', 'UPSERT', dbPayload);
  };

  const updateClass = (c: ClassGroup) => {
     setClasses(prev => prev.map(cl => cl.id === c.id ? c : cl));
     const dbPayload = {
        id: c.id, name: c.name, day: c.day, start_time: c.startTime, schedule: c.schedule
     };
     syncMutation('classes', 'UPSERT', dbPayload);
  };

  const deleteClass = (id: string) => {
     setClasses(prev => prev.filter(c => c.id !== id));
     syncMutation('classes', 'DELETE', { id });
  };

  const saveAttendance = (r: AttendanceRecord) => {
     setAttendance(prev => {
        const idx = prev.findIndex(ex => ex.classId === r.classId && ex.date === r.date);
        if (idx >= 0) {
           const copy = [...prev];
           copy[idx] = r;
           return copy;
        }
        return [...prev, r];
     });

     const dbPayload = {
        id: r.id, 
        class_id: r.classId, 
        date: r.date, 
        student_ids_present: r.studentIdsPresent,
        contacted_absentees: r.contactedAbsentees,
        status: r.status // Add Status
     };
     syncMutation('attendance', 'UPSERT', dbPayload);
  };

  const addFee = (r: FeeRecord) => {
     setFeeRecords(prev => [...prev, r]);
     const dbPayload = {
        id: r.id, 
        student_id: r.studentId, 
        amount: r.amount, 
        paid_date: r.date, 
        notes: r.notes, 
        receipt_sent: r.receiptSent,
        billing_month: r.billingMonth,
        next_due_date: r.nextDueDate
     };
     syncMutation('fees', 'UPSERT', dbPayload);
  };

  const updateFee = (r: FeeRecord) => {
    setFeeRecords(prev => prev.map(rec => rec.id === r.id ? r : rec));
    const dbPayload = {
       id: r.id, 
       student_id: r.studentId, 
       amount: r.amount, 
       paid_date: r.date, 
       notes: r.notes, 
       receipt_sent: r.receiptSent,
       billing_month: r.billingMonth,
       next_due_date: r.nextDueDate
    };
    syncMutation('fees', 'UPSERT', dbPayload);
 };

  const deleteFee = (id: string) => {
     setFeeRecords(prev => prev.filter(r => r.id !== id));
     syncMutation('fees', 'DELETE', { id });
  };

  const addExam = (r: ExamRecord) => {
     setExamRecords(prev => [...prev, r]);
     const dbPayload = {
        id: r.id, student_id: r.studentId, subject: r.testName, marks: r.score, total: r.total, exam_date: r.date
     };
     syncMutation('exams', 'UPSERT', dbPayload);
  };

  const updateExam = (r: ExamRecord) => {
     setExamRecords(prev => prev.map(ex => ex.id === r.id ? r : ex));
     const dbPayload = {
        id: r.id, student_id: r.studentId, subject: r.testName, marks: r.score, total: r.total, exam_date: r.date
     };
     syncMutation('exams', 'UPSERT', dbPayload);
  };

  const deleteExam = (id: string) => {
     setExamRecords(prev => prev.filter(r => r.id !== id));
     syncMutation('exams', 'DELETE', { id });
  };

  const handlePromotion = () => {
    const promotedStudents = students.map(s => {
       const gradeNum = parseInt(s.grade);
       if (!isNaN(gradeNum)) {
          if (gradeNum >= 11) return { ...s, grade: 'Completed' };
          return { ...s, grade: (gradeNum + 1).toString() };
       }
       return s;
    });
    setStudents(promotedStudents);
    localStorage.setItem(`promoted_${currentYear}`, 'true');
    setShowPromotion(false);
    toast.success("Promotion Complete!");
    
    // Batch update via sync
    promotedStudents.forEach(s => updateStudent(s));
  };

  // --- RENDER HELPERS ---

  const renderView = () => {
    switch(view) {
      case 'dashboard':
        return <Dashboard 
               students={students} 
               classes={classes} 
               attendance={attendance} 
               feeRecords={feeRecords}
               examRecords={examRecords}
               onNavigate={setView}
               onRestoreData={(data) => {
                 if(data.students) setStudents(data.students);
                 if(data.classes) setClasses(data.classes);
                 if(data.attendance) setAttendance(data.attendance);
                 if(data.feeRecords) setFeeRecords(data.feeRecords);
                 if(data.examRecords) setExamRecords(data.examRecords);
                 toast.success("Local Backup Restored");
               }}
               cloudConnected={cloudConfig.connected}
               onRefreshData={fetchAllData}
               onAddStudentClick={() => {
                 setView('students');
                 setShouldOpenStudentModal(true);
               }}
               isOnline={isOnline}
               pendingSyncCount={queueSize}
             />;
      case 'students':
        return <StudentManager 
              students={students} 
              feeRecords={feeRecords}
              examRecords={examRecords}
              onAddStudent={addStudent} 
              onUpdateStudent={updateStudent} 
              onDeleteStudent={deleteStudent}
              shouldOpenAddModal={shouldOpenStudentModal}
              onResetAddModal={() => setShouldOpenStudentModal(false)}
            />;
      case 'timetable':
        return <Timetable 
               classes={classes}
               onAddClass={addClass}
               onUpdateClass={updateClass}
               onDeleteClass={deleteClass}
             />;
      case 'attendance':
        return <AttendanceTracker 
                students={students}
                classes={classes}
                attendanceRecords={attendance}
                onSaveAttendance={saveAttendance}
             />;
      case 'fees':
        return <FeeTracker 
                students={students}
                feeRecords={feeRecords}
                onAddFeeRecord={addFee}
                onUpdateFeeRecord={updateFee}
                onDeleteFeeRecord={deleteFee}
                onUpdateStudent={updateStudent}
             />;
      case 'marks':
        return <MarksTracker 
                students={students}
                examRecords={examRecords}
                onAddExamRecord={addExam}
                onUpdateExamRecord={updateExam}
                onDeleteExamRecord={deleteExam}
             />;
      case 'ai-tools':
        return <AITeacherAssistant students={students} />;
      case 'cloud-settings':
        return <CloudSettings 
                config={cloudConfig}
                onSaveConfig={(c) => setCloudConfig(c)}
                onSyncNow={processQueue} // Manual Trigger
                lastSyncTime={new Date().toISOString()}
                onBackup={() => {
                   const data = { students, classes, attendance, feeRecords, examRecords };
                   const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
                   const url = URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = `Backup-${new Date().toISOString()}.json`;
                   a.click();
                }}
                onRestore={(d) => { 
                   if(d.students) setStudents(d.students);
                   toast.success("Data Restored");
                }}
             />;
      default:
        return null;
    }
  };

  const NavItem = ({ view: targetView, icon: Icon, label }: { view: View, icon: any, label: string }) => (
    <button 
      onClick={() => setView(targetView)} 
      className={`flex flex-col items-center justify-center w-full py-2 transition-all ${
        view === targetView 
          ? 'text-indigo-600' 
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <div className={`p-1 rounded-xl transition-all ${
        view === targetView ? 'bg-indigo-50 translate-y-[-2px]' : ''
      }`}>
         <Icon size={24} strokeWidth={view === targetView ? 2.5 : 2} />
      </div>
      <span className={`text-[10px] font-bold mt-1 ${view === targetView ? 'scale-105' : ''}`}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 text-gray-800 font-sans">
       <div className="flex flex-col h-full w-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden">
         {/* 1. Global Components */}
         <Toaster position="top-center" />
         
         <PromotionManager 
             isOpen={showPromotion} 
             onClose={() => setShowPromotion(false)} 
             onConfirm={handlePromotion}
             year={currentYear}
          />

         {/* 2. Main Scrollable Content */}
         <main className="flex-1 overflow-y-auto scrollbar-hide bg-gray-50/50 relative">
            {renderView()}
         </main>

         {/* 3. Floating Action Button */}
         <QuickActionFab 
           onNavigate={setView} 
           onAddStudentClick={() => {
             setView('students');
             setShouldOpenStudentModal(true);
           }} 
         />

         {/* 4. BOTTOM NAVIGATION BAR */}
         <nav className="flex-shrink-0 bg-white border-t border-gray-100 flex justify-between items-center shadow-[0_-8px_30px_rgba(0,0,0,0.04)] z-50 px-1 pb-safe">
            <NavItem view="dashboard" icon={LayoutGrid} label="Home" />
            <NavItem view="students" icon={Users} label="Students" />
            <NavItem view="timetable" icon={Calendar} label="Time" />
            <NavItem view="marks" icon={BarChart3} label="Marks" />
            <NavItem view="attendance" icon={CheckSquare} label="Attend" />
            <NavItem view="fees" icon={CreditCard} label="Fees" />
         </nav>
       </div>
    </div>
  );
};

export default App;