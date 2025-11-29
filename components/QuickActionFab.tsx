
import React, { useState } from 'react';
import { Plus, UserPlus, CheckSquare, CreditCard } from 'lucide-react';
import { View } from '../types';

interface Props {
  onNavigate: (view: View) => void;
  onAddStudentClick?: () => void;
}

const QuickActionFab: React.FC<Props> = ({ onNavigate, onAddStudentClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (view: View) => {
    onNavigate(view);
    setIsOpen(false);
  };

  const handleAddStudent = () => {
    if (onAddStudentClick) {
      onAddStudentClick();
    } else {
      onNavigate('students');
    }
    setIsOpen(false);
  };

  const menuItems = [
    { 
      label: 'Add Fee', 
      icon: CreditCard, 
      action: () => handleAction('fees') 
    },
    { 
      label: 'Mark Attend', 
      icon: CheckSquare, 
      action: () => handleAction('attendance') 
    },
    { 
      label: 'Add Student', 
      icon: UserPlus, 
      action: handleAddStudent 
    },
  ];

  return (
    <>
      {/* Backdrop Overlay - Dark & Blurred */}
      <div 
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-4 pointer-events-none">
        {/* Menu Items Container */}
        <div className={`flex flex-col items-end gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          {menuItems.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              {/* Label */}
              <span className="bg-white text-gray-800 text-xs font-bold py-1.5 px-3 rounded-lg shadow-md border border-gray-100 animate-slide-in-right">
                {item.label}
              </span>
              
              {/* Mini Button - Solid Indigo */}
              <button
                onClick={item.action}
                className="w-10 h-10 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-200 border border-indigo-400 flex items-center justify-center active:scale-90 transition-transform hover:bg-indigo-600"
              >
                <item.icon size={18} />
              </button>
            </div>
          ))}
        </div>

        {/* Main Floating Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full shadow-xl shadow-indigo-300 flex items-center justify-center text-white transition-all duration-300 active:scale-95 bg-indigo-600 hover:bg-indigo-700 pointer-events-auto"
        >
          {/* Icon Rotates 45deg to become an X */}
          <Plus 
            size={28} 
            className={`transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-[135deg]' : 'rotate-0'}`}
          />
        </button>
      </div>
    </>
  );
};

export default QuickActionFab;
