import React, { useState } from 'react';
import { Student, FeeRecord } from '../types';
import { Filter, ChevronDown, Check, X, DollarSign, MessageCircle, Trash2, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FeeTrackerProps {
  students: Student[];
  feeRecords: FeeRecord[];
  onAddFeeRecord: (record: FeeRecord) => void;
  onDeleteFeeRecord: (id: string) => void;
}

const FeeTracker: React.FC<FeeTrackerProps> = ({ students = [], feeRecords = [], onAddFeeRecord, onDeleteFeeRecord }) => {
  const [filter, setFilter] = useState<'Unpaid' | 'Paid' | 'All'>('Unpaid');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  
  // --- PAYMENT MODAL STATE ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState<string>("1500");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to Today

  const uniqueGrades = ['All', ...Array.from(new Set((students || []).map(s => s.grade || 'Unknown'))).sort()];

  // --- HELPERS ---
  const formatDate = (dateString?: string) => {
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

  const getStudentDetails = (student: Student) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const currentRecord = feeRecords.find(r => 
      r.studentId === student.id && 
      new Date(r.date).getMonth() === currentMonth && 
      new Date(r.date).getFullYear() === currentYear
    );

    const studentPayments = feeRecords
      .filter(r => r.studentId === student.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastPaidDateObj = studentPayments.length > 0 ? studentPayments[0].date : null;

    let dueDay = 1;
    if (student.joinedDate) dueDay = new Date(student.joinedDate).getDate();
    const dueDate = new Date(currentYear, currentMonth, dueDay);
    const dueDateString = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

    return { isPaid: !!currentRecord, currentRecord, lastPaidDateObj, dueDateString };
  };

  // --- HANDLERS ---
  const openPaymentModal = (student: Student) => {
    setPaymentStudent(student);
    setAmount("1500"); // Reset Amount
    setPaymentDate(new Date().toISOString().split('T')[0]); // Reset Date to Today
    setIsPaymentModalOpen(true);
  };

  const submitPayment = () => {
    if (!paymentStudent || !amount || !paymentDate) return;

    onAddFeeRecord({
      id: crypto.randomUUID(),
      studentId: paymentStudent.id,
      amount: parseFloat(amount),
      date: new Date(paymentDate).toISOString() // Use selected date
    });
    
    toast.success(`Payment recorded for ${paymentStudent.name}`);
    setIsPaymentModalOpen(false);
    setPaymentStudent(null);
  };

  const handleSendReminder = (student: Student, lastPaidDateObj: string | null, dueDateString: string) => {
    const number = student.whatsappNumber || student.mobileNumber;
    if (!number) { toast.error("No mobile number found."); return; }

    const currentDueMonthName = new Date().toLocaleString('default', { month: 'long' });
    let lastPaidText = "முன்பு";
    let lastPaidDateFormatted = "N/A";

    if (lastPaidDateObj) {
      lastPaidDateFormatted = formatDate(lastPaidDateObj);
      const d = new Date(lastPaidDateObj);
      const lastPaidMonthName = d.toLocaleString('default', { month: 'long' });
      lastPaidText = `${lastPaidDateFormatted} அன்று தனது ${lastPaidMonthName}`;
    } else {
      lastPaidText = "இதுவரை கட்டணம் செலுத்தவில்லை, அல்லது";
    }

    const message = `🔔 *நினைவூட்டல் (Fee Reminder)*\n\nஅஸ்ஸலாமு அலைக்கும்,\n\n*${student.name}*, ${lastPaidText} மாதத்திற்கான கட்டணத்தை செலுத்தியுள்ளார்.\n\nஆனால் *${dueDateString}* அன்று செலுத்தப்பட்டிருக்க வேண்டிய *${currentDueMonthName}* மாதத்திற்கான கட்டணம் இதுவரை தாங்கள் செலுத்தவில்லை என்பதனை தாழ்மையுடன் நினைவூட்டிக் கொள்கின்றேன்.\n\nநன்றி.\nTeacher\nEnglish Class Academy`;

    const url = `https://wa.me/${formatSLNumber(number)}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredStudents = (students || []).filter(student => {
    if (selectedGrade !== 'All' && student.grade !== selectedGrade) return false;
    const { isPaid } = getStudentDetails(student);
    if (filter === 'Paid') return isPaid;
    if (filter === 'Unpaid') return !isPaid;
    return true;
  });

  return (
    <div className="p-4 pb-24 space-y-5 bg-gray-50 min-h-full">
      {/* HEADER CARD */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-extrabold text-slate-800">Fee Manager</h2>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full border border-slate-200">
            {filteredStudents.length} Students
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl flex-1">
            {['Unpaid', 'Paid', 'All'].map((tab) => (
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

      {/* STUDENT CARDS */}
      <div className="grid grid-cols-1 gap-4">
        {filteredStudents.map(student => {
          const { isPaid, currentRecord, lastPaidDateObj, dueDateString } = getStudentDetails(student);

          return (
            <div key={student.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-4 flex justify-between items-start border-b border-gray-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{student.name}</h3>
                  <div className="mt-1"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wide border border-slate-200">Grade {student.grade}</span></div>
                </div>
                {isPaid ? (
                  <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-green-200 shadow-sm"><Check size={14} strokeWidth={3} /> PAID</span>
                ) : (
                  <span className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-extrabold border border-red-200 shadow-sm"><X size={14} strokeWidth={3} /> DUE</span>
                )}
              </div>

              <div className="px-4 py-4">
                <div className="grid grid-cols-3 gap-0 bg-slate-50 rounded-xl border border-slate-200 divide-x divide-slate-200">
                  <div className="p-3 text-center"><span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Joined</span><span className="block text-sm font-bold text-slate-700">{formatDate(student.joinedDate)}</span></div>
                  <div className="p-3 text-center"><span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Paid</span><span className={`block text-sm font-bold ${lastPaidDateObj ? 'text-slate-700' : 'text-orange-500'}`}>{lastPaidDateObj ? formatDate(lastPaidDateObj) : 'Never'}</span></div>
                  <div className="p-3 text-center"><span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</span><span className={`block text-sm font-extrabold ${isPaid ? 'text-slate-400 line-through' : 'text-red-600'}`}>{dueDateString}</span></div>
                </div>
              </div>

              <div className="px-4 pb-4 flex gap-2">
                {!isPaid ? (
                  <>
                    <button onClick={() => openPaymentModal(student)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                      <DollarSign size={18} strokeWidth={2.5} /> Record Payment
                    </button>
                    <button onClick={() => handleSendReminder(student, lastPaidDateObj, dueDateString)} className="bg-green-100 hover:bg-green-200 text-green-700 p-3 rounded-xl shadow-sm border border-green-200 active:scale-[0.95] transition-all" title="Send WhatsApp">
                      <MessageCircle size={24} strokeWidth={2.5} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => { if(currentRecord && window.confirm("Delete this payment?")) onDeleteFeeRecord(currentRecord.id); }} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl border border-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm">
                    <Trash2 size={16} /> Undo Payment
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- PAYMENT POPUP MODAL --- */}
      {isPaymentModalOpen && paymentStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 p-6 text-white text-center">
              <h3 className="text-xl font-bold">Record Payment</h3>
              <p className="text-indigo-200 text-sm mt-1">{paymentStudent.name}</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Amount (LKR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400 font-bold">Rs.</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Payment Date</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                <button onClick={submitPayment} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-transform active:scale-95">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FeeTracker;