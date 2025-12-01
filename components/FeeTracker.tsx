
import React, { useState } from 'react';
import { Student, FeeRecord } from '../types';
import { ChevronDown, Check, X, DollarSign, MessageCircle, Trash2, ChevronLeft, ChevronRight, ArrowRight, Search, AlertCircle, FileText, Download, Calendar, Send, History, CheckCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FeeTrackerProps {
  students: Student[];
  feeRecords: FeeRecord[];
  onAddFeeRecord: (record: FeeRecord) => void;
  onUpdateFeeRecord: (record: FeeRecord) => void;
  onDeleteFeeRecord: (id: string) => void;
  onUpdateStudent: (student: Student) => void;
}

const FeeTracker: React.FC<FeeTrackerProps> = ({ students = [], feeRecords = [], onAddFeeRecord, onUpdateFeeRecord, onDeleteFeeRecord, onUpdateStudent }) => {
  const [filter, setFilter] = useState<'Overdue' | 'Paid' | 'All'>('Overdue');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- PAYMENT MODAL STATE ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState<string>("1000");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to Today
  
  // Billing Cycle State
  const [billingOptions, setBillingOptions] = useState<{label: string, value: string}[]>([]);
  const [selectedBillingMonth, setSelectedBillingMonth] = useState<string>('');

  // History View State
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Skip/Waive State
  const [isSkipped, setIsSkipped] = useState(false);
  const [skipReason, setSkipReason] = useState("");

  const uniqueGrades = ['All', ...Array.from(new Set((students || []).map(s => s.grade || 'Unknown'))).sort()];

  // --- HELPERS ---
  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatSLNumber = (num: string) => {
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 10 && cleaned.startsWith('0')) return '94' + cleaned.substring(1);
    if (cleaned.length === 9) return '94' + cleaned;
    if (cleaned.startsWith('94')) return cleaned;
    return cleaned;
  };

  const getBillingDayText = (dateString?: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if(parts.length < 3) return '-';
    
    const day = parseInt(parts[2], 10);
    
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';

    return `${day}${suffix} of Month`;
  };

  // Helper: Relative time string for reminder
  const getRelativeTime = (isoDate?: string) => {
    if (!isoDate) return null;
    const now = new Date();
    const sent = new Date(isoDate);
    const diffMs = now.getTime() - sent.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `Today, ${sent.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const wasSentRecently = (isoDate?: string) => {
    if (!isoDate) return false;
    const now = new Date();
    const sent = new Date(isoDate);
    const diffHours = (now.getTime() - sent.getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  // --- CORE LOGIC: NEXT DUE DATE CALCULATION ---
  const getStudentFeeStatus = (student: Student) => {
    const studentPayments = feeRecords
      .filter(r => r.studentId === student.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const lastPaidDateObj = studentPayments.length > 0 ? studentPayments[0].date : null;
    const paymentCount = studentPayments.length;
    
    // SAFE DATE PARSING
    let joinDate = new Date();
    if (student.joinedDate) {
       const [y, m, d] = student.joinedDate.split('-').map(Number);
       joinDate = new Date(y, m - 1, d);
    }
    const joinedDay = joinDate.getDate();

    // Logic: Next Due Date = Joined Date + Payment Count (in months)
    const nextDueDate = new Date(joinDate);
    nextDueDate.setMonth(joinDate.getMonth() + paymentCount);

    // Handle Month Overflow
    if (nextDueDate.getDate() !== joinedDay) {
       nextDueDate.setDate(0); 
    }
    nextDueDate.setHours(0,0,0,0);

    // Check if Overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isOverdue = nextDueDate < today;

    return { 
      isOverdue, 
      lastPaidDateObj, 
      nextDueDate,
      paymentCount,
      joinDate
    };
  };

  // --- HANDLERS ---
  const generateBillingOptions = (student: Student, currentNextDue: Date) => {
     const options = [];
     const start = new Date(currentNextDue);
     start.setMonth(start.getMonth() - 3);

     const originalDay = student.joinedDate ? parseInt(student.joinedDate.split('-')[2]) : 1;
     
     for (let i = 0; i < 8; i++) {
        const d = new Date(start);
        d.setMonth(start.getMonth() + i);
        
        if (d.getDate() !== originalDay) {
           d.setDate(0); 
           const testDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
           if (testDate.getDate() >= originalDay) {
              d.setDate(originalDay);
           }
        }
        
        const isDueMonth = d.getMonth() === currentNextDue.getMonth() && d.getFullYear() === currentNextDue.getFullYear();
        const label = `${d.toLocaleString('default', { month: 'long', year: 'numeric' })} ${isDueMonth ? '(Current Due)' : ''}`;
        
        options.push({
           label: label,
           value: d.toISOString()
        });
     }
     return options;
  };

  const resetForm = (student?: Student) => {
    setAmount("1000"); 
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setIsSkipped(false);
    setSkipReason("");
    
    if (student) {
        const { nextDueDate } = getStudentFeeStatus(student);
        const options = generateBillingOptions(student, nextDueDate);
        setBillingOptions(options);
        
        const match = options.find(o => {
            const optDate = new Date(o.value);
            return optDate.getMonth() === nextDueDate.getMonth() && optDate.getFullYear() === nextDueDate.getFullYear();
        });
        
        setSelectedBillingMonth(match ? match.value : options[3].value);
    }
  };

  const openPaymentModal = (student: Student) => {
    setPaymentStudent(student);
    resetForm(student);
    setIsPaymentModalOpen(true);
  };

  const filteredStudents = (students || []).filter(student => {
    if (searchTerm && !student.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
    }
    if (selectedGrade !== 'All' && student.grade !== selectedGrade) return false;
    const { isOverdue } = getStudentFeeStatus(student);
    if (filter === 'Paid') return !isOverdue;
    if (filter === 'Overdue') return isOverdue;
    return true;
  });

  const currentIndex = paymentStudent ? filteredStudents.findIndex(s => s.id === paymentStudent.id) : -1;
  const prevStudent = currentIndex > 0 ? filteredStudents[currentIndex - 1] : null;
  const nextStudent = currentIndex !== -1 && currentIndex < filteredStudents.length - 1 ? filteredStudents[currentIndex + 1] : null;

  const switchToStudent = (student: Student) => {
    setPaymentStudent(student);
    resetForm(student);
  };

  const submitPayment = (closeAfterSave: boolean = true, wasReceiptSent: boolean = false) => {
    if (!paymentStudent || (!amount && !isSkipped) || !paymentDate || !selectedBillingMonth) return;

    const finalAmount = isSkipped ? 0 : parseFloat(amount);
    
    const billingDateObj = new Date(selectedBillingMonth);
    const billingMonthStr = billingDateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
    
    let noteText = `Billing Month: ${billingMonthStr}`;
    if (isSkipped) noteText += ` (Skipped: ${skipReason || 'No reason'})`;
    
    // Calculate accurate Next Due Date (billing month + 1 month)
    const nextDueDateObj = new Date(billingDateObj);
    nextDueDateObj.setMonth(nextDueDateObj.getMonth() + 1);
    if (paymentStudent.joinedDate) {
       const day = parseInt(paymentStudent.joinedDate.split('-')[2]);
       if (day) {
         nextDueDateObj.setDate(day);
       }
    }
    const nextDueStr = nextDueDateObj.toISOString().split('T')[0];

    onAddFeeRecord({
      id: crypto.randomUUID(),
      studentId: paymentStudent.id,
      amount: finalAmount,
      date: new Date(paymentDate).toISOString(),
      notes: noteText,
      receiptSent: wasReceiptSent,
      billingMonth: selectedBillingMonth,
      nextDueDate: nextDueStr
    });
    
    const msg = isSkipped ? `Waived ${billingMonthStr}` : `Paid for ${billingMonthStr}`;
    toast.success(msg);

    if (closeAfterSave) {
      setIsPaymentModalOpen(false);
      setPaymentStudent(null);
    }
  };

  const handleSaveAndWhatsApp = () => {
     if (!paymentStudent || (!amount && !isSkipped) || !selectedBillingMonth) return;

     const number = paymentStudent.whatsappNumber || paymentStudent.mobileNumber;
     if (!number) {
        toast.error("No WhatsApp number available");
        return;
     }

     const billDate = new Date(selectedBillingMonth);
     const billMonthStr = billDate.toLocaleString('default', { month: 'long', year: 'numeric' });
     
     const nextDueDateObj = new Date(billDate);
     nextDueDateObj.setMonth(nextDueDateObj.getMonth() + 1);
     if (paymentStudent.joinedDate) {
        const day = parseInt(paymentStudent.joinedDate.split('-')[2]);
        if (day) nextDueDateObj.setDate(day);
     }
     const nextDueStr = nextDueDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

     const message = `✅ *கட்டணம் பெறப்பட்டது (Payment Received)*\n\nஅஸ்ஸலாமு அலைக்கும்,\n\n*${paymentStudent.name}* அவர்களின் *${billMonthStr}* மாதத்திற்கான கட்டணம் *ரூ. ${amount}* எமக்குக் கிடைக்கப்பெற்றது.\n\nஅடுத்த தவணை: *${nextDueStr}*\n\nநன்றி.\nEnglish Class Academy`;

     window.open(`https://wa.me/${formatSLNumber(number)}?text=${encodeURIComponent(message)}`, '_blank');
     submitPayment(true, true);
  };

  const handleSendPastReceipt = (student: Student, record: FeeRecord) => {
    const number = student.whatsappNumber || student.mobileNumber;
    if (!number) { toast.error("No number found"); return; }

    // --- SMART FALLBACK LOGIC ---
    let billingMonthDisplay = "Unknown Month";
    let nextDueText = "Check App";
    
    // 1. Try to get Billing Month
    if (record.billingMonth) {
        const d = new Date(record.billingMonth);
        if (!isNaN(d.getTime())) {
           billingMonthDisplay = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        }
    } else if (record.notes?.includes("Billing Month:")) {
        const match = record.notes.match(/Billing Month: ([^(]+)/);
        if (match) billingMonthDisplay = match[1].trim();
    } else if (record.date) {
        // Fallback: Use Payment Date as Billing Month
        const d = new Date(record.date);
        billingMonthDisplay = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    // 2. Try to get Next Due Date
    if (record.nextDueDate) {
        const d = new Date(record.nextDueDate);
        if (!isNaN(d.getTime())) {
           nextDueText = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }
    } else {
        // Fallback: Add 1 month to Billing/Payment date
        const baseDate = record.billingMonth ? new Date(record.billingMonth) : new Date(record.date);
        baseDate.setMonth(baseDate.getMonth() + 1);
        if (student.joinedDate) {
            const day = parseInt(student.joinedDate.split('-')[2]);
            if (day) baseDate.setDate(day);
        } else {
            baseDate.setDate(1);
        }
        nextDueText = baseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const message = `✅ *கட்டணம் பெறப்பட்டது (Payment Received)*\n\n` +
        `அஸ்ஸலாமு அலைக்கும்,\n\n` +
        `*${student.name}* அவர்களின் *${billingMonthDisplay}* மாதத்திற்கான கட்டணம் *ரூ. ${record.amount}* எமக்குக் கிடைக்கப்பெற்றது.\n\n` +
        `அடுத்த தவணை: *${nextDueText}*\n\n` +
        `நன்றி.\n` +
        `English Class Academy`;

    window.open(`https://wa.me/${formatSLNumber(number)}?text=${encodeURIComponent(message)}`, '_blank');
    onUpdateFeeRecord({ ...record, receiptSent: true });
    toast.success("Receipt status updated!");
  };

  const handleSaveAndNext = () => {
    submitPayment(false);
    if (nextStudent) {
      switchToStudent(nextStudent);
    } else {
      setIsPaymentModalOpen(false);
      setPaymentStudent(null);
    }
  };

  const handleSendReminder = (student: Student, lastPaidDateObj: string | null, nextDueDate: Date) => {
    const number = student.whatsappNumber || student.mobileNumber;
    if (!number) { toast.error("No mobile number found."); return; }

    const nextDueFormatted = formatDate(nextDueDate);
    const dueMonthName = nextDueDate.toLocaleString('default', { month: 'long' });

    const message = `🔔 *நினைவூட்டல் (Fee Reminder)*\n\nஅஸ்ஸலாமு அலைக்கும்,\n\n*${student.name}* அவர்களின் அடுத்த கட்டணம் *${nextDueFormatted}* அன்று (${dueMonthName} மாதம்) செலுத்தப்பட வேண்டும்.\n\nதயவுசெய்து நிலுவையைச் சரிபார்க்கவும்.\n\nநன்றி.\nTeacher\nEnglish Class Academy`;

    const url = `https://wa.me/${formatSLNumber(number)}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    onUpdateStudent({ ...student, lastReminderSentAt: new Date().toISOString() });
  };

  const handleDownloadPDF = async () => {
    const toastId = toast.loading("Generating PDF...");
    try {
      // @ts-ignore
      const { jsPDF } = await import('jspdf');
      // @ts-ignore
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Fee Status Report", 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
      doc.text(`Filter: ${filter} | Grade: ${selectedGrade}`, 14, 33);
      
      const tableColumn = ["Name", "Grade", "Mobile", "Bill Date", "Last Paid", "Next Due", "Status"];
      const tableRows = filteredStudents.map(student => {
        const { isOverdue, lastPaidDateObj, nextDueDate } = getStudentFeeStatus(student);
        return [
          student.name,
          student.grade,
          student.mobileNumber || '-',
          getBillingDayText(student.joinedDate),
          lastPaidDateObj ? formatDate(lastPaidDateObj) : 'Never',
          formatDate(nextDueDate),
          isOverdue ? 'OVERDUE' : 'PAID'
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [79, 70, 229] }, 
        alternateRowStyles: { fillColor: [243, 244, 246] }
      });

      doc.save(`Fee_Report_${filter}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Report Downloaded", { id: toastId });
    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("Failed to generate PDF", { id: toastId });
    }
  };

  return (
    <div className="p-4 pb-24 space-y-5 bg-gray-50 min-h-full">
      {/* HEADER: TITLE & SEARCH */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Top Bar */}
        <div className="p-5 pb-2 flex justify-between items-center">
          <h2 className="text-2xl font-extrabold text-slate-800">Fee Manager</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadPDF} className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100">
              <Download size={18} />
            </button>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200">
              {filteredStudents.length} Students
            </span>
          </div>
        </div>

        {/* Search Bar & Filters */}
        <div className="px-5 pb-5 pt-3">
           <div className="relative mb-3">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="Search student name..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 placeholder-gray-400 transition-colors font-medium"
             />
           </div>

           <div className="flex flex-col sm:flex-row gap-3">
             <div className="flex bg-slate-100 p-1 rounded-xl flex-1">
               {['Overdue', 'Paid', 'All'].map((tab) => (
                 <button key={tab} onClick={() => setFilter(tab as any)} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${filter === tab ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
               ))}
             </div>
             <div className="relative min-w-[130px] bg-white border border-slate-300 rounded-xl hover:border-indigo-400 transition-colors">
               <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className="block w-full px-3 py-2.5 text-sm font-bold text-slate-700 bg-transparent outline-none cursor-pointer appearance-none">
                 {uniqueGrades.map((g) => <option key={g} value={g}>{g === 'All' ? 'All Grades' : `Grade ${g}`}</option>)}
               </select>
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500"><ChevronDown size={14} /></div>
             </div>
           </div>
        </div>
      </div>

      {/* STUDENT CARDS */}
      <div className="grid grid-cols-1 gap-4">
        {filteredStudents.map(student => {
          const { isOverdue, lastPaidDateObj, nextDueDate, paymentCount } = getStudentFeeStatus(student);
          const studentHistory = feeRecords
             .filter(r => r.studentId === student.id)
             .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          const lastPaymentId = studentHistory[0]?.id;
          const isHistoryExpanded = expandedStudentId === student.id;
          
          const sentRecently = wasSentRecently(student.lastReminderSentAt);
          const reminderText = getRelativeTime(student.lastReminderSentAt);

          return (
            <div key={student.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-4 flex justify-between items-start border-b border-gray-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{student.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                     <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wide border border-slate-200">Grade {student.grade}</span>
                     <span className="text-[10px] text-gray-400 font-medium">({paymentCount} payments)</span>
                  </div>
                </div>
                {!isOverdue ? (
                  <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-green-200 shadow-sm"><Check size={14} strokeWidth={3} /> PAID</span>
                ) : (
                  <span className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-red-200 shadow-sm"><X size={14} strokeWidth={3} /> OVERDUE</span>
                )}
              </div>

              <div className="px-4 py-4">
                <div className="grid grid-cols-3 gap-0 bg-slate-50 rounded-xl border border-slate-200 divide-x divide-slate-200">
                  <div className="p-3 text-center">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bill Date</span>
                    <span className="block text-sm font-bold text-slate-700">{getBillingDayText(student.joinedDate)}</span>
                  </div>
                  <div className="p-3 text-center"><span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Paid</span><span className={`block text-sm font-bold ${lastPaidDateObj ? 'text-slate-700' : 'text-orange-500'}`}>{lastPaidDateObj ? formatDate(lastPaidDateObj) : 'Never'}</span></div>
                  <div className="p-3 text-center"><span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Next Due</span><span className={`block text-sm font-extrabold ${!isOverdue ? 'text-green-600' : 'text-red-600'}`}>{formatDate(nextDueDate)}</span></div>
                </div>
              </div>

              <div className="px-4 pb-4 flex gap-2">
                {isOverdue ? (
                  <>
                    <button onClick={() => openPaymentModal(student)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                      <DollarSign size={18} strokeWidth={2.5} /> Record Payment
                    </button>
                    <div className="flex flex-col items-center">
                       <button 
                         onClick={() => handleSendReminder(student, lastPaidDateObj, nextDueDate)} 
                         className={`p-3 rounded-xl shadow-sm border active:scale-[0.95] transition-all relative ${sentRecently ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-green-100 text-green-700 border-green-200'}`} 
                         title="Send WhatsApp Reminder"
                       >
                         {sentRecently && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span></span>}
                         <MessageCircle size={24} strokeWidth={2.5} />
                       </button>
                       {reminderText && <span className="text-[9px] text-gray-400 font-medium mt-1">{reminderText}</span>}
                    </div>
                  </>
                ) : (
                  <button onClick={() => { if(lastPaymentId && window.confirm("Undo the last payment?")) onDeleteFeeRecord(lastPaymentId); }} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl border border-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm">
                    <Trash2 size={16} /> Undo Last Payment
                  </button>
                )}
                
                {/* History Toggle Button */}
                <button 
                  onClick={() => setExpandedStudentId(isHistoryExpanded ? null : student.id)} 
                  className={`p-3 rounded-xl shadow-sm border transition-all active:scale-[0.95] h-[52px] ${isHistoryExpanded ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  title="View History"
                >
                   <History size={24} strokeWidth={2} />
                </button>
              </div>

              {/* EXPANDED HISTORY LIST */}
              {isHistoryExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3 animate-fade-in">
                   <div className="flex items-center justify-between">
                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><History size={12}/> Payment History</h4>
                     <span className="text-[10px] text-slate-400">{studentHistory.length} records</span>
                   </div>
                   
                   {studentHistory.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 text-sm italic">No history found.</div>
                   ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {studentHistory.map(record => (
                          <div key={record.id} className="bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                             <div>
                                <p className="text-xs font-bold text-slate-700">{formatDate(record.date)}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{record.notes || 'Payment Received'}</p>
                             </div>
                             <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-800">Rs.{record.amount}</span>
                                
                                <div className="flex items-center gap-1">
                                  {record.receiptSent && (
                                     <CheckCheck size={16} className="text-green-500" />
                                  )}
                                  <button 
                                    onClick={() => handleSendPastReceipt(student, record)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shadow-sm ${record.receiptSent ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-600'}`}
                                    title={record.receiptSent ? "Receipt Sent (Send again)" : "Send Receipt"}
                                  >
                                     <MessageCircle size={16} />
                                  </button>
                                </div>

                             </div>
                          </div>
                        ))}
                      </div>
                   )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- PAYMENT POPUP MODAL --- */}
      {isPaymentModalOpen && paymentStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 relative">
            
            {/* Navigation */}
            {prevStudent && (
               <button onClick={() => switchToStudent(prevStudent)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-gray-200/50 backdrop-blur-md text-white shadow-lg hover:bg-white/40 border border-white/20"><ChevronLeft size={24} /></button>
            )}
            {nextStudent && (
               <button onClick={() => switchToStudent(nextStudent)} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-gray-200/50 backdrop-blur-md text-white shadow-lg hover:bg-white/40 border border-white/20"><ChevronRight size={24} /></button>
            )}

            <div className={`${isSkipped ? 'bg-amber-500' : 'bg-indigo-600'} p-6 text-white text-center transition-colors duration-300`}>
              <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                 {isSkipped ? <AlertCircle size={22}/> : null}
                 {isSkipped ? 'Waive Month' : 'Record Payment'}
              </h3>
              <p className={`${isSkipped ? 'text-amber-100' : 'text-indigo-200'} text-sm mt-1`}>{paymentStudent.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              
              {/* Skip Option */}
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
                 <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSkipped ? 'bg-amber-500 border-amber-500' : 'border-gray-400 bg-white'}`}>
                    {isSkipped && <Check size={14} className="text-white" />}
                 </div>
                 <input type="checkbox" checked={isSkipped} onChange={(e) => { setIsSkipped(e.target.checked); if(e.target.checked) setAmount("0"); else setAmount("1000"); }} className="hidden" />
                 <span className="text-sm font-bold text-gray-700">Mark as Skipped / Leave</span>
              </label>

              {/* Amount or Reason */}
              {isSkipped ? (
                 <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-amber-600 uppercase mb-2">Reason for Skipping</label>
                    <div className="relative">
                       <FileText className="absolute left-4 top-3.5 text-gray-400" size={18}/>
                       <input type="text" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} placeholder="e.g. Medical Leave" className="w-full pl-12 pr-4 py-3 bg-amber-50 border border-amber-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                 </div>
              ) : (
                 <div className="animate-fade-in">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Amount (LKR)</label>
                    <div className="relative">
                       <span className="absolute left-4 top-3.5 text-gray-400 font-bold">Rs.</span>
                       <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 text-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                 </div>
              )}
              
              {/* Billing Month Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Paying For Month</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3.5 text-indigo-500" size={18} />
                  <select 
                    value={selectedBillingMonth}
                    onChange={(e) => setSelectedBillingMonth(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  >
                    {billingOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 text-indigo-400 pointer-events-none" size={18} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 pl-1">This will be the cycle marked as cleared.</p>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Payment Received Date</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div className="pt-2 grid grid-cols-2 gap-3">
                <button onClick={() => setIsPaymentModalOpen(false)} className="col-span-1 py-3 bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                <button 
                  onClick={() => submitPayment(true)} 
                  className={`col-span-1 py-3 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 ${isSkipped ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                >
                  {isSkipped ? 'Confirm Skip' : 'Save'}
                </button>
                
                {/* NEW WHATSAPP BUTTON */}
                {!isSkipped && (
                   <button 
                      onClick={handleSaveAndWhatsApp}
                      className="col-span-2 py-3 bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-200 hover:bg-green-600 transition-colors flex items-center justify-center gap-2 active:scale-95"
                   >
                      <Send size={18} /> Save & Send WhatsApp
                   </button>
                )}

                {nextStudent && (
                  <button onClick={handleSaveAndNext} className="col-span-2 py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                    {isSkipped ? 'Confirm & Next' : 'Save & Next'} <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FeeTracker;
