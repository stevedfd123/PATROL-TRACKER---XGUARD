import React, { useState, useEffect } from 'react';
import { getSpreadsheetId, setSpreadsheetId, DEFAULT_SPREADSHEET_ID } from '../api';
import { Settings, X, Database, Check, History, ExternalLink, HelpCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SheetsSettingsModal({ isOpen, onClose }: Props) {
  const [sheetId, setSheetId] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSheetId(getSpreadsheetId());
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSpreadsheetId(sheetId.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
      window.location.reload();
    }, 1500);
  };

  const handleReset = () => {
    if (window.confirm('Reset Google Sheets configuration to the default global database?')) {
      setSpreadsheetId(DEFAULT_SPREADSHEET_ID);
      setSheetId(DEFAULT_SPREADSHEET_ID);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 shadow-[0_0_50px_rgba(251,223,7,0.15)] flex flex-col relative overflow-hidden">
        {/* Yellow top bar detail */}
        <div className="h-1 bg-[#FBDF07] w-full"></div>

        {/* Modal Header */}
        <div className="p-4 md:p-6 border-b border-zinc-800 bg-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="text-[#FBDF07] w-5 h-5" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Google Sheets Config</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1 hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto w-full">
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-widest text-[#FBDF07]">Tactical Sheets Connection</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              To support frictionless workflow, security guards do not need personal Google accounts. Registrations and patrol scans are processed dynamically via the centralized secure server.
            </p>
          </div>

          {/* Connection Info Panel */}
          <div className="border border-zinc-800 bg-black/60 p-4 space-y-2 rounded-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-white">Central Webhook Gateway</h4>
                <p className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wider leading-relaxed">
                  Active connection to secure enterprise dispatch.
                </p>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase shrink-0">
                <span className="text-green-500 bg-green-500/15 px-2.5 py-1 rounded-sm border border-green-500/35 flex items-center gap-1.5 font-sans font-bold">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                  CONNECTED
                </span>
              </div>
            </div>
          </div>

          {/* Setup steps */}
          <div className="bg-black/40 border border-zinc-800 p-4 space-y-3 font-mono text-[11px] text-zinc-400">
            <div className="text-white font-black tracking-wider border-b border-zinc-800 pb-2 mb-2 flex items-center justify-between uppercase">
              <span>Setup Instructions</span>
              <HelpCircle size={14} className="text-[#FBDF07]" />
            </div>
            <div className="space-y-2">
              <p className="flex items-start gap-2">
                <span className="text-[#FBDF07] font-black">1_</span>
                <span>
                  Open the official template:{' '}
                  <a 
                    href="https://docs.google.com/spreadsheets/d/1MaGvmF9o6Zh9p61ej7AR2MXyv6pZfkOLRtt08KAxpfU/copy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#FBDF07] hover:underline font-bold inline-flex items-center gap-1"
                  >
                    Duplicate Template <ExternalLink size={10} />
                  </a>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-[#FBDF07] font-black">2_</span>
                <span>Click <strong>"Make a copy"</strong> to save a duplicate in your Google Drive.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-[#FBDF07] font-black">3_</span>
                <span>Copy your new sheet's ID from the browser link (the long text code between "/d/" and "/edit").</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-[#FBDF07] font-black">4_</span>
                <span>Paste the ID below and click <strong>"Save Configuration"</strong>.</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#FBDF07]">
                Google Spreadsheet ID
              </label>
              <input 
                type="text"
                value={sheetId}
                onChange={e => setSheetId(e.target.value)}
                className="w-full bg-black border border-zinc-800 p-3.5 text-xs text-white focus:outline-none focus:border-[#FBDF07] font-mono leading-none"
                placeholder="Paste Spreadsheet ID (Long character string)"
                required
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isSaved}
                className="flex-1 bg-[#FBDF07] text-black hover:bg-white transition-colors py-3.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer disabled:bg-green-500 disabled:text-white"
              >
                {isSaved ? (
                  <>
                    <Check size={14} /> ID Saved & Loaded!
                  </>
                ) : (
                  <>
                    <Check size={14} /> Save Configuration
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={sheetId === DEFAULT_SPREADSHEET_ID}
                className="px-4 border border-zinc-700 text-zinc-400 hover:text-white hover:border-white transition-colors text-xs font-bold uppercase tracking-wider py-3.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30 disabled:hover:text-zinc-400 disabled:hover:border-zinc-700"
              >
                <History size={14} /> Reset Default
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
