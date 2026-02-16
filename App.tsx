
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ServiceType, Transaction, XeroxTask, AppNotification, BankingRequest, User, Product, KiranaRequirement } from './types';
import { INITIAL_PRODUCTS, MAJOR_INDIAN_BANKS } from './constants';

interface WalletUser extends User {
  walletBalance: number;
}

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const DATA_EXPIRY_DAYS = 20;

const App: React.FC = () => {
  // --- AUTH & ROLE STATE ---
  const [role, setRole] = useState<'Merchant' | 'Customer' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<WalletUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [isRegistering, setIsRegistering] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('laddu_theme') as 'light' | 'dark') || 'light';
  });

  // --- CAPTCHA STATE ---
  const [captcha, setCaptcha] = useState({ q: '', a: 0 });
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState(false);

  // --- BUSINESS DATA STATE ---
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cspRequests, setCspRequests] = useState<BankingRequest[]>([]); 
  const [serviceQueue, setServiceQueue] = useState<XeroxTask[]>([]);
  const [kiranaRequests, setKiranaRequests] = useState<KiranaRequirement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // --- UI STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // --- FORMS ---
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [regForm, setRegForm] = useState({ 
    name: '', phone: '', password: '', address: '',
    idType: 'Aadhar' as any, idNumber: ''
  });
  const [xeroxForm, setXeroxForm] = useState<Partial<XeroxTask>>({
    service: 'Xerox', variant: 'BW', quantity: 1, paperSize: 'A4', sides: 'Single',
    sourcePlatform: 'WhatsApp'
  });
  const [bankForm, setBankForm] = useState<Partial<BankingRequest>>({
    type: 'Transfer', amount: 0, bankName: '', targetId: '', note: ''
  });
  const [kiranaForm, setKiranaForm] = useState<Partial<KiranaRequirement>>({
    items: '', estimatedBudget: 0
  });

  // --- AUDIO REF ---
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
  }, []);

  const generateCaptcha = useCallback(() => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setCaptcha({ q: `${num1} + ${num2}`, a: num1 + num2 });
    setCaptchaInput('');
    setCaptchaError(false);
  }, []);

  useEffect(() => {
    if (isRegistering) generateCaptcha();
  }, [isRegistering, generateCaptcha]);

  // --- THEME EFFECT ---
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('laddu_theme', theme);
  }, [theme]);

  // --- PERSISTENCE & CLEANUP ---
  useEffect(() => {
    const isExpired = (timestamp: number) => {
      const diff = Date.now() - timestamp;
      return diff > (DATA_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    };

    const load = (key: string, setter: (val: any) => void, fallback: any = [], filterExpired = false) => {
      const saved = localStorage.getItem('laddu_' + key);
      if (saved) {
        try { 
          let data = JSON.parse(saved);
          if (filterExpired && Array.isArray(data)) {
            data = data.filter(item => !isExpired(item.timestamp || item.createdAt));
          }
          setter(data); 
        } catch (e) { setter(fallback); }
      } else setter(fallback);
    };

    load('users', setUsers);
    load('transactions', setTransactions, [], true);
    load('csp_requests', setCspRequests, [], true);
    load('service_queue', setServiceQueue, [], true);
    load('kirana_reqs', setKiranaRequests, [], true);
    load('inventory', setProducts, INITIAL_PRODUCTS);
    
    const savedAuth = localStorage.getItem('laddu_auth_user');
    if (savedAuth) {
      try {
        const user = JSON.parse(savedAuth);
        setCurrentUser(user); setIsLoggedIn(true); setRole(user.role);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const save = (key: string, val: any) => localStorage.setItem('laddu_' + key, JSON.stringify(val));
    save('users', users);
    save('transactions', transactions);
    save('csp_requests', cspRequests);
    save('service_queue', serviceQueue);
    save('kirana_reqs', kiranaRequests);
    save('inventory', products);
    if (currentUser) {
      // Sync local currentUser with the one in users list to pick up toggles
      const latest = users.find(u => u.phone === currentUser.phone);
      if (latest) {
        save('auth_user', latest);
        setCurrentUser(latest);
      } else {
        save('auth_user', currentUser);
      }
    }
  }, [users, transactions, cspRequests, serviceQueue, kiranaRequests, products]);

  // --- NOTIFICATIONS & SHARING ---
  const playAlert = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const addNotification = useCallback((message: string, type: AppNotification['type'] = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    playAlert();
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  const sendWhatsAppSignal = (phone: string, message: string) => {
    const encoded = encodeURIComponent(message);
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  const shareHubStatus = (task: XeroxTask | BankingRequest | KiranaRequirement) => {
    const msg = `LADDU HUB UPDATE\n\nSignal ID: ${task.id}\nStatus: ${task.status}\nCustomer: ${task.customerName}\n\nThank you for choosing Laddu Store!`;
    sendWhatsAppSignal(task.customerPhone || '', msg);
  };

  // --- AUTH ACTIONS ---
  const handleLogin = () => {
    if (role === 'Merchant' && loginForm.phone === '7799297100' && loginForm.password === '7799297100') {
      const pro: WalletUser = { 
        phone: '7799297100', name: 'LADDU PRO', password: '7799297100', role: 'Merchant', 
        status: 'approved', kycStatus: 'Verified', createdAt: Date.now(), walletBalance: 0,
        allowedServices: [ServiceType.XEROX, ServiceType.CSP, ServiceType.KIRANA_ORDER]
      };
      setCurrentUser(pro); setIsLoggedIn(true);
      addNotification("Merchant Terminal Authorized", "success");
      return;
    }

    const user = users.find(u => u.phone === loginForm.phone && u.password === loginForm.password);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      setRole(user.role);
      addNotification(`Welcome back, ${user.name}`, "success");
    } else {
      addNotification("Invalid Access Credentials", "error");
    }
  };

  const handleRegister = () => {
    if (!regForm.name || !regForm.phone || !regForm.password) return addNotification("Please fill required fields", "warning");
    
    if (parseInt(captchaInput) !== captcha.a) {
      setCaptchaError(true);
      addNotification("Identity Captcha Failed", "error");
      return;
    }

    if (users.find(u => u.phone === regForm.phone)) return addNotification("Node already exists", "error");

    const newUser: WalletUser = {
      ...regForm,
      status: 'pending',
      kycStatus: 'Submitted',
      role: 'Customer',
      createdAt: Date.now(),
      walletBalance: 0,
      wishlistIds: [],
      allowedServices: [ServiceType.XEROX, ServiceType.CSP, ServiceType.KIRANA_ORDER] // Default all on, merchant can toggle off
    };

    setUsers(prev => [...prev, newUser]);
    setIsRegistering(false);
    addNotification("Hub Signal Sent. Awaiting Pro Approval.", "success");
  };

  const approveNode = (phone: string, status: 'approved' | 'rejected') => {
    setUsers(prev => prev.map(u => {
      if (u.phone === phone) {
        const msg = status === 'approved' 
          ? `LADDU HUB: Hello ${u.name}! Your hub membership is APPROVED. Accessing Hub services now!` 
          : `LADDU HUB: Reg for ${u.phone} declined.`;
        sendWhatsAppSignal(u.phone, msg);
        return { ...u, status, kycStatus: status === 'approved' ? 'Verified' : 'Rejected' };
      }
      return u;
    }));
    addNotification(`Hub Node ${status.toUpperCase()}`, status === 'approved' ? 'success' : 'warning');
  };

  const toggleUserService = (phone: string, service: ServiceType) => {
    setUsers(prev => prev.map(u => {
      if (u.phone === phone) {
        const currentAllowed = u.allowedServices || [];
        const isAllowed = currentAllowed.includes(service);
        const nextAllowed = isAllowed 
          ? currentAllowed.filter(s => s !== service)
          : [...currentAllowed, service];
        
        addNotification(`Service ${service} ${isAllowed ? 'Disabled' : 'Enabled'} for ${u.name}`, isAllowed ? 'warning' : 'success');
        return { ...u, allowedServices: nextAllowed };
      }
      return u;
    }));
  };

  const handleBulkApprove = () => {
    const pendingNodes = users.filter(u => u.status === 'pending');
    if (pendingNodes.length === 0) return;

    setUsers(prev => prev.map(u => {
      if (u.status === 'pending') {
        return { ...u, status: 'approved', kycStatus: 'Verified' };
      }
      return u;
    }));
    addNotification(`Bulk Authorized ${pendingNodes.length} Hub Nodes`, "success");
    setShowBulkConfirm(false);
  };

  // --- WORKFLOW ACTIONS ---
  const submitXeroxTask = () => {
    if (!currentUser) return;
    const newTask: XeroxTask = {
      id: `XRX-${Date.now().toString().slice(-6)}`,
      timestamp: Date.now(),
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      service: xeroxForm.service as any,
      variant: xeroxForm.variant as any,
      quantity: xeroxForm.quantity || 1,
      paperSize: xeroxForm.paperSize as any,
      sides: xeroxForm.sides as any,
      paperType: 'Standard',
      finishing: 'None',
      deadline: 'ASAP',
      isPriority: false,
      rate: xeroxForm.variant === 'BW' ? 2 : 10,
      total: (xeroxForm.variant === 'BW' ? 2 : 10) * (xeroxForm.quantity || 1),
      status: 'Waiting',
      paymentStatus: 'Unpaid',
      sourcePlatform: xeroxForm.sourcePlatform
    };
    setServiceQueue(p => [newTask, ...p]);
    addNotification("Xerox Protocol Sent via " + xeroxForm.sourcePlatform, "success");
    setActiveTab('Home');
  };

  const advanceTask = (id: string, nextStatus: XeroxTask['status']) => {
    setServiceQueue(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, status: nextStatus };
        if (nextStatus === 'Ready' || nextStatus === 'Delivered') shareHubStatus(updated);
        if (nextStatus === 'Delivered') {
            setTransactions(p => [{
                id: `TX-${Date.now()}`, timestamp: Date.now(), type: ServiceType.XEROX,
                description: `${t.service} Signal ${t.id}`, amount: t.total, category: 'Digital Hub',
                paymentMethod: 'Cash', status: 'Paid', customerName: t.customerName
            }, ...p]);
            addNotification("Xerox Task Completed & Settled", "success");
        }
        return updated;
      }
      return t;
    }));
  };

  const submitBankRequest = () => {
    if (!currentUser) return;
    const feePercent = bankForm.type === 'CC_Bill' ? 0.02 : 0.01;
    const calculatedFee = (bankForm.amount || 0) * feePercent;
    
    const req: BankingRequest = {
      id: `BNK-${Date.now().toString().slice(-6)}`,
      timestamp: Date.now(),
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      type: bankForm.type as any,
      amount: bankForm.amount || 0,
      fee: calculatedFee,
      netAmount: (bankForm.amount || 0) + calculatedFee,
      targetId: bankForm.targetId,
      bankName: bankForm.bankName,
      note: bankForm.note, 
      status: 'Queued'
    };
    setCspRequests(p => [req, ...p]);
    addNotification("Banking Signal Transmitted", "success");
    setActiveTab('Home');
  };

  const updateBankStatus = (id: string, nextStatus: BankingRequest['status']) => {
    setCspRequests(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, status: nextStatus };
        if (nextStatus === 'Completed') {
          setTransactions(p => [{
              id: `TX-CSP-${Date.now()}`, timestamp: Date.now(), type: ServiceType.CSP,
              description: `Bank Settle ${r.type} ${r.id}`, amount: r.netAmount, category: 'Banking Hub',
              paymentMethod: 'UPI', status: 'Paid', customerName: r.customerName
          }, ...p]);
          addNotification("Bank Signal Fully Settled", "success");
          shareHubStatus(updated);
        } else {
          addNotification(`Bank Signal moved to ${nextStatus}`, "info");
        }
        return updated;
      }
      return r;
    }));
  };

  const submitKiranaRequirement = () => {
    if (!currentUser || !kiranaForm.items) return;
    const newReq: KiranaRequirement = {
      id: `KRN-${Date.now().toString().slice(-6)}`,
      timestamp: Date.now(),
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      items: kiranaForm.items,
      estimatedBudget: kiranaForm.estimatedBudget,
      status: 'Sent',
      paymentStatus: 'Unpaid'
    };
    setKiranaRequests(p => [newReq, ...p]);
    addNotification("Grocery List Shared with Merchant", "success");
    setKiranaForm({ items: '', estimatedBudget: 0 });
    setActiveTab('Home');
  };

  const advanceKirana = (id: string, nextStatus: KiranaRequirement['status']) => {
    setKiranaRequests(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, status: nextStatus };
        if (nextStatus === 'Ready' || nextStatus === 'OutForDelivery') shareHubStatus(updated);
        if (nextStatus === 'Delivered') {
           setTransactions(p => [{
              id: `TX-KRN-${Date.now()}`, timestamp: Date.now(), type: ServiceType.KIRANA_ORDER,
              description: `Kirana Fulfillment ${r.id}`, amount: r.estimatedBudget || 0, category: 'Kirana Hub',
              paymentMethod: 'Cash', status: 'Paid', customerName: r.customerName
          }, ...p]);
           addNotification("Kirana Delivery Recorded", "success");
        }
        return updated;
      }
      return r;
    }));
  };

  // --- HELPERS ---
  const isAllowed = (service: ServiceType) => {
    if (role === 'Merchant') return true;
    return currentUser?.allowedServices?.includes(service);
  };

  const SidebarItem = ({ id, label, icon, badge }: { id: string, label: string, icon: string, badge?: number }) => (
    <button onClick={() => { setActiveTab(id); setSearchQuery(''); setStatusFilter('All'); }} className={`kiosk-sidebar-item flex items-center justify-between transition-all ${activeTab === id ? 'active' : ''}`}>
      <div className="flex items-center gap-3">
        <i className={`fa-solid ${icon} w-5`}></i>
        <span>{label}</span>
      </div>
      {badge ? <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-bounce-subtle">{badge}</span> : null}
    </button>
  );

  const FilterBar = () => (
    <div className="flex flex-col md:flex-row gap-4 mb-8">
      <div className="flex-1 relative">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input 
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-bold dark:text-white shadow-sm"
          placeholder="Search signal or customer..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>
      <select 
        className="px-6 py-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-black uppercase text-[10px] dark:text-white shadow-sm"
        value={statusFilter}
        onChange={e => setStatusFilter(e.target.value)}
      >
        <option value="All">All Status</option>
        <option value="Waiting">Waiting</option>
        <option value="Queued">Queued</option>
        <option value="Processing">Processing</option>
        <option value="Ready">Ready</option>
        <option value="Delivered">Delivered</option>
      </select>
    </div>
  );

  // --- DASHBOARD CARDS ---
  const ServiceCard = ({ id, label, icon, color, serviceType }: { id: string, label: string, icon: string, color: string, serviceType: ServiceType }) => {
    if (!isAllowed(serviceType)) return null;
    return (
      <div onClick={() => setActiveTab(id)} className="kiosk-card group">
        <i className={`fa-solid ${icon} ${color}`}></i>
        <span>{label}</span>
      </div>
    );
  };

  // --- LOGIN/REGISTER INTERFACE ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl animate-enter border dark:border-slate-800">
           <div className="text-center mb-10">
              <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center text-white text-4xl shadow-xl transition-all duration-500 ${role === 'Merchant' ? 'bg-sbi-blue rotate-12' : 'bg-orange-600 -rotate-12'}`}>
                <i className={`fa-solid ${role === 'Merchant' ? 'fa-user-shield' : 'fa-house-signal'}`}></i>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter dark:text-white">
                {role === null ? 'Laddu Terminal' : isRegistering ? 'Hub Node Identity' : `${role} Login`}
              </h2>
           </div>

           {role === null ? (
             <div className="space-y-4">
               <button onClick={() => setRole('Merchant')} className="w-full py-5 bg-sbi-blue text-white rounded-2xl font-black uppercase text-xs shadow-lg">Merchant Login</button>
               <button onClick={() => setRole('Customer')} className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Customer Hub</button>
             </div>
           ) : isRegistering ? (
             <div className="space-y-4 animate-enter">
               <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" placeholder="Node Name" value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} />
               <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" placeholder="Mobile Node No" value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} />
               <input type="password" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" placeholder="Security PIN" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} />
               
               <div className="bg-slate-100 dark:bg-slate-800 p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center justify-between">Identity Verification</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white dark:bg-slate-900 py-3 px-4 rounded-xl text-center font-black text-xl border dark:border-slate-700 dark:text-white">
                      {captcha.q} = ?
                    </div>
                    <input 
                      type="number" 
                      className={`w-24 p-3 bg-white dark:bg-slate-900 border-2 rounded-xl text-center font-black text-xl dark:text-white ${captchaError ? 'border-red-500' : 'border-blue-500/20'}`} 
                      placeholder="?" 
                      value={captchaInput}
                      onChange={e => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
                    />
                  </div>
               </div>

               <button onClick={handleRegister} className="w-full py-5 bg-emerald-600 text-white font-black uppercase rounded-2xl mt-4 shadow-xl">Submit Registration</button>
               <button onClick={() => setIsRegistering(false)} className="w-full text-[10px] font-black uppercase text-slate-400 py-2">Return to Login</button>
             </div>
           ) : (
             <div className="space-y-4 animate-enter">
                <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" placeholder="Mobile No" value={loginForm.phone} onChange={e => setLoginForm({...loginForm, phone: e.target.value})} />
                <input type="password" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" placeholder="Access PIN" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
                <button onClick={handleLogin} className="w-full py-5 bg-blue-600 text-white font-black uppercase rounded-2xl shadow-xl">Authorize Hub</button>
                {role === 'Customer' && <button onClick={() => setIsRegistering(true)} className="w-full text-blue-500 font-black uppercase text-[10px] border-b border-blue-500/20 py-2">Register New Hub Node</button>}
                <button onClick={() => setRole(null)} className="w-full text-[10px] font-black uppercase text-slate-400 mt-4 py-2">Switch Terminal</button>
             </div>
           )}
        </div>
      </div>
    );
  }

  // --- INTERLOCK ---
  if (role === 'Customer' && currentUser?.status !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-12 rounded-[3rem] shadow-2xl text-center animate-pop border dark:border-slate-800">
           <div className="w-24 h-24 mx-auto mb-8 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center text-4xl animate-pulse-slow">
              <i className="fa-solid fa-shield-halved"></i>
           </div>
           <h2 className="text-2xl font-black uppercase dark:text-white mb-2">Authorization Pending</h2>
           <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">
             {currentUser?.status === 'rejected' 
               ? "Membership Signal Denied by Pro Terminal." 
               : "Your Node Identity is awaiting Merchant Approval. Hub services will unlock once Laddu Pro verifies your dossiers."}
           </p>
           <button onClick={() => { setIsLoggedIn(false); setRole(null); setCurrentUser(null); }} className="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase text-[10px] shadow-lg">Sign Out Node</button>
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-slate-950 transition-colors">
      <header className="kiosk-header h-16 flex items-center justify-between px-6 z-50 sticky top-0">
        <div className="flex items-center gap-4 text-white">
          <i className="fa-solid fa-store cursor-pointer hover:scale-110 transition-transform" onClick={() => setActiveTab('Home')}></i>
          <h1 className="font-black text-xl uppercase tracking-tighter">LADDU <span className="text-orange-400">{role === 'Merchant' ? 'PRO' : 'HUB'}</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center transition-all"><i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`}></i></button>
          <button onClick={() => { setIsLoggedIn(false); setRole(null); setCurrentUser(null); }} className="text-white w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center transition-all"><i className="fa-solid fa-power-off"></i></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r dark:border-slate-800 shadow-xl">
          <div className="p-4 space-y-1">
            <SidebarItem id="Home" label="Dashboard" icon="fa-house" />
            {role === 'Merchant' ? (
              <>
                <SidebarItem id="Approvals" label="Node Control" icon="fa-fingerprint" badge={users.filter(u => u.status === 'pending').length} />
                <SidebarItem id="XeroxControl" label="Print Terminal" icon="fa-print" badge={serviceQueue.filter(s => s.status !== 'Delivered').length} />
                <SidebarItem id="BankControl" label="Bank Terminal" icon="fa-building-columns" badge={cspRequests.filter(r => r.status === 'Queued' || r.status === 'Approved').length} />
                <SidebarItem id="KiranaControl" label="Kirana Desk" icon="fa-basket-shopping" badge={kiranaRequests.filter(r => r.status !== 'Delivered' && r.status !== 'Cancelled').length} />
                <SidebarItem id="History" label="Central Ledger" icon="fa-list-check" />
              </>
            ) : (
              <>
                <ServiceCard id="KiranaHub" label="Kirana Signal" icon="fa-basket-shopping" color="text-emerald-500" serviceType={ServiceType.KIRANA_ORDER} />
                <ServiceCard id="XeroxHub" label="Print Protocol" icon="fa-print" color="text-orange-600" serviceType={ServiceType.XEROX} />
                <ServiceCard id="BankHub" label="Bank Signal" icon="fa-building-columns" color="text-sbi-blue" serviceType={ServiceType.CSP} />
                <SidebarItem id="History" label="My Node Ledger" icon="fa-list-check" />
              </>
            )}
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto no-scrollbar pb-24">
          {activeTab === 'Home' && (
            <div className="max-w-5xl mx-auto animate-enter">
              <div className={`w-full h-44 rounded-[3rem] p-10 text-white mb-8 relative overflow-hidden shadow-xl transition-all duration-500 ${role === 'Merchant' ? 'bg-sbi-blue' : 'bg-orange-600'}`}>
                <h2 className="text-4xl font-black uppercase tracking-tight">{currentUser?.name} Hub</h2>
                <p className="opacity-70 mt-3 font-bold uppercase text-[10px] tracking-widest italic">Hub Node Active • Encrypted Signal Stable</p>
                <div className="absolute -right-10 -bottom-10 opacity-10"><i className={`fa-solid ${role === 'Merchant' ? 'fa-user-shield' : 'fa-network-wired'} text-[12rem]`}></i></div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                 {role === 'Customer' ? (
                   <>
                      <ServiceCard id="KiranaHub" label="Kirana Desk" icon="fa-basket-shopping" color="text-emerald-500" serviceType={ServiceType.KIRANA_ORDER} />
                      <ServiceCard id="XeroxHub" label="Xerox Desk" icon="fa-print" color="text-orange-600" serviceType={ServiceType.XEROX} />
                      <ServiceCard id="BankHub" label="Bank Signal" icon="fa-money-bill-transfer" color="text-sbi-blue" serviceType={ServiceType.CSP} />
                   </>
                 ) : (
                   <>
                      <div onClick={() => setActiveTab('Approvals')} className="kiosk-card group"><i className="fa-solid fa-fingerprint"></i><span>Node Control</span></div>
                      <div onClick={() => setActiveTab('XeroxControl')} className="kiosk-card group"><i className="fa-solid fa-print"></i><span>Print Desk</span></div>
                      <div onClick={() => setActiveTab('BankControl')} className="kiosk-card group"><i className="fa-solid fa-building-columns"></i><span>Bank Terminal</span></div>
                      <div onClick={() => setActiveTab('KiranaControl')} className="kiosk-card group"><i className="fa-solid fa-basket-shopping"></i><span>Kirana Desk</span></div>
                   </>
                 )}
                 <div onClick={() => setActiveTab('History')} className="kiosk-card group"><i className="fa-solid fa-clock-rotate-left"></i><span>Ledger Logs</span></div>
              </div>
            </div>
          )}

          {/* KIRANA HUB (CUSTOMER) */}
          {activeTab === 'KiranaHub' && role === 'Customer' && (
            <div className="max-w-4xl mx-auto animate-enter">
               <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-2xl">
                 <h3 className="text-2xl font-black uppercase mb-8 flex items-center gap-3 dark:text-white"><i className="fa-solid fa-basket-shopping text-emerald-500"></i> Kirana Requirement Signal</h3>
                 <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Grocery Requirements List</label>
                      <textarea 
                        className="w-full p-6 mt-2 bg-slate-50 dark:bg-slate-800 border-2 dark:border-slate-700 rounded-3xl font-bold dark:text-white min-h-[200px]" 
                        placeholder="Type items here: e.g. 5kg Sugar, 2L Oil..."
                        value={kiranaForm.items}
                        onChange={e => setKiranaForm({...kiranaForm, items: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Estimated Budget (₹)</label>
                      <input 
                        type="number" 
                        className="w-full p-5 mt-2 bg-slate-50 dark:bg-slate-800 border-2 dark:border-slate-700 rounded-2xl font-black text-2xl dark:text-white"
                        value={kiranaForm.estimatedBudget || ''}
                        onChange={e => setKiranaForm({...kiranaForm, estimatedBudget: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <button onClick={submitKiranaRequirement} className="w-full py-6 bg-emerald-600 text-white font-black uppercase rounded-3xl shadow-xl hover:scale-[1.01] transition-transform">
                      Send Requirement to Store
                    </button>
                 </div>
               </div>
            </div>
          )}

          {/* XEROX HUB (CUSTOMER) */}
          {activeTab === 'XeroxHub' && role === 'Customer' && (
            <div className="max-w-4xl mx-auto animate-enter">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-2xl">
                <h3 className="text-2xl font-black uppercase mb-8 flex items-center gap-3 dark:text-white"><i className="fa-solid fa-print text-orange-600"></i> Xerox & Print Protocol</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Job Variant</label>
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => setXeroxForm({...xeroxForm, variant: 'BW'})} className={`p-5 rounded-2xl font-black uppercase text-xs transition-all ${xeroxForm.variant === 'BW' ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>B&W (₹2)</button>
                       <button onClick={() => setXeroxForm({...xeroxForm, variant: 'Color'})} className={`p-5 rounded-2xl font-black uppercase text-xs transition-all ${xeroxForm.variant === 'Color' ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>Color (₹10)</button>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Source Platform</label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['WhatsApp', 'Gmail', 'Telegram'].map(p => (
                          <button key={p} onClick={() => setXeroxForm({...xeroxForm, sourcePlatform: p})} className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${xeroxForm.sourcePlatform === p ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-transparent bg-slate-50 dark:bg-slate-800 opacity-60'}`}>
                            <i className={`fa-brands fa-${p.toLowerCase()} text-lg ${p === 'WhatsApp' ? 'text-emerald-500' : p === 'Gmail' ? 'text-red-500' : 'text-blue-500'}`}></i>
                            <span className="text-[8px] font-black uppercase">{p}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex flex-col gap-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">No. of Pages</label>
                       <input type="number" className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 dark:border-slate-700 rounded-2xl font-black text-2xl dark:text-white" value={xeroxForm.quantity} onChange={e => setXeroxForm({...xeroxForm, quantity: parseInt(e.target.value) || 1})} />
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-orange-200 dark:border-orange-900/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">Estimated Total</span>
                        <span className="text-2xl font-black text-orange-600">₹{(xeroxForm.variant === 'BW' ? 2 : 10) * (xeroxForm.quantity || 1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={submitXeroxTask} className="w-full mt-8 py-6 bg-orange-600 text-white font-black uppercase rounded-3xl shadow-xl hover:scale-[1.01] transition-transform">Transmit Print Signal</button>
              </div>
            </div>
          )}

          {/* BANK HUB (CUSTOMER) */}
          {activeTab === 'BankHub' && role === 'Customer' && (
            <div className="max-w-4xl mx-auto animate-enter">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black uppercase flex items-center gap-3 dark:text-white"><i className="fa-solid fa-money-bill-transfer text-sbi-blue"></i> Bank Signal Desk</h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full border border-blue-100 dark:border-blue-800 animate-pulse">
                    <span className="text-[10px] font-black text-sbi-blue uppercase">CASH DESK 1% • CC DESK 2%</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Transaction Type</label>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {['Transfer', 'Withdraw', 'CC_Bill', 'Electricity'].map(t => (
                          <button key={t} onClick={() => setBankForm({...bankForm, type: t as any})} className={`p-4 rounded-xl font-black uppercase text-[10px] transition-all ${bankForm.type === t ? 'bg-sbi-blue text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                            {t.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Select Bank</label>
                      <select className="w-full p-4 mt-2 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" value={bankForm.bankName} onChange={e => setBankForm({...bankForm, bankName: e.target.value})}>
                        <option value="">Choose Bank...</option>
                        {MAJOR_INDIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <input type="number" className="w-full p-6 bg-slate-50 dark:bg-slate-800 border-2 dark:border-slate-700 rounded-2xl font-black text-4xl dark:text-white placeholder:text-slate-300" placeholder="Amount (₹)" value={bankForm.amount || ''} onChange={e => setBankForm({...bankForm, amount: parseInt(e.target.value) || 0})} />
                    <div className="grid grid-cols-1 gap-3">
                       <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" placeholder="Account Number / UPI ID" value={bankForm.targetId} onChange={e => setBankForm({...bankForm, targetId: e.target.value})} />
                       <input className="w-full p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" placeholder="Account Holder Name" value={bankForm.note} onChange={e => setBankForm({...bankForm, note: e.target.value})} />
                    </div>
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border-2 border-sbi-blue/10">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold dark:text-white">Fee: ₹{(bankForm.amount || 0) * (bankForm.type === 'CC_Bill' ? 0.02 : 0.01)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={submitBankRequest} className="w-full mt-8 py-6 bg-sbi-blue text-white font-black uppercase rounded-3xl shadow-xl hover:scale-[1.01] transition-transform">Transmit Banking Signal</button>
              </div>
            </div>
          )}

          {/* KIRANA CONTROL (MERCHANT) */}
          {activeTab === 'KiranaControl' && role === 'Merchant' && (
            <div className="max-w-5xl mx-auto animate-enter">
              <h2 className="text-3xl font-black uppercase tracking-tighter dark:text-white mb-8">Kirana Requirement Hub</h2>
              <FilterBar />
              <div className="grid grid-cols-1 gap-6">
                {kiranaRequests.filter(r => statusFilter === 'All' || r.status === statusFilter).map(r => (
                  <div key={r.id} className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border-l-[15px] border-emerald-500 shadow-xl flex flex-col md:flex-row items-center justify-between group border dark:border-slate-700">
                    <div className="flex items-center gap-6">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${r.status === 'Sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        <i className={`fa-solid ${r.status === 'Fulfilling' ? 'fa-truck-loading fa-shake' : 'fa-basket-shopping'}`}></i>
                      </div>
                      <div>
                        <p className="font-black text-2xl uppercase tracking-tight dark:text-white leading-none">{r.customerName}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest italic">{r.items.slice(0, 40)}...</p>
                        <div className="flex items-center gap-2 mt-3">
                           <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase bg-emerald-100 text-emerald-700`}>{r.status}</span>
                           <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-700 text-slate-500 px-3 py-1 rounded-full uppercase">₹{r.estimatedBudget}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                      {r.status === 'Sent' && <button onClick={() => advanceKirana(r.id, 'Fulfilling')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">Start Pack</button>}
                      {r.status === 'Fulfilling' && <button onClick={() => advanceKirana(r.id, 'Ready')} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">Mark Ready</button>}
                      {r.status === 'Ready' && <button onClick={() => advanceKirana(r.id, 'OutForDelivery')} className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">Dispatch</button>}
                      {r.status === 'OutForDelivery' && <button onClick={() => advanceKirana(r.id, 'Delivered')} className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase text-[9px] shadow-lg">Confirm Arrival</button>}
                      <button onClick={() => shareHubStatus(r)} className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all"><i className="fa-brands fa-whatsapp"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NODE CONTROL (MERCHANT) */}
          {activeTab === 'Approvals' && role === 'Merchant' && (
            <div className="max-w-5xl mx-auto animate-enter">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter dark:text-white">Identity Verification Queue</h2>
                <div className="flex gap-2">
                  {users.filter(u => u.status === 'pending').length > 0 && (
                    <button onClick={() => setShowBulkConfirm(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg animate-bounce-subtle">Bulk Authorize</button>
                  )}
                </div>
              </div>

              {showBulkConfirm && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-enter">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border dark:border-slate-800">
                    <h3 className="text-xl font-black dark:text-white uppercase mb-2">Authorize All?</h3>
                    <p className="text-slate-500 text-sm font-bold mb-8">This will instantly approve all pending hub nodes.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setShowBulkConfirm(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Cancel</button>
                      <button onClick={handleBulkApprove} className="py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Confirm</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6">
                {users.map(u => (
                  <div key={u.phone} className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border dark:border-slate-700 shadow-xl flex flex-col md:flex-row items-center justify-between group hover:shadow-2xl transition-all">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 flex items-center justify-center text-3xl"><i className="fa-solid fa-fingerprint"></i></div>
                      <div>
                        <p className="font-black text-2xl dark:text-white uppercase leading-none">{u.name}</p>
                        <p className="text-sm text-blue-500 font-black mt-2">{u.phone}</p>
                        {u.status === 'approved' && (
                          <div className="flex gap-4 mt-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-700">
                             <div className="flex flex-col items-center gap-1">
                               <span className="text-[7px] font-black uppercase text-slate-400">Xerox</span>
                               <button onClick={() => toggleUserService(u.phone, ServiceType.XEROX)} className={`w-10 h-6 rounded-full transition-colors relative ${u.allowedServices?.includes(ServiceType.XEROX) ? 'bg-orange-500' : 'bg-slate-300'}`}>
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${u.allowedServices?.includes(ServiceType.XEROX) ? 'left-5' : 'left-1'}`}></div>
                               </button>
                             </div>
                             <div className="flex flex-col items-center gap-1">
                               <span className="text-[7px] font-black uppercase text-slate-400">Bank</span>
                               <button onClick={() => toggleUserService(u.phone, ServiceType.CSP)} className={`w-10 h-6 rounded-full transition-colors relative ${u.allowedServices?.includes(ServiceType.CSP) ? 'bg-sbi-blue' : 'bg-slate-300'}`}>
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${u.allowedServices?.includes(ServiceType.CSP) ? 'left-5' : 'left-1'}`}></div>
                               </button>
                             </div>
                             <div className="flex flex-col items-center gap-1">
                               <span className="text-[7px] font-black uppercase text-slate-400">Kirana</span>
                               <button onClick={() => toggleUserService(u.phone, ServiceType.KIRANA_ORDER)} className={`w-10 h-6 rounded-full transition-colors relative ${u.allowedServices?.includes(ServiceType.KIRANA_ORDER) ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${u.allowedServices?.includes(ServiceType.KIRANA_ORDER) ? 'left-5' : 'left-1'}`}></div>
                               </button>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 md:mt-0">
                       {u.status === 'pending' && (
                         <>
                           <button onClick={() => approveNode(u.phone, 'approved')} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Authorize</button>
                           <button onClick={() => approveNode(u.phone, 'rejected')} className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Reject</button>
                         </>
                       )}
                       {u.status === 'approved' && <span className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1"><i className="fa-solid fa-circle-check"></i> Signal Verified</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTORY / LEDGER */}
          {activeTab === 'History' && (
             <div className="max-w-5xl mx-auto animate-enter">
                <h2 className="text-3xl font-black uppercase tracking-tighter dark:text-white mb-8">Central Hub Ledger</h2>
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border dark:border-slate-800">
                   {transactions.length === 0 ? (
                     <div className="py-20 text-center opacity-30"><i className="fa-solid fa-file-circle-exclamation text-4xl mb-3"></i><p className="font-black uppercase">No Logs Recorded (Last 20 Days)</p></div>
                   ) : (
                    transactions
                    .filter(t => role === 'Merchant' ? true : t.customerName === currentUser?.name)
                    .map(tx => (
                      <div key={tx.id} className="p-8 border-b last:border-0 dark:border-slate-800 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-all"><i className="fa-solid fa-file-invoice-dollar"></i></div>
                            <div>
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(tx.timestamp).toLocaleString()}</p>
                               <p className="font-black text-lg dark:text-white uppercase leading-none mt-1">{tx.description}</p>
                               <p className="text-[8px] font-black text-slate-300 uppercase mt-2">{tx.category} • REF_{tx.id.slice(-6)}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <p className="text-2xl font-black dark:text-white tracking-tighter">₹{tx.amount}</p>
                            <button onClick={() => sendWhatsAppSignal(currentUser?.phone || '', `LADDU HUB RECEIPT\n\nSignal: ${tx.id}\nAmt: ₹${tx.amount}\nService: ${tx.description}`)} className="text-slate-300 hover:text-emerald-500 transition-colors hover:scale-125"><i className="fa-solid fa-share-nodes"></i></button>
                         </div>
                      </div>
                    ))
                   )}
                </div>
             </div>
          )}

        </main>
      </div>

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 w-80 pointer-events-none sticky bottom-0">
        {notifications.map(n => (
          <div key={n.id} className={`p-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l-[10px] shadow-2xl rounded-2xl flex items-center justify-between animate-enter pointer-events-auto w-full transition-all border-${n.type === 'success' ? 'emerald-500' : n.type === 'error' ? 'red-600' : n.type === 'warning' ? 'orange-500' : 'blue-600'}`}>
            <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-tight leading-tight">{n.message}</p>
            <i className={`fa-solid ${n.type === 'success' ? 'fa-circle-check text-emerald-500' : 'fa-circle-info text-blue-500'} text-lg ml-3`}></i>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
