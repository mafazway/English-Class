
import React, { useState, useMemo, useEffect } from 'react';
import { ClassGroup } from '../types';
import { Trash2, Clock, X, Edit2, Coffee, Check, Filter, Share2, Plus, Calendar, LayoutGrid, List, ChevronRight } from 'lucide-react';
import { Button, Input, Select } from './UIComponents';

interface Props {
  classes: ClassGroup[];
  onAddClass: (c: ClassGroup) => void;
  onUpdateClass: (c: ClassGroup) => void;
  onDeleteClass: (id: string) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Timetable: React.FC<Props> = ({ classes, onAddClass, onUpdateClass, onDeleteClass }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // View Mode State
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  
  // Initialize activeDay. Default to current day name.
  const [activeDay, setActiveDay] = useState<string>(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  });

  // Filter & Copy State
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    day: 'Monday',
    startTime: '',
    duration: '60' // Default 60 mins
  });

  // ---------------------------------------------------------
  // 1. REAL-TIME CLOCK & TRAFFIC SIGNAL LOGIC
  // ---------------------------------------------------------

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const getClassStatus = (cls: ClassGroup): 'past' | 'present' | 'future' => {
    const now = currentTime;
    
    // UI Layout is Monday -> Sunday. We must match this order for "Past/Future" logic.
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Get ISO Day index for 'now' (Mon=0 ... Sun=6)
    // now.getDay() returns Sun=0, Mon=1...Sat=6
    const currentDayISO = (now.getDay() + 6) % 7; 

    const classDayIndex = daysOrder.indexOf(cls.day);
    
    if (classDayIndex === -1) return 'future';

    // 1. Compare Days
    if (classDayIndex < currentDayISO) return 'past';
    if (classDayIndex > currentDayISO) return 'future';

    // 2. Compare Time (If it's Today)
    try {
        const [sHours, sMinutes] = cls.startTime.split(':').map(Number);
        const startDate = new Date(now);
        startDate.setHours(sHours, sMinutes, 0, 0);

        // Calculate Duration / End Date
        let durationMinutes = 60; // Default fallback
        
        if (cls.schedule && cls.schedule.includes('-')) {
             const parts = cls.schedule.split('-');
             if (parts.length > 1) {
                 const endTimePart = parts[1].trim(); 
                 const match = endTimePart.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                 if (match) {
                     let [_, h, m, ampm] = match;
                     let hours = parseInt(h);
                     const minutes = parseInt(m);
                     
                     if (ampm) {
                       if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
                       if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
                     }
                     
                     const endDateCalc = new Date(now);
                     endDateCalc.setHours(hours, minutes, 0, 0);
                     
                     // If end time is calc'd as earlier than start time, assume next day? 
                     // For now, just take absolute difference or fallback
                     const diff = (endDateCalc.getTime() - startDate.getTime()) / 60000;
                     if (diff > 0) durationMinutes = diff;
                 }
             }
        }
        
        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

        if (now > endDate) return 'past';
        if (now >= startDate && now <= endDate) return 'present';
        return 'future';
    } catch (e) {
        return 'future';
    }
  };

  const getStatusStyles = (status: 'past' | 'present' | 'future') => {
    switch(status) {
      case 'present': 
        return 'border-l-4 border-green-500 bg-green-50 shadow-md ring-1 ring-green-300';
      case 'past': 
        return 'border-l-4 border-red-300 bg-gray-50 opacity-60 grayscale';
      case 'future': 
        return 'border-l-4 border-yellow-400 bg-white';
      default: 
        return 'bg-white border-gray-200';
    }
  };

  // ---------------------------------------------------------
  // 2. DATA PROCESSING
  // ---------------------------------------------------------

  const uniqueClassNames = useMemo(() => {
    return Array.from(new Set(classes.map(c => c.name))).sort();
  }, [classes]);

  const filteredClasses = useMemo(() => {
    if (!selectedGradeFilter) return classes;
    return classes.filter(c => c.name === selectedGradeFilter);
  }, [classes, selectedGradeFilter]);

  const availableDays = useMemo(() => {
    // Only show days that actually have classes in the filtered set
    const daysSet = new Set(filteredClasses.map(c => c.day));
    return DAYS_OF_WEEK.filter(d => daysSet.has(d));
  }, [filteredClasses]);

  const dayGroupedClasses = useMemo(() => {
    if (viewMode !== 'day') return [];
    
    // 1. Filter by Active Day
    const dayClasses = filteredClasses
       .filter(c => c.day === activeDay)
       .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 2. Group by Start Time
    const groups: Record<string, ClassGroup[]> = {};
    dayClasses.forEach(c => {
       if (!groups[c.startTime]) groups[c.startTime] = [];
       groups[c.startTime].push(c);
    });

    // 3. Convert to Array sorted by time
    return Object.keys(groups).sort().map(time => ({
       time,
       classes: groups[time]
    }));
  }, [filteredClasses, activeDay, viewMode]);

  // Ensure active day is valid when filtering changes
  useEffect(() => {
    if (viewMode === 'day' && availableDays.length > 0 && !availableDays.includes(activeDay)) {
       setActiveDay(availableDays[0]);
    }
  }, [availableDays, activeDay, viewMode, selectedGradeFilter]);


  // ---------------------------------------------------------
  // 3. ACTIONS
  // ---------------------------------------------------------

  const openModal = (cls?: ClassGroup) => {
    if (cls) {
      setEditingId(cls.id);
      setFormData({
        name: cls.name,
        day: cls.day,
        startTime: cls.startTime,
        duration: '60'
      });
    } else {
      setEditingId(null);
      setFormData({
        name: selectedGradeFilter || '',
        day: activeDay && DAYS_OF_WEEK.includes(activeDay) ? activeDay : 'Monday',
        startTime: '17:00',
        duration: '60'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startTime || !formData.day) return;

    const [hours, minutes] = formData.startTime.split(':').map(Number);
    const durationMins = parseInt(formData.duration);
    
    const startObj = new Date();
    startObj.setHours(hours, minutes);
    const endObj = new Date(startObj.getTime() + durationMins * 60000);
    
    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const timeRange = `${formatTime(startObj)} - ${formatTime(endObj)}`;
    const scheduleDisplay = `${formData.day.slice(0, 3)} ${timeRange}`;

    const classData = {
        id: editingId || Date.now().toString(),
        name: formData.name,
        day: formData.day,
        startTime: formData.startTime,
        schedule: scheduleDisplay
    } as ClassGroup;

    if (editingId) {
      onUpdateClass(classData);
    } else {
      onAddClass(classData);
    }
    setIsModalOpen(false);
  };

  const formatTime12H = (time24: string) => {
     if (!time24) return '';
     const [h, m] = time24.split(':').map(Number);
     const date = new Date();
     date.setHours(h, m);
     return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleCopySchedule = () => {
    if (filteredClasses.length === 0) return;
    const textLines = [`📅 Schedule${selectedGradeFilter ? ` for ${selectedGradeFilter}` : ''}:`];
    DAYS_OF_WEEK.forEach(day => {
      const dayClasses = filteredClasses.filter(c => c.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
      if (dayClasses.length > 0) {
        const times = dayClasses.map(c => selectedGradeFilter ? formatTime12H(c.startTime) : `${c.name} @ ${formatTime12H(c.startTime)}`).join(', ');
        textLines.push(`${day}: ${times}`);
      }
    });
    navigator.clipboard.writeText(textLines.join('\n'));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // ---------------------------------------------------------
  // 4. RENDER
  // ---------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      
      {/* ================= LAYER 1: FIXED HEADER ================= */}
      <div className="flex-none bg-white shadow-sm z-20 relative border-b border-gray-100">
        <div className="flex justify-between items-center px-4 pt-4 pb-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Timetable</h2>
            <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
               <Clock size={10} />
               {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
             <button onClick={() => setViewMode('day')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <List size={14} strokeWidth={2.5} /> Day
             </button>
             <button onClick={() => setViewMode('week')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <LayoutGrid size={14} strokeWidth={2.5} /> Week
             </button>
          </div>
        </div>

        <div className="px-4 pb-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[130px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select 
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all appearance-none"
            >
              <option value="">All Grades</option>
              {uniqueClassNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
          </div>

          <button onClick={handleCopySchedule} disabled={filteredClasses.length === 0} className={`px-3 py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm font-bold text-xs h-[42px] ${copyFeedback ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {copyFeedback ? <Check size={16} /> : <Share2 size={16} />}
          </button>

          <button onClick={() => openModal()} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 flex items-center justify-center gap-2 font-bold text-xs h-[42px] hover:bg-indigo-700 active:scale-95 transition-all">
              <Plus size={16} strokeWidth={3} /> Add
          </button>
        </div>
      </div>

      {/* ================= LAYER 2: DAY TABS (Only Day Mode) ================= */}
      {viewMode === 'day' && availableDays.length > 0 && (
        <div className="flex-none bg-white border-b border-gray-100 px-4 pt-1 pb-3 overflow-x-auto no-scrollbar z-10 mb-2 shadow-sm">
           <div className="flex gap-2">
             {availableDays.map(day => (
               <button
                 key={day}
                 onClick={() => setActiveDay(day)}
                 className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                   activeDay === day 
                     ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' 
                     : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                 }`}
               >
                 {day}
               </button>
             ))}
           </div>
        </div>
      )}

      {/* ================= LAYER 3: SCROLLABLE CONTENT ================= */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 pb-24">
         
         {filteredClasses.length === 0 && (
           <div className="flex flex-col items-center justify-center py-12 text-gray-400 opacity-60">
             <div className="bg-gray-100 p-4 rounded-full mb-3">
                <Coffee size={32} className="text-gray-400" />
             </div>
             <p className="text-sm font-medium">No classes found.</p>
           </div>
         )}

         {/* VIEW: DAY MODE - Time Grouped */}
         {viewMode === 'day' && dayGroupedClasses.length > 0 && (
            <div className="space-y-6 relative pl-2">
              {dayGroupedClasses.map((group) => {
                 const timeStatus = getClassStatus(group.classes[0]); // Use first class to determine time slot status
                 
                 return (
                   <div key={group.time} className="relative pl-6 border-l-2 border-indigo-100 pb-2">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 shadow-sm z-10 bg-white ${
                          timeStatus === 'present' ? 'border-green-500 ring-2 ring-green-100' : 
                          timeStatus === 'future' ? 'border-yellow-400' : 
                          'border-gray-300'
                      }`}>
                         {timeStatus === 'present' && <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20"></div>}
                      </div>
                      
                      {/* Time Header */}
                      <div className="flex items-center gap-3 mb-3 -mt-1.5">
                         <span className={`text-lg font-bold ${timeStatus === 'past' ? 'text-gray-400' : 'text-gray-800'}`}>
                            {formatTime12H(group.time)}
                         </span>
                         <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                            {group.classes.length} Classes
                         </span>
                      </div>

                      {/* COMPACT Grid of Classes */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                         {group.classes.map(cls => {
                            const status = getClassStatus(cls);
                            // Extract end time or duration for compact display
                            const durationText = cls.schedule.includes('-') 
                                ? cls.schedule.split('-')[1].trim()
                                : '60m';

                            return (
                              <div 
                                  key={cls.id}
                                  onClick={() => openModal(cls)}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer group active:scale-[0.98] relative flex flex-col justify-between min-h-[70px] ${getStatusStyles(status)}`}
                              >
                                 <div className="flex justify-between items-start mb-1">
                                     <span className="font-bold text-sm text-gray-800 leading-tight line-clamp-2 pr-4">
                                        {cls.name}
                                     </span>
                                     {/* Edit Icon */}
                                     <div className="absolute top-2 right-2 text-gray-300 hover:text-indigo-600 transition-colors">
                                        <Edit2 size={12} />
                                     </div>
                                 </div>

                                 <div className="flex items-center gap-1.5 mt-auto">
                                    <Clock size={10} className={status === 'past' ? 'text-gray-400' : 'text-indigo-400'} />
                                    <span className={`text-[10px] font-bold ${status === 'past' ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {durationText}
                                    </span>
                                    {status === 'present' && (
                                       <span className="ml-auto flex h-2 w-2 relative">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                       </span>
                                    )}
                                 </div>
                              </div>
                            );
                         })}
                      </div>
                   </div>
                 );
              })}
            </div>
         )}
         
         {viewMode === 'day' && dayGroupedClasses.length === 0 && filteredClasses.length > 0 && (
             <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No classes scheduled for {activeDay}.</p>
             </div>
         )}

         {/* VIEW: WEEK MODE - Compact Grid */}
         {viewMode === 'week' && (
            <div className="space-y-3">
              {availableDays.map(day => {
                 const classesForDay = filteredClasses.filter(c => c.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                 const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                 
                 return (
                    <div key={day} className={`bg-white rounded-xl border p-3 shadow-sm ${isToday ? 'border-indigo-300 ring-1 ring-indigo-50 shadow-indigo-100' : 'border-gray-200'}`}>
                       <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-1">
                          <h4 className={`font-bold text-xs uppercase tracking-wider ${isToday ? 'text-indigo-700' : 'text-gray-500'}`}>{day}</h4>
                          {isToday && <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold tracking-wide">TODAY</span>}
                       </div>
                       
                       <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {classesForDay.map(cls => {
                             const status = getClassStatus(cls);
                             const styles = getStatusStyles(status);

                             return (
                               <div 
                                 key={cls.id} 
                                 onClick={() => openModal(cls)}
                                 className={`rounded-lg p-2 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-all min-h-[56px] border border-gray-100 ${styles}`}
                               >
                                  <span className="font-bold text-xs leading-tight line-clamp-1 text-gray-800">{cls.name}</span>
                                  <span className={`text-[10px] font-bold mt-0.5 ${status === 'past' ? 'text-gray-400' : 'text-gray-500'}`}>{formatTime12H(cls.startTime)}</span>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                 );
              })}
            </div>
         )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up sm:animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                 <Calendar className="text-indigo-600" />
                 {editingId ? 'Edit Class' : 'Add New Class'}
              </h3>
              <div className="flex gap-2">
                 {editingId && (
                   <button onClick={() => { if(confirm('Delete this class?')) { onDeleteClass(editingId); setIsModalOpen(false); } }} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                     <Trash2 size={20} />
                   </button>
                 )}
                 <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                   <X size={20} />
                 </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Class Name / Grade" placeholder="e.g. Grade 10" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <div className="grid grid-cols-2 gap-4">
                <Select label="Day of Week" value={formData.day || 'Monday'} onChange={e => setFormData({...formData, day: e.target.value})}>
                  {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
                <Input label="Start Time" type="time" value={formData.startTime || ''} onChange={e => setFormData({...formData, startTime: e.target.value})} required />
              </div>
              <Select label="Duration" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})}>
                  <option value="60">1 Hour</option>
                  <option value="90">1.5 Hours</option>
                  <option value="120">2 Hours</option>
                  <option value="150">2.5 Hours</option>
                  <option value="180">3 Hours</option>
              </Select>
              <Button type="submit" className="w-full text-lg py-3 mt-2">{editingId ? 'Save Changes' : 'Add Class'}</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetable;
