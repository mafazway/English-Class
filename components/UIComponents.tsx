
import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 overflow-hidden ${className}`} {...props}>
    {children}
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ 
  children, 
  className = '', 
  variant = 'primary', 
  ...props 
}) => {
  const baseStyles = "px-5 py-3.5 rounded-2xl font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm tracking-wide";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 border border-transparent",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    ghost: "bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="mb-5 group">
    {label && <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-indigo-600">{label}</label>}
    <input 
      className={`w-full px-4 py-3.5 rounded-2xl border border-transparent bg-gray-50/80 focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-gray-800 placeholder-gray-400 font-medium ${className}`}
      {...props} 
    />
  </div>
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="mb-5 group">
    {label && <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-indigo-600">{label}</label>}
    <textarea 
      className={`w-full px-4 py-3.5 rounded-2xl border border-transparent bg-gray-50/80 focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-gray-800 placeholder-gray-400 font-medium ${className}`}
      {...props} 
    />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...props }) => (
  <div className="mb-5 group">
    {label && <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-indigo-600">{label}</label>}
    <div className="relative">
      <select 
        className={`w-full px-4 py-3.5 rounded-2xl border border-transparent bg-gray-50/80 focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-gray-800 font-medium appearance-none ${className}`}
        {...props} 
      >
        {children}
      </select>
      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    </div>
  </div>
);
