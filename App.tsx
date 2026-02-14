
import React, { useState, useEffect, useCallback } from 'react';
import { ServiceType, Transaction, XeroxTask, AppNotification, BankingRequest, User } from './types';
import { MAJOR_INDIAN_BANKS } from './constants';

// Extend User interface locally for Wallet functionality
interface WalletUser extends User {
  walletBalance: number;
}

const App: React.FC = () => {
  // Auth & Role States
  const [role, setRole] = useState<'Merchant' | 'Customer' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<WalletUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Home');
  
  // Automation State (Merchant Only)
  const [isAutoPilot, setIsAutoPilot] = useState<boolean>(() => {
    return localStorage.getItem('laddu_autopilot') === 'true';
  });
  
  // Banking Selection State for Hub
  const [bankingSubTab, setBankingSubTab] = useState<'Menu' | 'UPI' | 'Bank' | 'AEPS' | 'CC'>('Menu');
  
  // Verification States (Merchant Control)
  const [verifyingRequest, setVerifyingRequest] = useState<BankingRequest | null>(null);
  const [verifyingUser, setVerifyingUser] = useState<WalletUser | null>(null);

  // Data State
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cspRequests, setCspRequests] = useState<BankingRequest[]>([]); 
  const [serviceQueue, setServiceQueue] = useState<XeroxTask[]>([]);
  
  // UI State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [signupForm, setSignupForm] = useState({ phone: '', name: '', password: '', confirmPassword: '', address: '', email: '' });
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Xerox Form State (Customer)
  const [xeroxForm, setXeroxForm] = useState<{
    service: XeroxTask['service'];
    variant: XeroxTask['variant'];
    quantity: number;
    paperSize: XeroxTask['paperSize'];
    sides: XeroxTask['sides'];
    fileName: string;
  }>({
    service: 'Xerox',
    variant: 'BW',
    quantity: 1,
    paperSize: 'A4',
    sides: 'Single',
    fileName: ''
  });

  // Initial Data Loading
  useEffect(() => {
    const load = (key: string, setter: (val: any) => void) => {
      const saved = localStorage.getItem('laddu_' + key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (key === 'users') {
          setter(parsed.map((u: any) => ({ ...u, walletBalance: u.walletBalance || 0 })));
        } else {
          setter(parsed);
        }
      }
    };
    load('users', setUsers);
    load('transactions', setTransactions);
    load('csp_requests', setCspRequests);
    load('service_queue', setServiceQueue);
    
    const savedAuth = localStorage.getItem('laddu_auth_user');
    if (savedAuth) {
      const user = JSON.parse(savedAuth);
      const fullUser = { ...user, walletBalance: user.walletBalance || 0 };
      setCurrentUser(fullUser);
      setIsLoggedIn(true);
      setRole(user.role);
    }
  }, []);

  // Persistence Sync
  useEffect(() => {
    localStorage.setItem('laddu_users', JSON.stringify(users));
    localStorage.setItem('laddu_transactions', JSON.stringify(transactions));
    localStorage.setItem('laddu_csp_requests', JSON.stringify(cspRequests));
    localStorage.setItem('laddu_service_queue', JSON.stringify(serviceQueue));
    localStorage.setItem('laddu_autopilot', String(isAutoPilot));
    if (currentUser) {
      localStorage.setItem('laddu_auth_user', JSON.stringify(currentUser));
    }
  }, [users, transactions, cspRequests, serviceQueue, currentUser, isAutoPilot]);

  const addNotification = useCallback((message: string, type: AppNotification['type'] = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // WhatsApp Helper
  const sendWhatsApp = (phone: string, message: string) => {
    // Standard Indian prefix if 10 digits
    const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // AUTOMATION ENGINE: Background Processor
  useEffect(() => {
    if (!isAutoPilot) return;

    const interval = setInterval(() => {
      // 1. Auto-approve pending users
      const pendingUsers = users.filter(u => u.status === 'pending');
      if (pendingUsers.length > 0) {
        setUsers(prev => prev.map(u => u.status === 'pending' ? { ...u, status: 'approved' } : u));
        addNotification(`AUTO-PILOT: Approved ${pendingUsers.length} node signals`, "success");
      }

      // 2. Auto-settle queued banking requests
      const queuedCsp = cspRequests.filter(r => r.status === 'Queued');
      if (queuedCsp.length > 0) {
        queuedCsp.forEach(req => {
          const tx: Transaction = {
            id: `TX-AUTO-${Date.now()}`,
            timestamp: Date.now(),
            type: ServiceType.CSP,
            description: `Auto-Settle: ${req.type} - Client: ${req.customerName}`,
            amount: req.amount,
            fee: req.fee,
            category: 'Banking',
            bankName: req.bankName,
            paymentMethod: req.type === 'CreditCard' ? 'Credit Card' : 'Bank Transfer',
            status: 'Paid'
          };
          setTransactions(prev => [tx, ...prev]);
        });
        setCspRequests(prev => prev.map(r => r.status === 'Queued' ? { ...r, status: 'Completed' } : r));
        addNotification(`AUTO-PILOT: Settled ${queuedCsp.length} banking signals`, "success");
      }

      // 3. Auto-progress Xerox tasks
      setServiceQueue(prev => prev.map(task => {
        if (task.status === 'Waiting') return { ...task, status: 'Processing' };
        if (task.status === 'Processing') return { ...task, status: 'Ready' };
        if (task.status === 'Ready') {
            const tx: Transaction = {
                id: `TX-AUTO-${Date.now()}`,
                timestamp: Date.now(),
                type: ServiceType.XEROX,
                description: `Auto-Xerox: ${task.service} - ${task.customerName}`,
                amount: task.total,
                category: 'Xerox',
                paymentMethod: 'Cash',
                status: 'Paid'
            };
            setTransactions(pTx => [tx, ...pTx]);
            return { ...task, status: 'Delivered', paymentStatus: 'Paid' };
        }
        return task;
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPilot, users, cspRequests, serviceQueue]);

  // Authentication & Approval Logic
  const handleLogin = () => {
    if (!loginForm.phone || !loginForm.password) {
      return addNotification("PHONE AND PIN REQUIRED", "error");
    }

    if (role === 'Merchant') {
      if (loginForm.phone === '7799297100' && loginForm.password === '7799297100') {
        const merchantUser: WalletUser = { 
          phone: '7799297100', name: 'LADDU PRO', password: '7799297100', role: 'Merchant', status: 'approved', createdAt: Date.now(), walletBalance: 0
        };
        setIsLoggedIn(true);
        setCurrentUser(merchantUser);
        addNotification("PRO TERMINAL CONNECTED", "success");
        setActiveTab('Home');
        return;
      } else {
        return addNotification("INVALID PRO CREDENTIALS", "error");
      }
    }

    if (role === 'Customer') {
      const user = users.find(u => u.phone === loginForm.phone);
      if (!user) return addNotification("NODE NOT FOUND. PLEASE REGISTER.", "error");
      if (user.password !== loginForm.password) return addNotification("INCORRECT SECURITY PIN", "error");
      if (user.status === 'pending') return addNotification("HUB SECURITY: PENDING PRO APPROVAL", "warning");
      if (user.status === 'rejected') return addNotification("ACCESS DENIED: NODE TERMINATED", "error");
      
      setIsLoggedIn(true);
      setCurrentUser(user);
      addNotification(`HUB CONNECTED: WELCOME ${user.name}`, "success");
      setActiveTab('Home');
    }
  };

  const handleSignUp = () => {
    const { phone, name, password, confirmPassword, address, email } = signupForm;

    if (!phone || !name || !password || !address) {
      return addNotification("NAME, PHONE, PIN AND ADDRESS ARE MANDATORY", "error");
    }

    if (phone.length < 10) {
      return addNotification("INVALID PHONE NUMBER FORMAT", "error");
    }

    if (password !== confirmPassword) {
      return addNotification("SECURITY PINS DO NOT MATCH", "error");
    }

    if (password.length < 4) {
      return addNotification("PIN MUST BE AT LEAST 4 DIGITS", "error");
    }

    if (users.some(u => u.phone === phone)) {
      return addNotification("PHONE NUMBER ALREADY REGISTERED", "error");
    }
    
    const status = isAutoPilot ? 'approved' : 'pending';
    const newUser: WalletUser = { 
      phone, 
      name, 
      password, 
      address, 
      email, 
      status, 
      role: 'Customer', 
      createdAt: Date.now(), 
      walletBalance: 0 
    };

    setUsers(prev => [...prev, newUser]);
    setIsSigningUp(false);
    setSignupForm({ phone: '', name: '', password: '', confirmPassword: '', address: '', email: '' });
    
    if (status === 'approved') {
        addNotification("HUB SIGNAL ACTIVATED IMMEDIATELY (AUTO-PILOT)", "success");
    } else {
        addNotification("KYC DATA TRANSMITTED. AWAIT PRO APPROVAL.", "info");
    }
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setRole(null);
    localStorage.removeItem('laddu_auth_user');
    addNotification("SESSION TERMINATED", "info");
  };

  // Xerox & Printing Logic
  const calculateXeroxTotal = (variant: string, quantity: number, paperSize: string) => {
    let rate = variant === 'BW' ? 2 : 10;
    if (paperSize === 'Legal') rate += 1;
    return rate * quantity;
  };

  const submitXerox = () => {
    if (xeroxForm.quantity <= 0) return addNotification("INVALID QUANTITY", "error");
    const rate = xeroxForm.variant === 'BW' ? 2 : 10;
    const total = calculateXeroxTotal(xeroxForm.variant, xeroxForm.quantity, xeroxForm.paperSize);

    const newTask: XeroxTask = {
      id: `XRX-${Date.now()}`,
      timestamp: Date.now(),
      customerName: currentUser?.name || 'Unknown',
      customerPhone: currentUser?.phone,
      service: xeroxForm.service,
      variant: xeroxForm.variant,
      quantity: xeroxForm.quantity,
      paperSize: xeroxForm.paperSize,
      sides: xeroxForm.sides,
      paperType: 'Standard',
      finishing: 'None',
      deadline: 'ASAP',
      isPriority: false,
      rate,
      total,
      status: 'Waiting',
      paymentStatus: 'Unpaid',
      fileName: xeroxForm.fileName || 'document.pdf'
    };

    setServiceQueue(prev => [newTask, ...prev]);
    addNotification("XEROX SIGNAL TRANSMITTED", "success");
    setActiveTab('Home');
  };

  const updateXeroxStatus = (id: string, status: XeroxTask['status']) => {
    const task = serviceQueue.find(t => t.id === id);
    if (!task) return;

    if (status === 'Delivered') {
      const tx: Transaction = {
        id: `TX-${Date.now()}`,
        timestamp: Date.now(),
        type: ServiceType.XEROX,
        description: `${task.service} (${task.variant}) - ${task.customerName}`,
        amount: task.total,
        category: 'Xerox',
        paymentMethod: 'Cash',
        status: 'Paid'
      };
      setTransactions(prev => [tx, ...prev]);
    }

    setServiceQueue(prev => prev.map(t => t.id === id ? { ...t, status, paymentStatus: status === 'Delivered' ? 'Paid' : t.paymentStatus } : t));
    addNotification(`TASK ${status.toUpperCase()}`, "success");
    
    // Auto WhatsApp Notify for Critical Stages
    if (status === 'Ready') {
      const msg = `Hello ${task.customerName}, your ${task.service} task (${task.fileName}) is READY for pickup at Laddu Store. Amount: ₹${task.total}. Thank you!`;
      if (task.customerPhone) sendWhatsApp(task.customerPhone, msg);
    }
  };

  // Banking Logic
  const submitBanking = (type: BankingRequest['type'], amount: number, bankName?: string, targetId?: string) => {
    if (!amount || amount <= 0) return addNotification("INVALID AMOUNT", "error");
    const feeRate = type === 'CreditCard' ? 0.02 : 0.01;
    const fee = amount * feeRate;
    const netAmount = amount + fee;

    const newRequest: BankingRequest = {
      id: `BR-${Date.now()}`,
      timestamp: Date.now(),
      customerName: currentUser?.name || 'Unknown Node',
      type,
      amount,
      fee,
      netAmount,
      bankName,
      targetId,
      status: 'Queued'
    };

    setCspRequests(prev => [newRequest, ...prev]);
    setBankingSubTab('Menu');
    addNotification("BANKING SIGNAL TRANSMITTED", "success");
  };

  const handleUserApproval = (phone: string, status: 'approved' | 'rejected') => {
    const user = users.find(u => u.phone === phone);
    setUsers(prev => prev.map(u => u.phone === phone ? { ...u, status } : u));
    setVerifyingUser(null);
    addNotification(`NODE ${phone} ${status.toUpperCase()}`, status === 'approved' ? 'success' : 'warning');
    
    if (status === 'approved' && user) {
      const msg = `Hello ${user.name}, welcome to Laddu Store Digital Hub! Your KYC has been approved. You can now login and access all online services.`;
      sendWhatsApp(phone, msg);
    }
  };

  const processBankingRequest = (id: string, action: 'Approved' | 'Rejected') => {
    const req = cspRequests.find(r => r.id === id);
    if (!req) return;
    if (action === 'Approved') {
      const tx: Transaction = {
        id: `TX-${Date.now()}`,
        timestamp: Date.now(),
        type: ServiceType.CSP,
        description: `Banking: ${req.type} - Client: ${req.customerName}`,
        amount: req.amount,
        fee: req.fee,
        category: 'Banking',
        bankName: req.bankName,
        paymentMethod: req.type === 'CreditCard' ? 'Credit Card' : 'Bank Transfer',
        status: 'Paid'
      };
      setTransactions(prev => [tx, ...prev]);
    }
    setCspRequests(prev => prev.map(r => r.id === id ? { ...r, status: action === 'Approved' ? 'Completed' : 'Rejected' } : r));
    setVerifyingRequest(null);
    addNotification(`BANK SIGNAL ${action}`, action === 'Approved' ? "success" : "warning");

    // Optional manual notification via icon in the list
  };

  const SidebarItem = ({ id, label, icon }: { id: string, label: string, icon: string }) => (
    <button onClick={() => { setActiveTab(id); if(id==='BankingHub') setBankingSubTab('Menu'); }} className={`kiosk-sidebar-item flex items-center justify-between w-full text-left transition-all ${activeTab === id ? 'active bg-blue-50 border-l-4 border-blue-600' : ''}`}>
      <div className="flex items-center gap-3">
        <i className={`fa-solid ${icon} w-5 ${activeTab === id ? 'text-blue-600' : 'text-gray-400'}`}></i>
        <span className={activeTab === id ? 'font-bold text-blue-800' : ''}>{label}</span>
      </div>
    </button>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#f0f4f8]">
        <div className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 animate-enter">
          <div className="text-center mb-10">
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-white text-5xl mx-auto mb-6 shadow-xl ${role === 'Merchant' ? 'bg-[#0038a8]' : 'bg-cyan-600'}`}>
              <i className={`fa-solid ${role === 'Merchant' ? 'fa-shield-halved' : 'fa-house-signal'}`}></i>
            </div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">
              {role === null ? 'TERMINAL ACCESS' : role === 'Merchant' ? 'LADDU PRO' : 'LADDU HUB'}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Secure Node Authentication</p>
          </div>

          {role === null ? (
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => setRole('Merchant')} className="p-8 bg-[#0038a8] text-white rounded-[2rem] flex flex-col items-center gap-2 hover:scale-105 transition-all shadow-lg">
                <i className="fa-solid fa-user-tie text-2xl"></i>
                <span className="font-bold uppercase tracking-widest text-xs">Merchant Console</span>
              </button>
              <button onClick={() => setRole('Customer')} className="p-8 bg-cyan-600 text-white rounded-[2rem] flex flex-col items-center gap-2 hover:scale-105 transition-all shadow-lg">
                <i className="fa-solid fa-users text-2xl"></i>
                <span className="font-bold uppercase tracking-widest text-xs">Customer Hub</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {!isSigningUp ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Phone Number</label>
                    <input className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-center focus:border-blue-600 outline-none transition-all" placeholder="Enter Mobile" value={loginForm.phone} onChange={e => setLoginForm({...loginForm, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Security PIN</label>
                    <input type="password" className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-center focus:border-blue-600 outline-none transition-all" placeholder="••••" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
                  </div>
                  <button onClick={handleLogin} className={`w-full py-5 text-white font-black uppercase text-sm rounded-2xl shadow-xl transition-all active:scale-95 ${role === 'Merchant' ? 'bg-[#0038a8]' : 'bg-cyan-600'}`}>Verify Node</button>
                  <div className="flex justify-between mt-8 px-2">
                    {role === 'Customer' && <button onClick={() => setIsSigningUp(true)} className="text-[10px] font-black text-cyan-600 uppercase hover:underline">Request Hub Access (KYC)</button>}
                    <button onClick={() => setRole(null)} className="text-[10px] font-black text-slate-400 uppercase hover:underline">Back</button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-emerald-600 uppercase text-center mb-4 tracking-widest">Complete Official KYC Registration</p>
                  <input className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="Full Legal Name" value={signupForm.name} onChange={e => setSignupForm({...signupForm, name: e.target.value})} />
                  <input className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="10-Digit Mobile" value={signupForm.phone} onChange={e => setSignupForm({...signupForm, phone: e.target.value})} />
                  <input className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="Email (Optional)" value={signupForm.email} onChange={e => setSignupForm({...signupForm, email: e.target.value})} />
                  <textarea className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="Full Postal Address" rows={2} value={signupForm.address} onChange={e => setSignupForm({...signupForm, address: e.target.value})} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="password" maxlength={6} className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="Set PIN" value={signupForm.password} onChange={e => setSignupForm({...signupForm, password: e.target.value})} />
                    <input type="password" maxlength={6} className="w-full p-4 bg-slate-50 border rounded-xl font-bold text-sm" placeholder="Confirm PIN" value={signupForm.confirmPassword} onChange={e => setSignupForm({...signupForm, confirmPassword: e.target.value})} />
                  </div>
                  <button onClick={handleSignUp} className="w-full py-5 bg-emerald-600 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-lg mt-4">Transmit KYC Request</button>
                  <button onClick={() => setIsSigningUp(false)} className="w-full text-[10px] font-black text-slate-400 uppercase text-center mt-4">Back to Login</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7fa]">
      <header className="kiosk-header h-16 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('Home')} className="bg-white/20 p-2 rounded-xl text-white hover:bg-white/30 transition-all shadow-inner">
            <i className="fa-solid fa-house"></i>
          </button>
          <h1 className="text-white font-black tracking-tighter text-xl">LADDU <span className="text-blue-200">{role === 'Merchant' ? 'PRO' : 'HUB'}</span></h1>
        </div>
        <div className="flex items-center gap-4">
           {role === 'Merchant' && (
             <button 
                onClick={() => setIsAutoPilot(!isAutoPilot)} 
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/20 transition-all ${isAutoPilot ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-white/60'}`}
             >
               <i className={`fa-solid ${isAutoPilot ? 'fa-robot animate-bounce' : 'fa-hand'}`}></i>
               <span className="text-[10px] font-black uppercase tracking-widest">{isAutoPilot ? 'Auto-Pilot Active' : 'Manual Mode'}</span>
             </button>
           )}
           {role === 'Customer' && (
             <div className="hidden sm:flex bg-white/20 px-4 py-1.5 rounded-full backdrop-blur-md items-center gap-2 border border-white/10">
               <span className="text-[10px] text-white font-bold uppercase tracking-wider">Node Active</span>
               <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_#4ade80]"></div>
             </div>
           )}
           <button onClick={handleSignOut} className="text-white/80 hover:text-white transform hover:rotate-180 transition-all ml-2"><i className="fa-solid fa-power-off text-lg"></i></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 kiosk-sidebar hidden lg:flex flex-col shadow-xl z-40 bg-white">
          <div className="p-6 space-y-1">
            <SidebarItem id="Home" label="Dashboard" icon="fa-house" />
            {role === 'Merchant' ? (
              <>
                <SidebarItem id="Approvals" label="Node Approvals" icon="fa-tower-broadcast" />
                <SidebarItem id="XeroxManager" label="Xerox Terminal" icon="fa-print" />
                <SidebarItem id="BankingManager" label="Banking Link" icon="fa-indian-rupee-sign" />
                <SidebarItem id="History" label="Master Ledger" icon="fa-book" />
              </>
            ) : (
              <>
                <SidebarItem id="BankingHub" label="Banking Hub" icon="fa-building-columns" />
                <SidebarItem id="XeroxHub" label="Xerox & Print" icon="fa-print" />
                <SidebarItem id="Wallet" label="My Logbook" icon="fa-satellite" />
                <SidebarItem id="Profile" label="Node Settings" icon="fa-id-badge" />
              </>
            )}
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar">
          {activeTab === 'Home' && (
            <div className="max-w-6xl mx-auto animate-enter">
              <div className={`w-full h-48 rounded-[3rem] p-10 text-white mb-10 relative overflow-hidden shadow-2xl ${role === 'Merchant' ? 'bg-[#0038a8]' : 'bg-cyan-600'}`}>
                <div className="relative z-10">
                  <h2 className="text-4xl font-black uppercase tracking-tighter">NODE: {currentUser?.name}</h2>
                  <p className="opacity-70 mt-2 font-bold uppercase tracking-widest text-[10px] tracking-[0.5em]">
                    Terminal Secured • {isAutoPilot && role === 'Merchant' ? 'Auto-Pilot Array Online' : 'Operational Channel Active'}
                  </p>
                </div>
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-[80px]"></div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                <div onClick={() => setActiveTab(role === 'Merchant' ? 'Approvals' : 'BankingHub')} className="kiosk-card group border-slate-100">
                  <div className="w-20 h-20 rounded-[2rem] bg-blue-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <i className={`fa-solid ${role === 'Merchant' ? 'fa-tower-broadcast' : 'fa-building-columns'} text-3xl text-blue-600`}></i>
                  </div>
                  <span>{role === 'Merchant' ? 'Approvals' : 'Banking Hub'}</span>
                </div>
                <div onClick={() => setActiveTab(role === 'Merchant' ? 'XeroxManager' : 'XeroxHub')} className="kiosk-card group border-slate-100">
                  <div className="w-20 h-20 rounded-[2rem] bg-orange-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-print text-3xl text-orange-500"></i>
                  </div>
                  <span>{role === 'Merchant' ? 'Xerox' : 'Xerox / Print'}</span>
                </div>
                <div onClick={() => setActiveTab(role === 'Merchant' ? 'History' : 'Wallet')} className="kiosk-card group border-slate-100">
                  <div className="w-20 h-20 rounded-[2rem] bg-indigo-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <i className={`fa-solid ${role === 'Merchant' ? 'fa-book' : 'fa-satellite'} text-3xl text-indigo-600`}></i>
                  </div>
                  <span>{role === 'Merchant' ? 'Ledger' : 'My Logbook'}</span>
                </div>
                <div onClick={() => setActiveTab('Profile')} className="kiosk-card group border-slate-100">
                  <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-id-badge text-3xl text-emerald-600"></i>
                  </div>
                  <span>Node Settings</span>
                </div>
              </div>
            </div>
          )}

          {/* XEROX HUB (Customer) */}
          {activeTab === 'XeroxHub' && role === 'Customer' && (
            <div className="max-w-4xl mx-auto animate-enter">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 h-fit">
                   <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800 mb-8">New Request</h2>
                   <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Service</label>
                           <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" value={xeroxForm.service} onChange={e => setXeroxForm({...xeroxForm, service: e.target.value as any})}>
                             <option value="Xerox">Xerox</option>
                             <option value="Print">Print</option>
                             <option value="Scan">Scan</option>
                             <option value="Lamination">Lamination</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Variant</label>
                           <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" value={xeroxForm.variant} onChange={e => setXeroxForm({...xeroxForm, variant: e.target.value as any})}>
                             <option value="BW">Black & White (₹2)</option>
                             <option value="Color">Color (₹10)</option>
                           </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Size</label>
                           <select className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" value={xeroxForm.paperSize} onChange={e => setXeroxForm({...xeroxForm, paperSize: e.target.value as any})}>
                             <option value="A4">A4</option>
                             <option value="Legal">Legal (+₹1)</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Quantity</label>
                           <input type="number" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" value={xeroxForm.quantity} onChange={e => setXeroxForm({...xeroxForm, quantity: Number(e.target.value)})} />
                        </div>
                      </div>

                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Document Name</label>
                         <input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" placeholder="e.g. MyCertificate.pdf" value={xeroxForm.fileName} onChange={e => setXeroxForm({...xeroxForm, fileName: e.target.value})} />
                      </div>

                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center">
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase">Estimated Total</p>
                            <p className="text-3xl font-black text-slate-800">₹{calculateXeroxTotal(xeroxForm.variant, xeroxForm.quantity, xeroxForm.paperSize)}</p>
                         </div>
                         <button onClick={submitXerox} className="px-10 py-4 bg-orange-500 text-white font-black uppercase text-xs rounded-2xl shadow-lg hover:bg-orange-600 transition-all">Submit Task</button>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-3">
                     <i className="fa-solid fa-list-check text-orange-500"></i>
                     Your Tasks
                   </h3>
                   <div className="space-y-4">
                      {serviceQueue.filter(t => t.customerPhone === currentUser?.phone).map(t => (
                        <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-orange-200 transition-all">
                           <div>
                              <p className="font-black text-slate-800 uppercase text-sm leading-none mb-2">{t.service} - {t.quantity} Units</p>
                              <div className="flex gap-2">
                                <span className="text-[8px] font-black uppercase px-2 py-1 bg-slate-50 text-slate-400 rounded-full">{t.paperSize}</span>
                                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${t.variant === 'Color' ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-600'}`}>{t.variant}</span>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-xs font-black text-slate-900 mb-1">₹{t.total}</p>
                              <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${
                                t.status === 'Ready' ? 'bg-emerald-100 text-emerald-700' : 
                                t.status === 'Processing' ? 'bg-blue-100 text-blue-700' : 
                                t.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600' :
                                'bg-slate-100 text-slate-400'
                              }`}>{t.status}</span>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* XEROX MANAGER (Merchant) */}
          {activeTab === 'XeroxManager' && role === 'Merchant' && (
            <div className="max-w-5xl mx-auto animate-enter">
              <div className="flex items-center justify-between mb-10">
                 <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-800">Xerox Terminal</h2>
                 <div className="bg-white px-6 py-2 rounded-2xl border flex items-center gap-3 shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${isAutoPilot ? 'bg-emerald-500 animate-ping' : 'bg-orange-500 animate-pulse'}`}></div>
                    <span className="text-[10px] font-black uppercase text-slate-500">{isAutoPilot ? 'Auto-Processing' : 'Live Queue'}</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {serviceQueue.filter(t => t.status !== 'Delivered' && t.status !== 'Rejected').map(t => (
                  <div key={t.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 hover:border-orange-400 transition-all relative overflow-hidden">
                    {isAutoPilot && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>}
                    <div className="flex items-center gap-6">
                       <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner ${t.variant === 'Color' ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 text-slate-500'}`}>
                          <i className={`fa-solid ${t.status === 'Processing' ? 'fa-cog fa-spin' : 'fa-print'}`}></i>
                       </div>
                       <div>
                          <p className="font-black text-slate-800 uppercase text-2xl leading-none mb-1">{t.customerName}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.service} ({t.variant}) • {t.quantity} Units • {t.paperSize}</p>
                          <p className="text-[9px] font-mono text-blue-500 mt-2 flex items-center gap-2">
                              <i className="fa-solid fa-file-pdf"></i>
                              {t.fileName}
                          </p>
                       </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                       <div className="text-right">
                          <p className="text-[10px] font-black text-slate-300 uppercase leading-none mb-1 flex items-center gap-2 justify-end">
                              {t.customerPhone && (
                                  <button 
                                      onClick={() => sendWhatsApp(t.customerPhone!, `Hi ${t.customerName}, about your ${t.service} task (${t.fileName})...`)}
                                      className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                  >
                                      <i className="fa-brands fa-whatsapp"></i>
                                  </button>
                              )}
                              Expected Fee
                          </p>
                          <p className="text-4xl font-black text-slate-900 leading-none">₹{t.total}</p>
                       </div>
                       <div className="flex gap-2 w-full md:w-auto">
                          {!isAutoPilot ? (
                            <>
                              {t.status === 'Waiting' && (
                                <button onClick={() => updateXeroxStatus(t.id, 'Processing')} className="flex-1 px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg">Start</button>
                              )}
                              {t.status === 'Processing' && (
                                <button onClick={() => updateXeroxStatus(t.id, 'Ready')} className="flex-1 px-8 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg">Ready</button>
                              )}
                              {t.status === 'Ready' && (
                                <button onClick={() => updateXeroxStatus(t.id, 'Delivered')} className="flex-1 px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg">Deliver</button>
                              )}
                              <button onClick={() => updateXeroxStatus(t.id, 'Rejected')} className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-black uppercase text-[9px]">Reject</button>
                            </>
                          ) : (
                            <div className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-robot"></i>
                                Auto-Managing Stage: {t.status}
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BANKING HUB (Customer) */}
          {activeTab === 'BankingHub' && role === 'Customer' && (
            <div className="max-w-4xl mx-auto animate-enter">
              {bankingSubTab === 'Menu' ? (
                <div className="space-y-8">
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800">Hub Banking Link</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div onClick={() => setBankingSubTab('UPI')} className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm hover:shadow-xl transition-all cursor-pointer flex items-center gap-8 group">
                      <div className="w-20 h-20 bg-blue-50 text-blue-600 flex items-center justify-center rounded-[1.5rem] text-3xl group-hover:scale-110 transition-transform"><i className="fa-solid fa-qrcode"></i></div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase text-lg">UPI QR Transfer</h4>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Fee: 1.0%</p>
                      </div>
                    </div>
                    <div onClick={() => setBankingSubTab('Bank')} className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm hover:shadow-xl transition-all cursor-pointer flex items-center gap-8 group">
                      <div className="w-20 h-20 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-[1.5rem] text-3xl group-hover:scale-110 transition-transform"><i className="fa-solid fa-building-columns"></i></div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase text-lg">Bank Transfer</h4>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Fee: 1.0%</p>
                      </div>
                    </div>
                    <div onClick={() => setBankingSubTab('AEPS')} className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm hover:shadow-xl transition-all cursor-pointer flex items-center gap-8 group">
                      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-[1.5rem] text-3xl group-hover:scale-110 transition-transform"><i className="fa-solid fa-fingerprint"></i></div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase text-lg">AEPS Withdrawal</h4>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">1.0% + Aadhar</p>
                      </div>
                    </div>
                    <div onClick={() => setBankingSubTab('CC')} className="p-10 bg-white border-2 border-amber-100 bg-amber-50/10 rounded-[3rem] shadow-sm hover:shadow-xl transition-all cursor-pointer flex items-center gap-8 group">
                      <div className="w-20 h-20 bg-amber-100 text-amber-600 flex items-center justify-center rounded-[1.5rem] text-3xl group-hover:scale-110 transition-transform"><i className="fa-solid fa-credit-card"></i></div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase text-lg">CC Cash-Out</h4>
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-1">Premium: 2.0%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-[4rem] shadow-2xl animate-enter border border-slate-100">
                  <div className="flex items-center justify-between mb-10">
                     <h3 className="text-4xl font-black uppercase tracking-tighter">
                       {bankingSubTab === 'UPI' && 'UPI Settle Link'}
                       {bankingSubTab === 'Bank' && 'Bank Settle Link'}
                       {bankingSubTab === 'AEPS' && 'AEPS Signal'}
                       {bankingSubTab === 'CC' && 'Premium CC Signal'}
                     </h3>
                     <button onClick={() => setBankingSubTab('Menu')} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-800 transition-all"><i className="fa-solid fa-xmark text-xl"></i></button>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Amount (₹)</label>
                      <input type="number" id="hubAmt" className="w-full p-10 bg-slate-50 border-2 border-transparent rounded-[3rem] font-black text-7xl text-center focus:border-blue-600 outline-none" placeholder="0" />
                    </div>
                    <button onClick={() => {
                      const a = Number((document.getElementById('hubAmt') as any).value);
                      let type: BankingRequest['type'] = 'Transfer';
                      if(bankingSubTab === 'UPI') type = 'UPI_QR';
                      if(bankingSubTab === 'AEPS') type = 'AEPS';
                      if(bankingSubTab === 'CC') type = 'CreditCard';
                      submitBanking(type, a);
                    }} className="w-full py-8 bg-slate-900 text-white font-black uppercase rounded-[3rem] shadow-2xl hover:bg-black transition-all tracking-[0.3em]">Transmit Signal</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BANKING MANAGER (Merchant) */}
          {activeTab === 'BankingManager' && role === 'Merchant' && (
            <div className="max-w-5xl mx-auto animate-enter">
              <div className="flex items-center justify-between mb-12">
                 <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-800">Banking Terminal</h2>
                 {isAutoPilot && (
                    <div className="px-6 py-2 bg-emerald-50 text-emerald-600 rounded-full font-black uppercase text-[10px] tracking-[0.2em] border border-emerald-100 animate-pulse">
                        <i className="fa-solid fa-bolt mr-2"></i>
                        Auto-Settlement Active
                    </div>
                 )}
              </div>
              <div className="space-y-6">
                {cspRequests.filter(r => r.status === 'Queued').map(r => (
                  <div key={r.id} className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-10 hover:border-blue-400 hover:shadow-2xl transition-all relative">
                    <div className="flex items-center gap-8">
                      <div className={`w-20 h-20 flex items-center justify-center rounded-[2rem] text-4xl ${r.type === 'CreditCard' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                         <i className={`fa-solid ${r.type === 'CreditCard' ? 'fa-credit-card' : r.type === 'AEPS' ? 'fa-fingerprint' : r.type === 'UPI_QR' ? 'fa-qrcode' : 'fa-building-columns'}`}></i>
                      </div>
                      <div>
                        <p className="font-black text-slate-800 uppercase tracking-tight text-3xl leading-none mb-2">{r.customerName}</p>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">{r.type} Cluster</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-5">
                       <div className="text-right">
                          <p className="text-[10px] font-black text-slate-300 uppercase leading-none mb-2">Net Cash Yield</p>
                          <p className="text-5xl font-black text-slate-900">₹{r.netAmount.toLocaleString()}</p>
                       </div>
                       {!isAutoPilot ? (
                        <button onClick={() => setVerifyingRequest(r)} className="px-16 py-5 bg-blue-700 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-lg hover:bg-blue-800 transition-all">Verify & Settle</button>
                       ) : (
                        <div className="px-10 py-4 bg-slate-50 text-slate-400 rounded-[1.5rem] font-black uppercase text-[9px] border border-slate-100">Pending Auto-Settle</div>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APPROVALS (Merchant) */}
          {activeTab === 'Approvals' && role === 'Merchant' && (
            <div className="max-w-4xl mx-auto animate-enter">
              <h2 className="text-4xl font-black mb-10 uppercase tracking-tighter text-slate-800">KYC Verification Queue</h2>
              <div className="space-y-6">
                {users.filter(u => u.status === 'pending').map(u => (
                  <div key={u.phone} className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 flex items-center justify-between hover:border-emerald-400 hover:shadow-xl transition-all">
                    <div>
                      <p className="font-black text-slate-800 uppercase text-2xl leading-none mb-2">{u.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.3em] mb-2">{u.phone}</p>
                      <div className="flex items-center gap-4">
                         <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full"><i className="fa-solid fa-map-marker-alt mr-1"></i> {u.address?.substring(0, 30)}...</span>
                      </div>
                    </div>
                    {!isAutoPilot ? (
                        <button onClick={() => setVerifyingUser(u)} className="px-12 py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase text-[11px] shadow-lg hover:bg-emerald-700 transition-all">Perform KYC Review</button>
                    ) : (
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-6 py-2 rounded-full">Auto-Verifying...</span>
                    )}
                  </div>
                ))}
                {users.filter(u => u.status === 'pending').length === 0 && (
                   <div className="text-center py-32 opacity-20 font-black uppercase tracking-[0.5em]">Clear Sky: No Pending KYC</div>
                )}
              </div>
            </div>
          )}

          {/* PROFILE / SETTINGS */}
          {activeTab === 'Profile' && (
             <div className="max-w-2xl mx-auto animate-enter">
                <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-100">
                   <div className="text-center mb-10">
                      <div className="w-32 h-32 bg-slate-100 rounded-[3rem] mx-auto mb-6 flex items-center justify-center text-5xl text-slate-300">
                         <i className="fa-solid fa-user-gear"></i>
                      </div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800">{currentUser?.name}</h2>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.5em] mt-2">Nodal ID: {currentUser?.phone}</p>
                   </div>
                   
                   <div className="space-y-6">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                         <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Registered Address</p>
                         <p className="font-bold text-slate-700">{currentUser?.address || 'Not Provided'}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                         <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Registration Date</p>
                         <p className="font-bold text-slate-700">{new Date(currentUser?.createdAt || Date.now()).toLocaleDateString()}</p>
                      </div>
                      <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                         <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">Node Status</p>
                         <p className="font-black text-emerald-800 uppercase flex items-center gap-2">
                            <i className="fa-solid fa-check-double"></i>
                            VERIFIED & ACTIVE
                         </p>
                      </div>
                   </div>

                   <button onClick={handleSignOut} className="w-full mt-10 py-6 bg-red-50 text-red-600 font-black uppercase text-xs tracking-widest rounded-3xl hover:bg-red-100 transition-all">De-Authorize Terminal</button>
                </div>
             </div>
          )}
        </main>
      </div>

      {/* VERIFICATION MATRIX MODALS */}
      {verifyingUser && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-enter">
           <div className="bg-white w-full max-w-lg p-12 rounded-[4rem] shadow-2xl border-t-[12px] border-blue-600">
              <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-800 mb-8">KYC Official Authorization</h3>
              <div className="space-y-4 mb-10">
                 <div className="p-6 bg-slate-50 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Full Legal Name</p>
                    <p className="font-black text-2xl text-slate-800">{verifyingUser.name}</p>
                 </div>
                 <div className="p-6 bg-slate-50 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Mobile Access Number</p>
                    <p className="font-black text-2xl text-slate-800">{verifyingUser.phone}</p>
                 </div>
                 <div className="p-6 bg-slate-50 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Primary KYC Address</p>
                    <p className="font-bold text-slate-800">{verifyingUser.address}</p>
                 </div>
              </div>
              <div className="flex gap-4">
                 <button onClick={() => handleUserApproval(verifyingUser.phone, 'approved')} className="flex-1 py-6 bg-emerald-600 text-white font-black uppercase text-sm tracking-[0.4em] rounded-[2rem] shadow-xl">Activate Node</button>
                 <button onClick={() => handleUserApproval(verifyingUser.phone, 'rejected')} className="flex-1 py-6 bg-red-600 text-white font-black uppercase text-sm tracking-[0.4em] rounded-[2rem] shadow-xl">Reject</button>
              </div>
              <button onClick={() => setVerifyingUser(null)} className="w-full mt-6 py-4 text-slate-400 font-black uppercase text-[10px]">Close Matrix</button>
           </div>
        </div>
      )}

      {verifyingRequest && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-enter">
           <div className="bg-white w-full max-w-xl p-12 rounded-[4.5rem] shadow-2xl border-t-[12px] border-emerald-600">
              <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-800 mb-8">Settle Matrix</h3>
              <div className="p-10 bg-emerald-50 rounded-[3rem] border border-emerald-200 flex justify-between items-center mb-10">
                 <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">Net Cash</p>
                    <p className="text-6xl font-black text-emerald-900 tracking-tighter">₹{verifyingRequest.netAmount.toLocaleString()}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">Profit</p>
                    <p className="text-3xl font-black text-emerald-800 tracking-tighter">₹{verifyingRequest.fee.toLocaleString()}</p>
                 </div>
              </div>
              <div className="flex flex-col gap-4">
                 <button onClick={() => processBankingRequest(verifyingRequest.id, 'Approved')} className="w-full py-8 bg-emerald-600 text-white font-black uppercase text-sm tracking-[0.5em] rounded-[2.5rem] shadow-2xl">Confirm & Settle</button>
                 <button onClick={() => setVerifyingRequest(null)} className="w-full py-5 text-slate-400 font-black uppercase text-xs">Close</button>
              </div>
           </div>
        </div>
      )}

      <div className="fixed top-20 right-8 z-[8000] flex flex-col items-end gap-4 w-80 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`p-6 bg-white/95 backdrop-blur-xl border-l-[10px] shadow-2xl rounded-[1.5rem] flex items-center justify-between animate-enter pointer-events-auto w-full ${n.type === 'success' ? 'border-emerald-500' : 'border-blue-600'}`}>
            <p className="text-[11px] font-black uppercase text-slate-800 tracking-tight leading-relaxed">{n.message}</p>
            <i className={`fa-solid ${n.type === 'success' ? 'fa-circle-check text-emerald-500' : 'fa-info-circle text-blue-500'} text-xl ml-4`}></i>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
