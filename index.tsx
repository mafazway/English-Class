import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Toaster } from 'react-hot-toast';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Error Boundary to catch runtime crashes
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly declare state property to satisfy TypeScript strict checks
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any): ErrorBoundaryState { 
    return { hasError: true, error }; 
  }
  
  componentDidCatch(error: any, info: any) { 
    console.error("Critical App Crash:", error, info); 
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center font-sans">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Something went wrong</h1>
            <p className="text-gray-500 mb-4 text-sm">The application encountered a critical error.</p>
            
            <div className="bg-red-50 text-red-800 p-3 rounded-lg text-left text-xs font-mono mb-6 overflow-auto max-h-32 border border-red-100">
              {this.state.error?.message || "Unknown Error"}
            </div>

            <button 
              onClick={() => window.location.reload()} 
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Register Service Worker manually for Vercel/PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Toaster position="top-center" />
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);