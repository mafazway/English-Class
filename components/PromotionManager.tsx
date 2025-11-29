
import React from 'react';
import { ArrowRight, AlertTriangle, CheckCircle, GraduationCap } from 'lucide-react';
import { Button } from './UIComponents';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  year: number;
}

const PromotionManager: React.FC<Props> = ({ isOpen, onClose, onConfirm, year }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border-t-4 border-indigo-600 animate-scale-in">
        
        <div className="flex items-start gap-4 mb-4">
          <div className="bg-indigo-100 p-3 rounded-full">
            <GraduationCap size={32} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Year-End Promotion</h2>
            <p className="text-sm text-gray-500 font-medium">Academic Year {year} &rarr; {year + 1}</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6 text-sm text-gray-700 space-y-3">
          <p>
            It looks like the end of the year! Do you want to automatically promote all students to their next grade?
          </p>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
               <ArrowRight size={14} className="text-indigo-500" />
               <span>Numerical grades (e.g. <strong>5</strong>) will increase by 1.</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
               <ArrowRight size={14} className="text-indigo-500" />
               <span>Grade <strong>11</strong> will become <strong>Completed/Alumni</strong>.</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
               <ArrowRight size={14} className="text-indigo-500" />
               <span>Text grades (e.g. "Spoken") will remain unchanged.</span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-yellow-50 text-yellow-800 p-3 rounded-lg text-xs mb-6 border border-yellow-100">
           <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
           <p>This action updates student profiles permanently. Please make sure you have backed up your data first.</p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50"
          >
            Not Now
          </button>
          <Button 
            onClick={onConfirm} 
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
          >
            Start Promotion
          </Button>
        </div>

      </div>
    </div>
  );
};

export default PromotionManager;
