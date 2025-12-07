


import React, { useState } from 'react';
import { Student, FeeRecord } from '../types';
import { ChevronDown, Check, X, DollarSign, MessageCircle, Trash2, ChevronLeft, ChevronRight, ArrowRight, Search, AlertCircle, FileText, Download, Calendar, Send, History, CheckCheck, Edit2, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

interface FeeTrackerProps {
  students: Student[];
  feeRecords: FeeRecord[];
  onAddFeeRecord: (record: FeeRecord) => void;
  onUpdateFeeRecord: (record: FeeRecord) => void;
  onDeleteFeeRecord: (id: string) => void;
  onUpdateStudent: (student: Student) => void;
}

// Robust ID Generator (Safe for all browsers/contexts including http)
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
};

const FeeTracker: React.FC<FeeTrackerProps> = ({ students = [], feeRecords = [], onAddFeeRecord, onUpdateFeeRecord, onDeleteFeeRecord, onUpdateStudent }) => {
  const [filter, setFilter] = useState<'Overdue' | 'Paid' | 'All'>('Overdue');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- PAYMENT MODAL STATE ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null); // Track ID if editing
  
  const [amount, setAmount] = useState<string>("1000");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to Today
  
  // Billing Cycle State
  const [billingOptions, setBillingOptions] = useState<{label: string, value: string, disabled: boolean}[]>([]);
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
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
  
  // Helper to reliably determine the "Billing Month" a record pays for
  const getEffectiveBillingDate = (r: FeeRecord): Date => {
    // 1. Explicit Field (New records)
    if (r.billingMonth) return new Date(r.billingMonth);
    
    // 2. Fallback: Try parsing notes (Backward compatibility)
    // Matches "Billing Month: October 2025"
    if (r.notes) {
        const match = r.notes.match(/Billing Month: ([A-Za-z]+ \d{4})/);
        if (match) {
            const d = new Date(match[1]);
            if (!isNaN(d.getTime())) return d;
        }
    }
    
    // 3. Last Resort: Use Paid Date (Only for very old/legacy records)
    return new Date(r.date);
  };

  const getStudentFeeStatus = (student: Student) => {
    const studentPayments = feeRecords
      .filter(r => r.studentId === student.id);

    // Analyze records to find the best anchor for "Next Due"
    // We prefer records that have EXPLICIT billing months over ambiguous ones.
    const analyzedRecords = studentPayments.map(r => {
       let isExplicit = !!r.billingMonth;
       let date = r.billingMonth ? new Date(r.billingMonth) : new Date(r.date);
       
       if (!isExplicit && r.notes) {
          const match = r.notes.match(/Billing Month: ([A-Za-z]+ \d{4})/);
          if (match) {
             const d = new Date(match[1]);
             if (!isNaN(d.getTime())) {
                date = d;
                isExplicit = true;
             }
          }
       }
       return { r, date, isExplicit };
    });

    const explicitRecords = analyzedRecords.filter(x => x.isExplicit && !isNaN(x.date.getTime()));
    const validAnalyzedRecords = analyzedRecords.filter(x => !isNaN(x.date.getTime()));
    
    // Determine the Anchor Date (The latest covered month)
    let anchorDate: Date | null = null;
    let hasRecords = false;

    if (explicitRecords.length > 0) {
       // High Accuracy: Use latest EXPLICIT billing month (ignores random/duplicate entries without dates)
       explicitRecords.sort((a, b) => b.date.getTime() - a.date.getTime());
       anchorDate = explicitRecords[0].date;
       hasRecords = true;
    } else if (validAnalyzedRecords.length > 0) {
       // Low Accuracy: Fallback to latest payment date
       validAnalyzedRecords.sort((a, b) => b.date.getTime() - a.date.getTime());
       anchorDate = validAnalyzedRecords[0].date;
       hasRecords = true;
    }

    // SAFE DATE PARSING for Join Date
    let joinDate = new Date();
    if (student.joinedDate) {
       const [y, m, d] = student.joinedDate.split('-').map(Number);
       if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          joinDate = new Date(y, m - 1, d);
       }
    }
    // Fallback if date parsing failed
    if (isNaN(joinDate.getTime())) {
       joinDate = new Date();
       joinDate.setDate(1); 
    }
    const billingDay = joinDate.getDate();

    let nextDueDate = new Date(joinDate);

    if (hasRecords && anchorDate) {
        // Logic: Next Due = Anchor Month + 1 Month
        const targetYear = anchorDate.getFullYear();
        const targetMonth = anchorDate.getMonth() + 1;
        
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const dayToSet = Math.min(billingDay, lastDayOfTargetMonth);
        
        nextDueDate = new Date(targetYear, targetMonth, dayToSet);
        nextDueDate.setHours(0,0,0,0);
    } else {
        // No payments yet -> Due on Join Date
        nextDueDate.setHours(0,0,0,0);
    }

    // Determine Last Paid Date (Actual Transaction Date for UI - purely informational)
    // Filter out invalid dates before sorting
    const transactions = [...studentPayments]
        .filter(r => {
            const d = new Date(r.date);
            return !isNaN(d.getTime());
        })
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
    const lastPaidDateObj = transactions.length > 0 ? transactions[0].date : null;
    const lastReceiptSent = transactions.length > 0 ? transactions[0].receiptSent : false;

    // Check if Overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    nextDueDate.setHours(0,0,0,0);
    
    const isOverdue = nextDueDate < today;
    const paymentCount = studentPayments.length;

    return { 
      isOverdue, 
      lastPaidDateObj,
      lastReceiptSent, // Exposed for UI
      nextDueDate,
      paymentCount,
      joinDate
    };
  };

  // --- HANDLERS ---
  const generateBillingOptions = (student: Student, referenceDate: Date, recordToEditId: string | null = null) => {
     const options = [];
     const start = new Date(referenceDate);
     if (isNaN(start.getTime())) start.setTime(Date.now()); // Safety check

     start.setMonth(start.getMonth() - 3); // Start offering 3 months back

     const originalDay = student.joinedDate ? parseInt(student.joinedDate.split('-')[2]) : 1;
     
     // Get existing payments to detect duplicates
     const existingPayments = feeRecords.filter(r => r.studentId === student.id);

     for (let i = 0; i < 12; i++) { // Show 12 months range
        const d = new Date(start);
        d.setMonth(start.getMonth() + i);
        
        if (d.getDate() !== originalDay) {
           d.setDate(0); 
           const testDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
           if (testDate.getDate() >= originalDay) {
              d.setDate(originalDay);
           }
        }
        
        const isDueMonth = d.getMonth() === referenceDate.getMonth() && d.getFullYear() === referenceDate.getFullYear();
        
        // Check if this month is already paid
        const isAlreadyPaid = existingPayments.some(r => {
            if (recordToEditId && r.id === recordToEditId) return false; // Don't count self as duplicate when editing
            const rDate = getEffectiveBillingDate(r);
            return !isNaN(rDate.getTime()) && rDate.getMonth() === d.getMonth() && rDate.getFullYear() === d.getFullYear();
        });

        const monthName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        let label = monthName;
        
        if (isAlreadyPaid) label += " (ALREADY PAID)";
        else if (isDueMonth) label += " (Current Due)";

        options.push({
           label: label,
           value: d.toISOString(),
           disabled: isAlreadyPaid
        });
     }
     return options;
  };

  const openPaymentModal = (student: Student, recordToEdit?: FeeRecord) => {
    setPaymentStudent(student);
    
    // 1. Generate Options based on Current Status
    const { nextDueDate } = getStudentFeeStatus(student);
    // If editing, use the record's billing date as reference to ensure the option exists
    const refDate = recordToEdit && recordToEdit.billingMonth ? new Date(recordToEdit.billingMonth) : nextDueDate;
    
    const options = generateBillingOptions(student, refDate, recordToEdit?.id);
    setBillingOptions(options);

    if (recordToEdit) {
      // --- EDIT MODE ---
      setEditingFeeId(recordToEdit.id);
      
      const isSkippedRec = recordToEdit.amount === 0;
      setIsSkipped(isSkippedRec);
      setAmount(recordToEdit.amount.toString());
      setPaymentDate(new Date(recordToEdit.date).toISOString().split('T')[0]);
      
      const existingOption = options.find(o => {
         const optDate = new Date(o.value);
         const recDate = new Date(recordToEdit.billingMonth || '');
         return !isNaN(optDate.getTime()) && !isNaN(recDate.getTime()) && optDate.getMonth() === recDate.getMonth() && optDate.getFullYear() === recDate.getFullYear();
      });
      setSelectedBillingMonth(existingOption ? existingOption.value : (recordToEdit.billingMonth || ''));

      if (isSkippedRec && recordToEdit.notes) {
        const match = recordToEdit.notes.match(/\(Skipped: (.*)\)/);
        setSkipReason(match ? match[1] : "");
      } else {
        setSkipReason("");
      }

    } else {
      // --- ADD NEW MODE ---
      setEditingFeeId(null);
      setAmount("1000"); 
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setIsSkipped(false);
      setSkipReason("");
      
      // Auto-select the month matching nextDueDate (or first available unpaid)
      const match = options.find(o => {
          const optDate = new Date(o.value);
          return optDate.getMonth() === nextDueDate.getMonth() && optDate.getFullYear() === nextDueDate.getFullYear();
      });
      
      if (match && !match.disabled) {
          setSelectedBillingMonth(match.value);
      } else {
          // Find first non-disabled option
          const firstAvailable = options.find(o => !o.disabled);
          setSelectedBillingMonth(firstAvailable ? firstAvailable.value : options[0].value);
      }
    }

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
    openPaymentModal(student);
  };

  const submitPayment = (closeAfterSave: boolean = true, wasReceiptSent: boolean = false) => {
    if (!paymentStudent || (!amount && !isSkipped) || !paymentDate || !selectedBillingMonth) return;

    const billingDateObj = new Date(selectedBillingMonth);
    const billingMonthStr = billingDateObj.toLocaleString('default', { month: 'short', year: 'numeric' });

    // --- DUPLICATE CHECK ---
    const isDuplicate = feeRecords.some(r => {
        if (r.studentId !== paymentStudent.id) return false;
        if (editingFeeId && r.id === editingFeeId) return false; // Ignore self if editing

        const rDate = getEffectiveBillingDate(r);
        return rDate.getMonth() === billingDateObj.getMonth() && 
               rDate.getFullYear() === billingDateObj.getFullYear();
    });

    if (isDuplicate) {
        toast.error(`Fee for ${billingMonthStr} is already paid!`);
        return;
    }

    const finalAmount = isSkipped ? 0 : parseFloat(amount);
    
    let noteText = `Billing Month: ${billingMonthStr}`;
    if (isSkipped) noteText += ` (Skipped: ${skipReason || 'No reason'})`;
    
    const nextDueDateObj = new Date(billingDateObj);
    nextDueDateObj.setMonth(nextDueDateObj.getMonth() + 1);
    if (paymentStudent.joinedDate) {
       const day = parseInt(paymentStudent.joinedDate.split('-')[2]);
       if (day) {
         nextDueDateObj.setDate(day);
       }
    }
    const nextDueStr = nextDueDateObj.toISOString().split('T')[0];

    // FIX: Preserve existing receiptSent status during edits
    let finalReceiptSent = wasReceiptSent;
    if (editingFeeId && !finalReceiptSent) {
       // Find existing record to see if it was already sent
       const existingRecord = feeRecords.find(r => r.id === editingFeeId);
       if (existingRecord?.receiptSent) {
          finalReceiptSent = true;
       }
    }

    const recordData = {
      id: editingFeeId || generateId(), // Use robust ID gen
      studentId: paymentStudent.id,
      amount: finalAmount,
      date: new Date(paymentDate).toISOString(),
      notes: noteText,
      receiptSent: finalReceiptSent, // Use calculated status
      billingMonth: selectedBillingMonth,
      nextDueDate: nextDueStr
    };

    if (editingFeeId) {
      onUpdateFeeRecord(recordData);
      toast.success("Payment Updated");
    } else {
      onAddFeeRecord(recordData);
      // RESET REMINDER COUNT ON PAYMENT
      onUpdateStudent({ ...paymentStudent, reminderCount: 0 });
      const msg = isSkipped ? `Waived ${billingMonthStr}` : `Paid for ${billingMonthStr}`;
      toast.success(msg);
    }

    if (closeAfterSave) {
      setIsPaymentModalOpen(false);
      setPaymentStudent(null);
      setEditingFeeId(null);
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

    let billingMonthDisplay = "Unknown Month";
    let nextDueText = "Check App";
    
    if (record.billingMonth) {
        const d = new Date(record.billingMonth);
        if (!isNaN(d.getTime())) {
           billingMonthDisplay = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        }
    } else if (record.notes?.includes("Billing Month:")) {
        const match = record.notes.match(/Billing Month: ([^(]+)/);
        if (match) billingMonthDisplay = match[1].trim();
    } else if (record.date) {
        const d = new Date(record.date);
        billingMonthDisplay = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    if (record.nextDueDate) {
        const d = new Date(record.nextDueDate);
        if (!isNaN(d.getTime())) {
           nextDueText = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }
    } else {
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
    
    // Increment Reminder Count & Update Timestamp
    onUpdateStudent({ 
       ...student, 
       lastReminderSentAt: new Date().toISOString(),
       reminderCount: (student.reminderCount || 0) + 1 
    });
    toast.success("Reminder Logged!");
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
          student.mobileNumber,
          getBillingDayText(student.joinedDate),
          formatDate(lastPaidDateObj),
          formatDate(nextDueDate),
          isOverdue ? 'OVERDUE' : 'PAID'
        ];
      });

      autoTable(doc, {
        startY: 40,
        head: [tableColumn],
        body: tableRows,
      });

      doc.save(`Fee_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF Downloaded", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("PDF generation failed", { id: toastId });
    }
  };

  const toggleHistory = (studentId: string) => {
    setExpandedStudentId(expandedStudentId === studentId ? null : studentId);
  };

  return (
    <div className="pb-24 space-y-4">
      {/* HEADER & FILTERS */}
      <div className="bg-white p-4 rounded-b-3xl shadow-sm border-b border-gray-100 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Fee Manager</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadPDF} className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100">
              <Download size={20} />
            </button>
            <div className="bg-gray-100 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600">
               {filteredStudents.length} Students
            </div>
          </div>
        </div>
        
        <div className="relative mb-3">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
           <input 
             type="text" 
             placeholder="Search by name..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 placeholder-gray-400 transition-colors"
           />
        </div>

        <div className="flex gap-2">
           <div className="flex bg-gray-50 p-1 rounded-xl flex-1">
              {(['Overdue', 'Paid', 'All'] as const).map(f => (
                <button 
                  key={f} 
                  onClick={() => setFilter(f)} 
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
                >
                  {f}
                </button>
              ))}
           </div>
           <div className="w-1/3 min-w-[110px]">
             <select 
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full h-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-700 font-bold text-xs appearance-none"
             >
               {uniqueGrades.map(g => <option key={g} value={g}>{g === 'All' ? 'All Grades' : `Grade ${g}`}</option>)}
             </select>
           </div>
        </div>
      </div>

      {/* STUDENT LIST */}
      <div className="px-1 space-y-3">
        {filteredStudents.map(student => {
          const { isOverdue, lastPaidDateObj, nextDueDate, paymentCount, joinDate, lastReceiptSent } = getStudentFeeStatus(student);
          const history = feeRecords.filter(r => r.studentId === student.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          return (
            <div key={student.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
               <div className="p-4">
                 <div className="flex justify-between items-start mb-4">
                   <div>
                     <h3 className="text-lg font-bold text-gray-800">{student.name}</h3>
                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">Grade {student.grade}</span>
                        <span className="text-[10px] text-gray-400">({paymentCount} payments)</span>
                     </div>
                   </div>
                   <div className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${isOverdue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                      {isOverdue ? <><X size={10} strokeWidth={3} /> OVERDUE</> : <><Check size={10} strokeWidth={3} /> PAID</>}
                   </div>
                 </div>

                 <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 text-center">
                       <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Bill Date</p>
                       <p className="text-xs font-bold text-gray-700">{getBillingDayText(student.joinedDate)}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 text-center relative">
                       <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Last Paid</p>
                       <p className={`text-xs font-bold ${lastPaidDateObj ? 'text-gray-700' : 'text-orange-500'}`}>{formatDate(lastPaidDateObj) || 'Never'}</p>
                       {/* Receipt Sent Indicator */}
                       {lastReceiptSent && (
                          <div className="absolute top-1 right-1 text-green-600 bg-green-100 rounded-full p-0.5" title="Receipt Sent">
                             <CheckCheck size={10} />
                          </div>
                       )}
                    </div>
                    <div className={`bg-gray-50 p-2 rounded-xl border text-center ${isOverdue ? 'border-red-100 bg-red-50' : 'border-gray-100'}`}>
                       <p className={`text-[9px] font-bold uppercase mb-1 ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>Next Due</p>
                       <p className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>{formatDate(nextDueDate)}</p>
                    </div>
                 </div>

                 <div className="flex gap-2">
                    <button 
                      onClick={() => openPaymentModal(student)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                       <DollarSign size={16} /> Record Payment
                    </button>
                    
                    {isOverdue && (
                      <button 
                        onClick={() => handleSendReminder(student, lastPaidDateObj, nextDueDate)}
                        className="p-3 bg-green-50 text-green-600 rounded-xl border border-green-100 hover:bg-green-100 flex items-center justify-center active:scale-95 transition-transform relative"
                        title="Send WhatsApp Reminder"
                      >
                         <MessageCircle size={20} />
                         
                         {/* Visual Counter for Reminders Sent */}
                         {student.reminderCount && student.reminderCount > 0 ? (
                           <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white">
                             {student.reminderCount}
                           </span>
                         ) : null}

                         {/* Recent Pulse Animation */}
                         {student.lastReminderSentAt && wasSentRecently(student.lastReminderSentAt) && !student.reminderCount && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                         )}
                      </button>
                    )}
                    
                    <button 
                      onClick={() => toggleHistory(student.id)}
                      className={`p-3 rounded-xl border flex items-center justify-center active:scale-95 transition-transform ${expandedStudentId === student.id ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-white border-gray-200 text-gray-500'}`}
                    >
                       <History size={20} />
                    </button>
                 </div>
               </div>

               {/* PAYMENT HISTORY DROPDOWN */}
               {expandedStudentId === student.id && (
                  <div className="bg-gray-50 border-t border-gray-100 p-4 animate-slide-up">
                     <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                           <History size={12} /> Payment History
                        </h4>
                        <span className="text-[10px] text-gray-400">{history.length} records</span>
                     </div>
                     <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {history.length === 0 ? (
                           <p className="text-xs text-center text-gray-400 py-2">No payment history found.</p>
                        ) : (
                           history.map(record => (
                              <div key={record.id} className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center group">
                                 <div>
                                    <p className="text-xs font-bold text-gray-800">{formatDate(record.date)}</p>
                                    <p className="text-[10px] text-gray-500">{record.notes || 'Payment Received'}</p>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <span className={`text-sm font-bold ${record.amount === 0 ? 'text-gray-400 line-through' : 'text-gray-800'}`}>Rs.{record.amount}</span>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex gap-1">
                                       <button 
                                          onClick={() => handleSendPastReceipt(student, record)}
                                          className={`p-1.5 rounded-lg ${record.receiptSent ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                                          title="Resend Receipt"
                                       >
                                          {record.receiptSent ? <CheckCheck size={14} /> : <MessageCircle size={14} />}
                                       </button>
                                       <button 
                                          onClick={() => openPaymentModal(student, record)}
                                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                                          title="Edit Record"
                                       >
                                          <Edit2 size={14} />
                                       </button>
                                       <button 
                                          onClick={() => {
                                             if(confirm('Are you sure you want to delete this payment?')) {
                                                onDeleteFeeRecord(record.id);
                                                toast.success('Payment deleted');
                                             }
                                          }}
                                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                          title="Delete Record"
                                       >
                                          <Trash2 size={14} />
                                       </button>
                                    </div>
                                 </div>
                              </div>
                           ))
                        )}
                     </div>
                  </div>
               )}
            </div>
          );
        })}
        {filteredStudents.length === 0 && (
           <div className="text-center py-10 text-gray-400">
              <p>No students match the selected filters.</p>
           </div>
        )}
      </div>

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && paymentStudent && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in backdrop-blur-sm">
           <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up sm:animate-scale-in relative shadow-2xl">
              
              {/* Navigation Arrows (Only in Add Mode) */}
              {!editingFeeId && (
                 <>
                   {prevStudent && (
                     <button 
                        onClick={() => switchToStudent(prevStudent)}
                        className="absolute -left-12 top-1/2 -translate-y-1/2 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 hidden sm:block"
                     >
                        <ChevronLeft size={24} />
                     </button>
                   )}
                   {nextStudent && (
                     <button 
                        onClick={() => switchToStudent(nextStudent)}
                        className="absolute -right-12 top-1/2 -translate-y-1/2 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 hidden sm:block"
                     >
                        <ChevronRight size={24} />
                     </button>
                   )}
                 </>
              )}

              <div className="text-center mb-6 bg-indigo-600 -mx-6 -mt-6 p-6 rounded-t-2xl">
                 <h3 className="text-xl font-bold text-white mb-1">
                   {editingFeeId ? 'Edit Payment' : 'Record Payment'}
                 </h3>
                 <p className="text-indigo-200 text-sm font-medium">{paymentStudent.name}</p>
              </div>
              
              <div className="space-y-4">
                 
                 {/* Skipped Toggle */}
                 <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <input 
                      type="checkbox" 
                      id="skipped" 
                      checked={isSkipped} 
                      onChange={(e) => setIsSkipped(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 bg-white"
                    />
                    <label htmlFor="skipped" className="text-sm font-bold text-gray-700 flex-1">Mark as Skipped / Leave</label>
                 </div>

                 {/* Amount */}
                 {!isSkipped && (
                    <div>
                       <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Amount (LKR)</label>
                       <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rs.</span>
                          <input 
                            type="number" 
                            value={amount} 
                            onChange={(e) => setAmount(e.target.value)} 
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold text-gray-800"
                          />
                       </div>
                    </div>
                 )}

                 {/* Skip Reason */}
                 {isSkipped && (
                    <div>
                       <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Reason for Skipping</label>
                       <input 
                         type="text" 
                         value={skipReason} 
                         onChange={(e) => setSkipReason(e.target.value)} 
                         placeholder="e.g. Medical Leave, Scholarship"
                         className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                       />
                    </div>
                 )}

                 {/* Month Selector */}
                 <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Paying For Month</label>
                    <div className="relative">
                       <select 
                          value={selectedBillingMonth}
                          onChange={(e) => setSelectedBillingMonth(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-indigo-900 appearance-none"
                       >
                          {billingOptions.map(opt => (
                             <option key={opt.value} value={opt.value} disabled={opt.disabled} className={opt.disabled ? 'text-gray-400' : 'text-gray-900'}>
                                {opt.label}
                             </option>
                          ))}
                       </select>
                       <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-indigo-400">
                          <ChevronDown size={16} />
                       </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 pl-1">This will be the cycle marked as cleared.</p>
                 </div>
                 
                 {/* Payment Date */}
                 <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Payment Received Date</label>
                    <input 
                      type="date" 
                      value={paymentDate} 
                      onChange={(e) => setPaymentDate(e.target.value)} 
                      className="w-full px-4 py-3 rounded-xl border-2 border-indigo-100 bg-white focus:outline-none focus:border-indigo-500 font-bold text-gray-800"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => { setIsPaymentModalOpen(false); setEditingFeeId(null); }} className="py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">
                       Cancel
                    </button>
                    <button onClick={() => submitPayment(true)} className="py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                       Save
                    </button>
                 </div>
                 
                 <button 
                   onClick={handleSaveAndWhatsApp}
                   className="w-full py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                 >
                    <Send size={18} /> Save & Send WhatsApp
                 </button>

                 {!editingFeeId && nextStudent && (
                    <button 
                       onClick={handleSaveAndNext}
                       className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 flex items-center justify-center gap-2"
                    >
                       Save & Next <ArrowRight size={18} />
                    </button>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default FeeTracker;