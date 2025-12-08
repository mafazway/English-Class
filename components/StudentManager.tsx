




import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Student, FeeRecord, ExamRecord } from '../types';
import { Plus, User, Phone, Search, X, Edit2, Trash2, Camera, Contact, MessageCircle, Filter, UserCircle, CheckCircle, Loader2, ChevronLeft, ChevronRight, PauseCircle, PlayCircle } from 'lucide-react';
import { Button, Card, Input, TextArea, Select } from './UIComponents';
import toast from 'react-hot-toast';
import { formatSLNumber } from '../utils';

interface Props {
  students: Student[];
  feeRecords: FeeRecord[];
  examRecords: ExamRecord[];
  onAddStudent: (s: Student) => Promise<boolean> | void;
  onUpdateStudent: (s: Student) => void;
  onDeleteStudent: (id: string) => void;
  shouldOpenAddModal?: boolean;
  onResetAddModal?: () => void;
}

const StudentManager: React.FC<Props> = ({ students, feeRecords, examRecords, onAddStudent, onUpdateStudent, onDeleteStudent, shouldOpenAddModal, onResetAddModal }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState(''); 
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UX Feedback State
  const [sessionAddedCount, setSessionAddedCount] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false); 
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Student>>({});

  // Auto Open Modal Logic from Props
  useEffect(() => {
    if (shouldOpenAddModal) {
      openModal(); // Open empty form
      if (onResetAddModal) onResetAddModal();
    }
  }, [shouldOpenAddModal, onResetAddModal]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const openModal = (student?: Student) => {
    setActiveMenuId(null); // Close any open menu
    if (student) {
      setEditingId(student.id);
      setFormData(student);
      setSessionAddedCount(0);
    } else {
      setEditingId(null);
      setSessionAddedCount(0); // Reset session count for new batch
      setFormData({ 
        admissionNumber: '',
        name: '', 
        parentName: '', 
        mobileNumber: '', 
        whatsappNumber: '',
        grade: '', 
        gender: 'Male', // Default
        notes: '',
        joinedDate: new Date().toISOString().slice(0, 10),
        photo: '',
        status: 'active'
      });
      // Focus Name input slightly after modal opens
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingId) {
      // EDIT MODE
      onUpdateStudent({ ...formData, id: editingId } as Student);
      // DO NOT CLOSE MODAL - Allows user to use Navigation Arrows immediately
      toast.success("Changes Saved!");
    } else {
      // ADD MODE
      const success = await onAddStudent({ ...formData, id: Date.now().toString() } as Student);
      
      // ONLY if save was successful (returned true)
      if (success !== false) {
        toast.success("Student Added! Ready for next.");
        setSessionAddedCount(prev => prev + 1);

        // Reset Partial Form (Keep Grade, Date, Gender for ease of bulk entry)
        setFormData(prev => ({ 
          ...prev, 
          admissionNumber: '',
          name: '', 
          parentName: '', 
          mobileNumber: '', 
          whatsappNumber: '',
          notes: '',
          photo: '',
          status: 'active'
        }));

        // Auto Focus Name Field for next entry
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      }
    }
  };

  // --- Stats Calculation for Editing Student ---
  const studentStats = useMemo(() => {
    if (!editingId) return null;
    
    // Fees
    const sFees = feeRecords.filter(f => f.studentId === editingId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastFee = sFees[0];
    const lastPaidDate = lastFee ? new Date(lastFee.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No Data';

    // Exams
    const sExams = examRecords.filter(e => e.studentId === editingId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastExam = sExams[0];
    const lastExamStr = lastExam ? `${lastExam.testName}: ${lastExam.score}/${lastExam.total}` : 'No Data';

    return { lastPaidDate, lastExamStr };
  }, [editingId, feeRecords, examRecords]);

  // --- Camera / Image Handling (Compressed) ---
  const handleImageClick = () => {
    if (!isCompressing) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        // Compress to WebP, 150px, 0.7 Quality
        const compressedBase64 = await compressImage(file);
        setFormData(prev => ({ ...prev, photo: compressedBase64 }));
        toast.success("Photo compressed & ready!");
      } catch (error) {
        console.error(error);
        toast.error("Failed to process image.");
      } finally {
        setIsCompressing(false);
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Compresses image to WebP format, Max 150px width/height.
   * Target size: ~5-15KB
   */
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 150; // Passport size target
          let width = img.width;
          let height = img.height;

          // Resize logic maintaining aspect ratio
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
             // Fill white background (for transparent PNGs converted to WebP)
             ctx.fillStyle = '#FFFFFF';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             ctx.drawImage(img, 0, 0, width, height);
             
             // Export as WebP with 0.7 quality
             // This produces a very small string suitable for DB text columns if Storage buckets aren't used
             resolve(canvas.toDataURL('image/webp', 0.7)); 
          } else {
             reject(new Error("Canvas context failed"));
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // --- Contact Picker Handling ---
  const handleImportContact = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        // @ts-ignore
        const contacts = await navigator.contacts.select(props, opts);
        
        if (contacts && contacts.length > 0) {
          const contact = contacts[0];
          let importedNumber = contact.tel?.[0] || '';
          // Clean number: remove spaces, dashes, parentheses
          importedNumber = importedNumber.replace(/[^0-9+]/g, '');

          const contactName = contact.name?.[0] || '';

          setFormData(prev => ({
            ...prev,
            name: contactName || prev.name, // Overwrite name if found
            mobileNumber: importedNumber,
            whatsappNumber: importedNumber, // Helpful default
            parentName: prev.parentName || (contactName ? `${contactName}'s Parent` : '')
          }));
        }
      } catch (ex) {
        const err = ex as Error;
        if (err.name !== 'TypeError') { // Ignore cancellation errors
           alert(`Contact import failed: ${err.message}. Please check Phone Permissions.`);
        }
      }
    } else {
      alert("Contact Import is not supported on this device/browser. Please try using Google Chrome on Android.");
    }
  };

  const uniqueGrades = Array.from(new Set(students.map(s => s.grade).filter(Boolean))).sort();

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGrade = selectedGradeFilter ? s.grade === selectedGradeFilter : true;

    return matchesSearch && matchesGrade;
  });

  // Calculate Indices for Navigation
  const currentIndex = editingId ? filteredStudents.findIndex(s => s.id === editingId) : -1;
  const prevStudent = currentIndex > 0 ? filteredStudents[currentIndex - 1] : null;
  const nextStudent = currentIndex !== -1 && currentIndex < filteredStudents.length - 1 ? filteredStudents[currentIndex + 1] : null;

  return (
    <div className="pb-24 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-50/95 backdrop-blur z-10 py-2">
        <h2 className="text-2xl font-bold text-gray-800">Students</h2>
        <button className="p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm">
          <Filter size={20} />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500" size={18} />
          <input 
            type="text" 
            placeholder="Search name or ID..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-transparent bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-gray-800 placeholder-gray-400 transition-all font-medium"
          />
        </div>
        <div className="w-1/3 min-w-[110px]">
          <select 
            value={selectedGradeFilter}
            onChange={(e) => setSelectedGradeFilter(e.target.value)}
            className="w-full h-full px-4 py-3.5 rounded-2xl border border-transparent bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-gray-700 appearance-none text-sm font-bold"
            style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='gray' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem center', backgroundSize: '1em' }}
          >
            <option value="">All Grades</option>
            {uniqueGrades.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students List */}
      <div className="grid gap-3">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <User size={48} className="mx-auto mb-2 opacity-20" />
            <p>No students found.</p>
            {selectedGradeFilter && <p className="text-sm text-gray-400">Try changing the grade filter.</p>}
          </div>
        ) : (
          filteredStudents.map(student => {
             const isSuspended = student.status === 'temporary_suspended';
             
             return (
              <Card 
                key={student.id} 
                className={`p-4 flex justify-between items-center active:scale-[0.99] transition-transform cursor-pointer group hover:border-indigo-100 relative ${isSuspended ? 'opacity-70 bg-gray-100 border-gray-200' : ''}`}
                onClick={() => openModal(student)}
              >
                <div className="flex-1 flex items-center gap-4">
                  {/* Avatar Display */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-gray-400 font-bold text-lg overflow-hidden border-2 ${isSuspended ? 'bg-gray-200 border-gray-300' : 'bg-gray-100 border-white shadow-sm'}`}>
                    {student.photo ? (
                      <img src={student.photo} alt={student.name} className={`w-full h-full object-cover ${isSuspended ? 'grayscale' : ''}`} />
                    ) : (
                      student.name.charAt(0)
                    )}
                  </div>
                  
                  <div className="min-w-0">
                     <div className="flex items-center gap-2">
                       <h3 className="font-bold text-gray-800 text-base leading-tight truncate">{student.name}</h3>
                       {student.gender === 'Female' && <span className="text-[10px] bg-pink-50 text-pink-500 px-1.5 py-0.5 rounded-full font-bold">F</span>}
                     </div>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mt-0.5">Grade {student.grade} <span className="text-gray-300 mx-1">|</span> {student.admissionNumber || 'No ID'}</p>
                     
                     {/* Suspended Badge */}
                     {isSuspended && (
                        <div className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-md text-[10px] font-bold mt-1">
                           <PauseCircle size={10} /> Temporarily Left
                        </div>
                     )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-row gap-2 z-10 pl-2">
                   {student.whatsappNumber && (
                      <button onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${formatSLNumber(student.whatsappNumber)}`)}} className="p-2.5 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors shadow-sm">
                         <MessageCircle size={18} />
                      </button>
                   )}
                   <ChevronRight size={20} className="text-gray-300 ml-1 self-center" />
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] animate-slide-up sm:animate-scale-in max-h-[90vh] relative flex flex-col shadow-2xl">
            
            {/* FLOATING NAVIGATION BUTTONS */}
            {editingId && (
               <>
                 {prevStudent && (
                   <button 
                      onClick={() => openModal(prevStudent)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/40 backdrop-blur-md text-gray-700 shadow-lg hover:bg-white/60 transition-all active:scale-95 border border-white/40"
                      title="Previous Student"
                   >
                      <ChevronLeft size={24} />
                   </button>
                 )}
                 {nextStudent && (
                   <button 
                      onClick={() => openModal(nextStudent)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/40 backdrop-blur-md text-gray-700 shadow-lg hover:bg-white/60 transition-all active:scale-95 border border-white/40"
                      title="Next Student"
                   >
                      <ChevronRight size={24} />
                   </button>
                 )}
               </>
            )}

            <div className="overflow-y-auto p-6 pb-24 sm:pb-6 flex-1 w-full">
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-2 border-b border-gray-50">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {editingId ? <Edit2 size={20} className="text-indigo-600"/> : <Plus size={20} className="text-indigo-600"/>}
                    {editingId ? 'Edit Student' : 'Add Student'}
                  </h3>
                  {/* Session Counter */}
                  {!editingId && sessionAddedCount > 0 && (
                    <p className="text-xs text-green-600 font-bold mt-1 flex items-center gap-1">
                      <CheckCircle size={12} /> {sessionAddedCount} added in this session
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2">
                   {editingId && (
                     <button onClick={() => { if(confirm('Delete student? This cannot be undone.')) { onDeleteStudent(editingId); setIsModalOpen(false); } }} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                       <Trash2 size={20} />
                     </button>
                   )}
                   <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                     <X size={20} />
                   </button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* ACTIVE / SUSPENDED TOGGLE (Only in Edit Mode) */}
                {editingId && (
                   <div className={`p-4 rounded-2xl border flex items-center justify-between ${formData.status === 'temporary_suspended' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center gap-3">
                         {formData.status === 'temporary_suspended' ? <PauseCircle className="text-yellow-600" /> : <PlayCircle className="text-green-600" />}
                         <div>
                            <p className={`text-sm font-bold ${formData.status === 'temporary_suspended' ? 'text-yellow-800' : 'text-gray-800'}`}>
                               {formData.status === 'temporary_suspended' ? 'Student Temporarily Left' : 'Active Student'}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                               {formData.status === 'temporary_suspended' ? 'Hidden from attendance lists.' : 'Visible in all lists.'}
                            </p>
                         </div>
                      </div>
                      <button 
                         type="button"
                         onClick={() => setFormData(prev => ({ ...prev, status: prev.status === 'temporary_suspended' ? 'active' : 'temporary_suspended' }))}
                         className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${formData.status === 'temporary_suspended' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-600'}`}
                      >
                         {formData.status === 'temporary_suspended' ? 'Resume' : 'Suspend'}
                      </button>
                   </div>
                )}

                {/* Photo & ID Section */}
                <div className="flex gap-5">
                  <div className="relative">
                    <div 
                      onClick={handleImageClick}
                      className={`w-24 h-24 rounded-[1.5rem] bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 overflow-hidden relative shadow-sm ${isCompressing ? 'opacity-75 pointer-events-none' : ''}`}
                    >
                      {isCompressing ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="animate-spin text-indigo-600 mb-1" size={20} />
                          <span className="text-[9px] font-bold text-indigo-600">WebP...</span>
                        </div>
                      ) : formData.photo ? (
                        <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="text-gray-300" size={28} />
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <Input 
                      label="Admission No" 
                      placeholder="001" 
                      value={formData.admissionNumber || ''} 
                      onChange={e => setFormData({...formData, admissionNumber: e.target.value})} 
                      className="!mb-0"
                    />
                    <div className="flex gap-2 pt-2">
                       <label className={`flex-1 flex items-center justify-center px-3 py-3 rounded-2xl border text-sm font-bold cursor-pointer transition-all ${formData.gender === 'Male' ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'border-gray-200 text-gray-500 bg-white'}`}>
                          <input type="radio" name="gender" className="hidden" checked={formData.gender === 'Male'} onChange={() => setFormData({...formData, gender: 'Male'})} />
                          Male
                       </label>
                       <label className={`flex-1 flex items-center justify-center px-3 py-3 rounded-2xl border text-sm font-bold cursor-pointer transition-all ${formData.gender === 'Female' ? 'bg-pink-50 border-pink-200 text-pink-600 shadow-sm' : 'border-gray-200 text-gray-500 bg-white'}`}>
                          <input type="radio" name="gender" className="hidden" checked={formData.gender === 'Female'} onChange={() => setFormData({...formData, gender: 'Female'})} />
                          Female
                       </label>
                    </div>
                  </div>
                </div>

                {/* Name Input with Contact Import & Ref */}
                <div className="relative group">
                   <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-indigo-600">Student Name</label>
                   <div className="flex gap-2">
                      <input 
                        ref={nameInputRef}
                        className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-gray-50/80 focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-gray-800 placeholder-gray-400 font-bold"
                        placeholder="Enter Full Name"
                        value={formData.name || ''}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        required
                      />
                      <button 
                        type="button"
                        onClick={handleImportContact}
                        className="px-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                        title="Import from Contacts"
                      >
                         <Contact size={20} />
                      </button>
                   </div>
                </div>

                {/* --- STUDENT SUMMARY STATS (NEW) --- */}
                {editingId && studentStats && (
                  <div className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-2xl border border-indigo-100 flex justify-between items-center text-xs font-medium text-indigo-900 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-sm text-lg">💰</div>
                      <div>
                        <p className="opacity-60 text-[9px] uppercase tracking-wider font-bold">Last Paid</p>
                        <p className="font-bold text-sm">{studentStats.lastPaidDate}</p>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-indigo-100"></div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="opacity-60 text-[9px] uppercase tracking-wider font-bold">Last Exam</p>
                        <p className="font-bold text-sm">{studentStats.lastExamStr}</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl shadow-sm text-lg">📊</div>
                    </div>
                  </div>
                )}

                <Input label="Parent Name" placeholder="Father/Mother Name" value={formData.parentName || ''} onChange={e => setFormData({...formData, parentName: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Mobile No" type="tel" placeholder="07x..." value={formData.mobileNumber || ''} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} />
                  <Input label="WhatsApp" type="tel" placeholder="07x..." value={formData.whatsappNumber || ''} onChange={e => setFormData({...formData, whatsappNumber: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Grade" placeholder="e.g. 10" value={formData.grade || ''} onChange={e => setFormData({...formData, grade: e.target.value})} />
                  <Input label="Joined Date" type="date" value={formData.joinedDate || ''} onChange={e => setFormData({...formData, joinedDate: e.target.value})} />
                </div>

                <TextArea label="Notes / Address" placeholder="Any additional details..." value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} rows={2} />

                <Button type="submit" className="w-full text-lg py-4 mt-2 shadow-xl shadow-indigo-200/50">
                  {editingId ? 'Save Changes' : 'Add Student'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManager;
