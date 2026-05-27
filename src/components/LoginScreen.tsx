import React, { useState } from 'react';
import { Guard, getSpreadsheetId, setSpreadsheetId } from '../utils';
import { Settings, Check, ExternalLink } from 'lucide-react';
import MatrixRain from './MatrixRain';

interface Props {
  guards: Guard[];
  onLogin: (guard: Guard) => void;
}

export default function LoginScreen({ guards, onLogin }: Props) {
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [spreadsheetId, setLocalSpreadsheetId] = useState(getSpreadsheetId());
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const guard = guards.find(g => 
      g.uid.toLowerCase() === uid.toLowerCase().trim() && 
      (g.password || '').toLowerCase() === password.toLowerCase().trim()
    );
    
    if (guard) {
      onLogin(guard);
    } else {
      setError('Invalid UID or Password');
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaveError('');
      const trimmed = spreadsheetId.trim();
      if (!trimmed) {
        setSaveError('Spreadsheet ID cannot be empty');
        return;
      }
      
      const response = await fetch('/api/sheets/save-spreadsheet-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: trimmed })
      });

      if (!response.ok) {
        throw new Error('Failed to save to the central server database. Check your connection.');
      }
      
      setSpreadsheetId(trimmed);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      setSaveError(e.message || 'Failed to save configuration');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans p-6 relative overflow-hidden">
      <MatrixRain color="#FBDF07" opacity={0.12} />
      
      {/* Absolute Header Ticker on Login Screen */}
      <div className="absolute top-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-900 py-2.5 overflow-hidden select-none flex z-10">
        <div className="animate-ticker flex shrink-0 gap-16 min-w-full justify-around pr-16 items-center text-[#FBDF07] font-mono text-[9px] uppercase font-black tracking-widest">
          <span>★ DEVELOPED AND POWERED BY INFINITI</span>
          <span className="text-zinc-700">•</span>
          <span>X GUARD - PATROL TRACKER SYSTEM CONTROL</span>
          <span className="text-zinc-700">•</span>
          <span>ENTER CREDENTIALS TO LOG SITEREP</span>
          <span className="text-zinc-700">•</span>
        </div>
        <div className="animate-ticker flex shrink-0 gap-16 min-w-full justify-around pr-16 items-center text-[#FBDF07] font-mono text-[9px] uppercase font-black tracking-widest" aria-hidden="true">
          <span>★ DEVELOPED AND POWERED BY INFINITI</span>
          <span className="text-zinc-700">•</span>
          <span>X GUARD - PATROL TRACKER SYSTEM CONTROL</span>
          <span className="text-zinc-700">•</span>
          <span>ENTER CREDENTIALS TO LOG SITEREP</span>
          <span className="text-zinc-700">•</span>
        </div>
      </div>

      <div className="mb-8 flex flex-col items-center gap-4 mt-12 relative z-10">
        <img src="https://imgur.com/qMyDS4j.png" alt="X GUARD Logo" className="h-24 object-contain" />
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-center leading-none text-[#FBDF07]">X GUARD - <span className="text-white">PATROL TRACKER</span></h1>
      </div>
      
      <div className="max-w-md w-full bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 p-8 shadow-2xl space-y-6 relative z-10">
        <div className="text-center border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-black tracking-widest text-[#FBDF07] uppercase">System Login</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1 font-bold">Enter operative credentials</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && <div className="bg-red-900/30 border-l-4 border-red-500 text-red-400 text-xs font-bold p-3 uppercase tracking-wider">{error}</div>}
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">UID</label>
            <input 
              type="text" 
              value={uid}
              onChange={e => setUid(e.target.value)}
              className="w-full bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-[#FBDF07] transition-colors font-mono"
              placeholder="e.g. xg591"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-[#FBDF07] transition-colors font-mono"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-[#FBDF07] hover:bg-white text-black font-black text-xs uppercase tracking-[0.2em] py-4 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            Access System
          </button>
        </form>

        <div className="text-center text-[10px] uppercase tracking-widest font-bold text-zinc-600 pt-4 border-t border-zinc-800">
          Authorized personnel only. Activities are monitored.
        </div>
      </div>

      {/* Sheets Config Section at the bottom */}
      <div className="max-w-md w-full bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 p-6 shadow-2xl mt-6 space-y-4 relative z-10">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Settings size={18} className="text-[#FBDF07]" />
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-[#FBDF07]">Tactical Sheets Connection</h4>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Manage central dispatch integration</p>
          </div>
        </div>

        <p className="text-[10px] text-zinc-400 leading-relaxed">
          To support frictionless workflow, security guards do not need personal Google accounts. Registrations and patrol scans are processed dynamically via the centralized secure server.
        </p>

        <div className="bg-zinc-950 border border-zinc-850/60 p-3 flex justify-between items-center">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Central Webhook Gateway</span>
            <span className="text-[10px] text-white font-mono uppercase font-black">Active Connection to secure enterprise dispatch</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-950/40 border border-green-900/60 font-mono text-[9px] font-black text-green-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            CONNECTED
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-zinc-800/60">
          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Setup Instructions</span>
          <ol className="text-[10px] text-zinc-400 space-y-1.5 list-decimal pl-4">
            <li>
              Open the official template:{" "}
              <a 
                href="https://docs.google.com/spreadsheets/d/1MaGvmF9o6Zh9p61ej7AR2MXyv6pZfkOLRtt08KAxpfU/copy" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[#FBDF07] hover:underline font-bold inline-flex items-center gap-0.5"
              >
                Duplicate Template <ExternalLink size={10} />
              </a>
            </li>
            <li>Click &quot;Make a copy&quot; to save a duplicate in your Google Drive.</li>
            <li>Copy your new sheet&apos;s ID from the browser link (the long text code between &quot;/d/&quot; and &quot;/edit&quot;).</li>
            <li>Paste the ID below and click &quot;Save Configuration&quot;.</li>
          </ol>
        </div>

        <div className="space-y-2 pt-2 border-t border-zinc-800/60">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Google Spreadsheet ID</label>
          <div className="flex flex-col gap-2">
            <input 
              type="text"
              value={spreadsheetId}
              onChange={e => setLocalSpreadsheetId(e.target.value)}
              className="w-full bg-black border border-zinc-800 p-3 text-white text-xs font-mono focus:outline-none focus:border-[#FBDF07] transition-colors"
              placeholder="e.g. 1MaGvmF9o6Zh9p61ej7AR2MXyv6pZfkOLRtt..."
            />
            
            {saveError && (
              <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">{saveError}</span>
            )}

            <button 
              type="button"
              onClick={handleSaveConfig}
              className="w-full bg-zinc-800 hover:bg-[#FBDF07] hover:text-black text-white font-black text-[10px] uppercase tracking-widest py-3 transition-colors flex items-center justify-center gap-2 cursor-pointer border border-zinc-700/50"
            >
              {isSaved ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  Configuration Saved! Reloading Whitelist...
                </>
              ) : (
                'Save Configuration'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
