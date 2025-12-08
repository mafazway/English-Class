
import React, { useState, useRef } from 'react';
import { CloudConfig } from '../types';
import { Button, Card, Input } from './UIComponents';
import { Cloud, Check, AlertCircle, Save, Database, Copy, ChevronDown, ChevronUp, Wrench, Download, Upload, FileJson, RefreshCw } from 'lucide-react';
import { checkConnection, getSetupSQL } from '../services/cloudService';

interface Props {
  config: CloudConfig;
  onSaveConfig: (config: CloudConfig) => void;
  onSyncNow: () => void;
  lastSyncTime: string | null;
  onBackup: () => void;
  onRestore: (data: any) => void;
}

const CloudSettings: React.FC<Props> = ({ config, onSaveConfig, onSyncNow, lastSyncTime, onBackup, onRestore }) => {
  const [formData, setFormData] = useState(config);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showInstructions, setShowInstructions] = useState(!config.connected);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTestAndSave = async () => {
    setTesting(true);
    const isConnected = await checkConnection(formData);
    setTesting(false);
    
    if (isConnected) {
      setStatus('success');
      onSaveConfig({ ...formData, connected: true });
      setShowInstructions(false); // Auto hide on success
    } else {
      setStatus('error');
    }
  };

  const copySQL = () => {
    navigator.clipboard.writeText(getSetupSQL());
    alert("SQL copied! Paste this in Supabase SQL Editor.");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
         try { 
           const json = JSON.parse(e.target?.result as string); 
           if(window.confirm('WARNING: Restore data? This will merge/overwrite existing Cloud data. Continue?')) {
             onRestore(json); 
           }
         } catch(e){
           alert("Invalid backup file format.");
         }
      };
      reader.readAsText(file);
    }
    // Reset
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="pb-24 space-y-4">
      <div className="flex justify-between items-center mb-4 bg-gray-50/95 sticky top-0 py-2 z-10">
        <h2 className="text-2xl font-bold text-gray-800">Cloud Sync</h2>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3 text-indigo-600 mb-2">
           <Database size={24} />
           <h3 className="font-bold text-lg">Supabase Connection</h3>
        </div>
        
        <Input 
          label="Project URL" 
          placeholder="https://xyz.supabase.co"
          value={formData.url}
          onChange={e => setFormData({...formData, url: e.target.value})}
        />
        
        <div>
          <Input 
            label="API Key (public/anon)" 
            type="password"
            placeholder="eyJhbG..."
            value={formData.key}
            onChange={e => setFormData({...formData, key: e.target.value})}
          />
        </div>

        <div className="flex gap-2 pt-2">
           <Button onClick={handleTestAndSave} disabled={testing} className="flex-1">
              {testing ? 'Connecting...' : 'Connect & Save'}
           </Button>
        </div>

        {status === 'success' && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center gap-2 text-sm animate-fade-in">
             <Check size={16} /> Connected Successfully!
          </div>
        )}
        
        {status === 'error' && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2 text-sm animate-fade-in">
             <AlertCircle size={16} /> Connection Failed. Check credentials.
          </div>
        )}
      </Card>

      {config.connected && (
        <Card className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none shadow-md">
           <h3 className="font-bold mb-2 flex items-center gap-2">
             <Cloud size={20} /> Sync Status
           </h3>
           <p className="text-sm opacity-90 mb-4">
             {lastSyncTime ? `Last synced: ${new Date(lastSyncTime).toLocaleString()}` : 'Not synced yet'}
           </p>
           <button 
             onClick={onSyncNow}
             className="w-full bg-white text-indigo-600 font-bold py-2 rounded-lg hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
           >
             <RefreshCw size={18} /> Sync Cloud Data Now
           </button>
        </Card>
      )}

      {/* Backup & Recovery Section */}
      <Card className="p-4 space-y-4 border-indigo-100 bg-white">
        <div className="flex items-center gap-3 text-gray-800 mb-1">
           <FileJson size={24} className="text-indigo-500" />
           <h3 className="font-bold text-lg">Backup & Recovery</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          <button 
             onClick={onBackup}
             className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors"
          >
             <Download size={18} /> Download Full Backup
          </button>

          <div className="relative">
             <input 
               type="file" 
               ref={fileInputRef}
               onChange={handleFileChange}
               accept=".json"
               className="hidden" 
             />
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="flex items-center justify-center gap-2 w-full py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
             >
               <Upload size={18} /> Restore from Backup File
             </button>
          </div>
        </div>
      </Card>

      {/* Toggle Instructions */}
      <div className="flex justify-center">
        <button 
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-gray-500 text-sm flex items-center gap-1 hover:text-indigo-600"
        >
          {showInstructions ? (
            <>Hide Setup Instructions <ChevronUp size={16} /></>
          ) : (
            <>Show Setup Instructions / Repair Script <ChevronDown size={16} /></>
          )}
        </button>
      </div>

      {showInstructions && (
        <Card className="p-4 bg-gray-50 border-gray-200 animate-fade-in">
           <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
             <Wrench size={18} /> Setup / Repair
           </h4>
           <p className="text-sm text-gray-600 mb-3">
             If you are unable to save data, run this script in your Supabase SQL Editor to fix table columns and permissions.
           </p>
           <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
              <li>Go to <a href="https://supabase.com" target="_blank" className="text-blue-600 underline">supabase.com</a> &gt; SQL Editor.</li>
              <li>Paste the code below and click RUN.</li>
           </ol>
           <button 
             onClick={copySQL}
             className="mt-3 w-full border border-gray-300 bg-white text-gray-700 py-3 rounded-lg text-xs font-mono flex items-center justify-center gap-2 hover:bg-gray-100 font-bold"
           >
             <Copy size={14} /> Copy Repair/Setup Script
           </button>
        </Card>
      )}
    </div>
  );
};

export default CloudSettings;
