
import React, { useState, useEffect, useCallback } from 'react';
import {
  HelpCircle,
  Settings,
  FileUp,
  Link as LinkIcon,
  Edit3,
  Send,
  AtSign,
  CheckCircle2,
  CloudUpload,
  User,
  Phone,
  Trash2,
  QrCode,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { io } from 'socket.io-client';

// Automatically detect the server IP based on the browser's URL
const socket = io(`${window.location.protocol}//${window.location.hostname}:3001`);

interface Candidate {
  name: string;
  phone: string;
  status: 'pending' | 'sent' | 'error' | 'sending';
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [groupLink, setGroupLink] = useState('');
  const [countryCode, setCountryCode] = useState('91');
  const [message, setMessage] = useState('Hello [Name], Welcome from First Quad. Please join the below WhatsApp group: [Link]');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  
  const [automationStatus, setAutomationStatus] = useState('DISCONNECTED');
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    socket.on('status', (data) => {
      setAutomationStatus(data.status);
      setQrCode(data.qr || null);
    });

    socket.on('message-sent', (data) => {
      setCandidates(prev => prev.map((c, i) => 
        i === data.index ? { ...c, status: data.status } : c
      ));
    });

    socket.on('bulk-finished', () => {
      setIsSending(false);
      setIsSent(true);
      setTimeout(() => setIsSent(false), 3000);
    });

    return () => {
      socket.off('status');
      socket.off('message-sent');
      socket.off('bulk-finished');
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const allFoundCandidates: Candidate[] = [];

          const isPhone = (val: any) => {
            const digits = String(val || '').replace(/\D/g, '');
            return digits.length >= 10 && digits.length <= 13;
          };

          const isName = (val: any) => {
            const s = String(val || '').trim();
            const lowerS = s.toLowerCase();
            return s.length > 2 && /[a-zA-Z]/.test(s) && !lowerS.includes('name') && !lowerS.includes('student') && !lowerS.includes('contact') && !lowerS.includes('phone') && !lowerS.includes('sr.no');
          };

          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            if (rows.length === 0) return;

            let nameIdx = -1;
            let phoneIdx = -1;

            for (let i = 0; i < Math.min(rows.length, 30); i++) {
              const row = rows[i];
              if (!Array.isArray(row)) continue;
              row.forEach((cell, idx) => {
                const val = String(cell || '').toLowerCase().trim();
                if (nameIdx === -1 && (val.includes('name of the student') || val.includes('student name') || (val.includes('name') && !val.includes('father')))) nameIdx = idx;
                if (phoneIdx === -1 && (val.includes('contact') || val.includes('phone') || val.includes('mobile') || val.includes('no.'))) phoneIdx = idx;
              });
              if (nameIdx !== -1 && phoneIdx !== -1) break;
            }

            rows.forEach((row) => {
              if (!Array.isArray(row)) return;
              let nameCandidate = '';
              let phoneCandidate = '';
              if (nameIdx !== -1 && phoneIdx !== -1) {
                nameCandidate = String(row[nameIdx] || '').trim();
                phoneCandidate = String(row[phoneIdx] || '').replace(/\D/g, '');
                if (nameCandidate.toLowerCase().includes('name') || nameCandidate.toLowerCase().includes('student')) { nameCandidate = ''; phoneCandidate = ''; }
              } else {
                row.forEach(cell => {
                  const cellStr = String(cell || '').trim();
                  if (!cellStr) return;
                  if (!phoneCandidate && isPhone(cellStr)) phoneCandidate = cellStr.replace(/\D/g, '');
                  else if (!nameCandidate && isName(cellStr)) nameCandidate = cellStr;
                });
              }

              if (nameCandidate && phoneCandidate && isPhone(phoneCandidate)) {
                if (phoneCandidate.startsWith('0') && phoneCandidate.length >= 10) phoneCandidate = phoneCandidate.substring(1);
                if (phoneCandidate.length > 10 && phoneCandidate.startsWith('2')) return; 
                if (!allFoundCandidates.find(c => c.phone === phoneCandidate)) {
                  allFoundCandidates.push({ name: nameCandidate, phone: phoneCandidate, status: 'pending' });
                }
              }
            });
          });

          if (allFoundCandidates.length === 0) {
            alert('Could not find any candidates.');
          } else {
            setCandidates(allFoundCandidates);
          }
        } catch (error) {
          alert('Failed to parse Excel file.');
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const startAutomation = () => {
    if (automationStatus !== 'READY') {
      alert('Please scan the QR code to link your WhatsApp first.');
      return;
    }
    if (candidates.length === 0 || !groupLink) {
      alert('Please upload candidates and provide a group link.');
      return;
    }
    setIsSending(true);
    setCandidates(prev => prev.map(c => ({ ...c, status: c.status === 'sent' ? 'sent' : 'sending' })));
    socket.emit('send-bulk', { candidates, message, groupLink, countryCode });
  };

  const disconnectAutomation = () => {
    if (window.confirm('Are you sure you want to disconnect? This will log out your WhatsApp session.')) {
      setAutomationStatus('DISCONNECTED');
      setQrCode(null);
      socket.emit('logout');
    }
  };

  const removeCandidate = (index: number) => {
    setCandidates(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-background border-b border-primary/30 shadow-[0_0_15px_rgba(255,45,120,0.1)] flex justify-between items-center w-full px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <img src="/logo.png" style={{ height: '40px' }} alt="FQTS Logo" />
          <span className="text-xl font-bold text-primary neon-text-glow font-headline tracking-tight">
            WhatsApp Automation System
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant text-[10px] font-bold tracking-widest uppercase">
            <span className={`w-2 h-2 rounded-full ${automationStatus === 'READY' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {automationStatus === 'READY' ? 'System Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-start p-6 sm:p-12 gap-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Left Side: QR Login */}
          <div className="lg:col-span-2 space-y-6">
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-surface-container rounded-xl p-8 neon-border flex flex-col items-center text-center h-full"
            >
              <div className="bg-tertiary/10 p-4 rounded-full border border-tertiary/20 mb-4">
                <QrCode className="text-tertiary" size={32} />
              </div>
              <h2 className="font-headline font-bold text-xl mb-2 text-slate-100 uppercase tracking-wider">Link WhatsApp</h2>
              <p className="text-slate-400 text-xs mb-8">Scan this code with your WhatsApp Link Devices option to start sending silently.</p>
              
              <div className="bg-white p-4 rounded-xl shadow-inner mb-6 relative group overflow-hidden">
                {automationStatus === 'READY' ? (
                  <div className="w-48 h-48 flex flex-col items-center justify-center text-green-600 gap-4">
                    <ShieldCheck size={64} />
                    <span className="text-sm font-bold uppercase tracking-widest">Active Session</span>
                  </div>
                ) : qrCode ? (
                  <img src={qrCode} alt="QR Code" className="w-48 h-48 transition-transform group-hover:scale-105" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-slate-300">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              
              <div className="text-[10px] text-slate-500 uppercase font-label tracking-widest mt-auto">
                {automationStatus === 'QR_RECEIVED' ? 'New QR Generated' : automationStatus === 'READY' ? 'Authenticated' : 'Initializing Puppeteer...'}
              </div>

              {automationStatus === 'READY' && (
                <button 
                  onClick={disconnectAutomation}
                  className="mt-4 text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-[0.2em] underline decoration-red-500/30 underline-offset-4"
                >
                  Disconnect & Relogin
                </button>
              )}
            </motion.section>
          </div>

          {/* Right Side: Setup & Send */}
          <div className="lg:col-span-3 space-y-6">
            {/* Candidate List */}
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-surface-container rounded-xl p-6 neon-border"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded border border-primary/20 text-primary"><FileUp size={20} /></div>
                  <h2 className="font-headline font-bold text-lg">Candidate List</h2>
                </div>
                <input accept=".xlsx, .xls" className="hidden" id="excel-upload" type="file" onChange={handleFileChange} />
                <label htmlFor="excel-upload" className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold px-4 py-2 rounded border border-primary/30 uppercase tracking-widest transition-all">
                  Browse Excel
                </label>
              </div>

              {candidates.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {candidates.map((c, i) => (
                    <div key={i} className={`flex items-center justify-between p-2 rounded border border-outline-variant/30 text-[11px] bg-surface-container-low transition-all ${c.status === 'sending' ? 'border-primary/50 bg-primary/5' : ''}`}>
                      <div className="flex items-center gap-3 truncate">
                        <span className="font-semibold text-slate-200">{c.name}</span>
                        <span className="text-slate-500">{c.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.status === 'sent' && <CheckCircle2 size={14} className="text-secondary" />}
                        {c.status === 'error' && <Trash2 size={14} className="text-red-500" />}
                        {c.status === 'sending' && <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                        <button onClick={() => removeCandidate(i)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 border-2 border-dashed border-outline-variant rounded-lg flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50">
                  <CloudUpload size={24} />
                  <span className="text-[10px] uppercase font-bold tracking-widest">No file uploaded</span>
                </div>
              )}
            </motion.section>

            {/* Config & Send */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface-container rounded-xl p-6 neon-border space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-widest">Group Link</label>
                  <input className="w-full bg-transparent border-b border-outline-variant py-2 text-xs focus:outline-none focus:border-secondary transition-all" value={groupLink} onChange={(e) => setGroupLink(e.target.value)} placeholder="https://..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-outline uppercase font-bold tracking-widest">Country Code</label>
                  <input className="w-full bg-transparent border-b border-outline-variant py-2 text-xs focus:outline-none focus:border-secondary transition-all" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="91" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-outline uppercase font-bold tracking-widest">Invite Message</label>
                <textarea className="w-full bg-background/50 rounded border border-outline-variant p-3 text-xs focus:outline-none focus:border-tertiary transition-all resize-none" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>

              <button
                onClick={startAutomation}
                disabled={isSending || automationStatus !== 'READY' || candidates.length === 0}
                className="w-full bg-surface-container-highest border border-primary/50 text-primary font-bold py-4 rounded-xl uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 neon-button-glow disabled:opacity-20 text-sm"
              >
                {isSending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Automating...
                  </>
                ) : (
                  <>
                    <Zap size={20} className="fill-primary/20" />
                    Start Bulk Send
                  </>
                )}
              </button>
              <p className="text-center text-[9px] text-slate-500 uppercase tracking-widest">Messages are sent from the server. Do not close this browser.</p>
            </motion.section>
          </div>
        </div>
      </main>

      <footer className="bg-background border-t border-secondary/20 py-6 flex flex-col items-center justify-center gap-4 w-full opacity-60">
        <p className="font-label text-[10px] uppercase tracking-widest text-slate-500">
          © 2024 Neon Tokyo Systems. Automated Recruitment Engine v3.0
        </p>
      </footer>
    </div>
  );
}
