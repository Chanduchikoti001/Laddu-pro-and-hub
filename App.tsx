import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ServiceType, Transaction, XeroxTask, AppNotification, BankingRequest, User, Product, KiranaRequirement } from './types';
import { INITIAL_PRODUCTS } from './constants';
import { chatWithAi } from './services/geminiService';

interface WalletUser extends User {
  walletBalance: number;
  systemAccess: boolean; // Individual node kill-switch
}

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
const DATA_EXPIRY_DAYS = 20;

const App: React.FC = () => {
  // --- AUTH & ROLE STATE ---
  const [role, setRole] = useState<'MerchantProPlus' | 'Merchant' | 'Customer' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<WalletUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regRole, setRegRole] = useState<'Merchant' | 'Customer'>('Customer');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('laddu_theme') as 'light' | 'dark') || 'light';
  });

  // --- GLOBAL MASTER CONFIG (Controlled by Pro+) ---
  const [globalConfig, setGlobalConfig] = useState({
    loginEnabled: true,
    xeroxEnabled: true,
    cspEnabled: true,
    kiranaEnabled: true,
    maintenanceMode: false
  });

  // --- BUSINESS DATA STATE ---
  const [users, setUsers] = useState<WalletUser[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // --- CHATBOT STATE ---
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'bot', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // --- FORMS ---
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', phone: '', password: '', address: '', sponsorPhone: '' });
  const [xeroxForm, setXeroxForm] = useState<Partial<XeroxTask>>({
    variant: 'BW', quantity: 1, sourcePlatform: 'WhatsApp'
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('laddu_theme', theme);
  }, [theme]);

  // --- PERSISTENCE ---
  useEffect(() => {
    const isExpired = (timestamp: number) => (Date.now() - timestamp) > (DATA_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const load = (key: string, setter: (val: any) => void, fallback: any = [], filterExpired = false) => {
      const saved = localStorage.getItem('laddu_' + key);
      if (saved) {
        try { 
          let data = JSON.parse(saved);
          if (filterExpired && Array.isArray(data)) data = data.filter(item => !isExpired(item.timestamp || item.createdAt));
          setter(data); 
        } catch (e) { setter(fallback); }
      } else setter(fallback);
    };

    load('users', setUsers);
    load('transactions', setTransactions, [], true);
    load('global_config', setGlobalConfig, { loginEnabled: true, xeroxEnabled: true, cspEnabled: true, kiranaEnabled: true, maintenanceMode: false });
    
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
    save('global_config', globalConfig);
    if (currentUser) localStorage.setItem('laddu_auth_user', JSON.stringify(currentUser));
  }, [users, transactions, globalConfig, currentUser]);

  const addNotification = useCallback((message: string, type: AppNotification['type'] = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    if (audioRef.current) audioRef.current.play().catch(() => {});
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  // --- HIERARCHICAL ACCESS LOGIC ---
  const managedUsers = useMemo(() => {
    if (role === 'MerchantProPlus') return users; // Master sees everyone
    if (role === 'Merchant' && currentUser) {
      // Merchant sees ONLY their direct registered customers
      return users.filter(u => u.registeredBy === currentUser.phone);
    }
    return [];
  }, [users, role, currentUser]);

  const canManageUser = (targetUserPhone: string) => {
    if (role === 'MerchantProPlus') return true;
    if (role === 'Merchant' && currentUser) {
      const target = users.find(u => u.phone === targetUserPhone);
      // Merchant can only manage if they are the direct sponsor
      return target?.registeredBy === currentUser.phone;
    }
    return false;
  };

  // --- AUTHENTICATION ---
  const handleLogin = () => {
    // Master Access
    if (loginForm.phone === '7799297100' && loginForm.password === '7799297100') {
      const proPlus: WalletUser = { 
        phone: '7799297100', name: 'LADDU MASTER PRO+', password: '7799297100', role: 'MerchantProPlus', 
        status: 'approved', kycStatus: 'Verified', createdAt: Date.now(), walletBalance: 999999,
        systemAccess: true, allowedServices: [ServiceType.XEROX, ServiceType.CSP, ServiceType.KIRANA_ORDER]
      };
      setCurrentUser(proPlus); setIsLoggedIn(true); setRole('MerchantProPlus');
      addNotification("Master Hub Linked: Full Authority Active", "success");
      return;
    }

    if (!globalConfig.loginEnabled) {
      return addNotification("Node Links Disabled by Master", "error");
    }

    const user = users.find(u => u.phone === loginForm.phone && u.password === loginForm.password);
    if (user) {
      if (user.status !== 'approved') return addNotification("Node Pending: Awaiting Sponsor Verification", "warning");
      if (!user.systemAccess) return addNotification("Node Locked by Authority Hub", "error");
      
      setCurrentUser(user);
      setIsLoggedIn(true);
      setRole(user.role);
      addNotification(`Signal Locked: Welcome ${user.name}`, "success");
    } else {
      addNotification("Invalid Access Credentials", "error");
    }
  };

  const handleRegister = () => {
    if (users.find(u => u.phone === regForm.phone)) return addNotification("ID Already Registered", "error");
    
    // The hierarchy logic: if merchant is registering someone, sponsor is merchant.
    // If public registering, sponsor is what they typed, or master if empty.
    let sponsor = regForm.sponsorPhone || (role === 'Merchant' ? currentUser?.phone : '7799297100');
    
    const newUser: WalletUser = {
      ...regForm, status: 'pending', kycStatus: 'Submitted', role: regRole,
      createdAt: Date.now(), walletBalance: 0, systemAccess: true,
      allowedServices: [ServiceType.KIRANA_ORDER],
      registeredBy: sponsor
    };

    setUsers(prev => [...prev, newUser]);
    setIsRegistering(false);
    addNotification(`Enrollment Transmitted to Sponsor: ${sponsor}`, "success");
  };

  // --- ADMIN ACTIONS ---
  const approveNode = (phone: string, status: 'approved' | 'rejected') => {
    if (!canManageUser(phone)) return addNotification("Authority Level Insufficient", "error");
    setUsers(prev => prev.map(u => u.phone === phone ? { ...u, status } : u));
    addNotification(`Node ${phone} updated to ${status}`, status === 'approved' ? 'success' : 'warning');
  };

  const toggleServiceAccess = (phone: string, service: ServiceType) => {
    if (!canManageUser(phone)) return addNotification("Authority Level Insufficient", "error");
    setUsers(prev => prev.map(u => {
      if (u.phone === phone) {
        const current = u.allowedServices || [];
        const updated = current.includes(service) ? current.filter(s => s !== service) : [...current, service];
        return { ...u, allowedServices: updated };
      }
      return u;
    }));
    addNotification(`Service Permission Toggled`, "info");
  };

  const toggleUserAccess = (phone: string) => {
    if (!canManageUser(phone)) return addNotification("Authority Level Insufficient", "error");
    setUsers(prev => prev.map(u => u.phone === phone ? { ...u, systemAccess: !u.systemAccess } : u));
    addNotification(`Global Access Signal Toggled`, "info");
  };

  const checkServiceAccess = (service: ServiceType) => {
    if (role === 'MerchantProPlus') return true;
    if (service === ServiceType.XEROX && !globalConfig.xeroxEnabled) return false;
    if (service === ServiceType.CSP && !globalConfig.cspEnabled) return false;
    return currentUser?.allowedServices?.includes(service) || false;
  };

  const submitXerox = () => {
    if (!checkServiceAccess(ServiceType.XEROX)) return addNotification("Service Desk Locked", "error");
    if (!currentUser) return;
    const task: XeroxTask = {
      id: `XRX-${Date.now().toString().slice(-4)}`, timestamp: Date.now(),
      customerName: currentUser.name, customerPhone: currentUser.phone,
      service: 'Xerox', variant: xeroxForm.variant as any, quantity: xeroxForm.quantity || 1,
      paperSize: 'A4', sides: 'Single', paperType: 'Standard', finishing: 'None',
      deadline: 'ASAP', isPriority: false, rate: 2, total: (xeroxForm.variant === 'BW' ? 2 : 10) * (xeroxForm.quantity || 1),
      status: 'Waiting', paymentStatus: 'Unpaid'
    };
    // Usually added to a global queue, here we just notify
    addNotification("Print Signal Transmitted to Desk", "success");
    setActiveTab('Home');
  };

  const sendMessageToLaddu = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsTyping(true);
    try {
      const response = await chatWithAi({ message: userMsg });
      setChatMessages(prev => [...prev, { role: 'bot', text: response.text }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'bot', text: "Signal flux. Re-syncing AI..." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const SidebarItem = ({ id, label, icon }: { id: string, label: string, icon: string }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`kiosk-sidebar-item flex items-center gap-4 transition-all duration-300 ${activeTab === id ? 'active translate-x-1' : 'hover:translate-x-1'}`}
    >
      <i className={`fa-solid ${icon} w-6 text-center text-lg`}></i>
      <span className="font-bold tracking-tight">{label}</span>
    </button>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-12 rounded-[4rem] shadow-3xl border dark:border-slate-800 animate-pop">
           <div className="text-center mb-10">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-800 to-blue-950 rounded-[2.5rem] mx-auto flex items-center justify-center text-white text-5xl shadow-3xl rotate-6 mb-8 border-4 border-white/20">
                <i className="fa-solid fa-crown"></i>
              </div>
              <h2 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">LADDU STORE</h2>
              <p className="text-[11px] text-sbi-blue dark:text-blue-400 font-black uppercase tracking-[0.4em] mt-3">Hierarchy Link Hub</p>
           </div>
           
           {isRegistering ? (
             <div className="flex flex-col gap-5 animate-enter">
               <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                 <button onClick={() => setRegRole('Customer')} className={`flex-1 p-4 rounded-xl text-[10px] font-black uppercase transition-all ${regRole === 'Customer' ? 'bg-white dark:bg-slate-700 shadow-xl text-sbi-blue' : 'text-slate-400'}`}>Customer Hub</button>
                 <button onClick={() => setRegRole('Merchant')} className={`flex-1 p-4 rounded-xl text-[10px] font-black uppercase transition-all ${regRole === 'Merchant' ? 'bg-white dark:bg-slate-700 shadow-xl text-sbi-blue' : 'text-slate-400'}`}>Merchant Desk</button>
               </div>
               <input className="p-5 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-[1.8rem] font-bold outline-none" placeholder="Full Name" onChange={e => setRegForm({...regForm, name: e.target.value})} />
               <input className="p-5 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-[1.8rem] font-bold outline-none" placeholder="Mobile Number" onChange={e => setRegForm({...regForm, phone: e.target.value})} />
               <input className="p-5 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-[1.8rem] font-bold outline-none" type="password" placeholder="Terminal PIN" onChange={e => setRegForm({...regForm, password: e.target.value})} />
               <input className="p-5 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-[1.8rem] font-bold outline-none" placeholder="Sponsor Merchant ID" value={regForm.sponsorPhone} onChange={e => setRegForm({...regForm, sponsorPhone: e.target.value})} />
               <button onClick={handleRegister} className="p-6 bg-sbi-blue text-white rounded-[1.8rem] font-black uppercase text-xs mt-2 shadow-3xl hover:scale-105 active:scale-95 transition-all">Link To Chain</button>
               <button onClick={() => setIsRegistering(false)} className="text-[10px] text-center text-slate-400 font-black uppercase tracking-[0.3em] mt-3">Back to Hub Auth</button>
             </div>
           ) : (
             <div className="flex flex-col gap-5 animate-enter">
               <input className="p-5 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-[1.8rem] font-bold outline-none" placeholder="Terminal ID" onChange={e => setLoginForm({...loginForm, phone: e.target.value})} />
               <input className="p-5 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-[1.8rem] font-bold outline-none" type="password" placeholder="Access PIN" onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
               <button onClick={handleLogin} className="p-6 bg-sbi-blue text-white rounded-[1.8rem] font-black uppercase text-xs mt-2 shadow-3xl hover:scale-105 active:scale-95 transition-all">Connect Signal</button>
               <button onClick={() => setIsRegistering(true)} className="text-[10px] text-center text-orange-600 font-black uppercase tracking-[0.3em] mt-3">Request New Node Access</button>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-all">
      <header className="kiosk-header h-24 flex items-center justify-between px-8 text-white sticky top-0 z-50 shadow-xl">
        <div className="flex items-center gap-6 cursor-pointer group" onClick={() => setActiveTab('Home')}>
            <div className="w-12 h-12 bg-white/10 rounded-[1rem] flex items-center justify-center text-2xl animate-pulse group-hover:scale-110 transition-all">
                <i className={`fa-solid ${role === 'MerchantProPlus' ? 'fa-crown text-yellow-400' : 'fa-house-signal'}`}></i>
            </div>
            <div>
                <h1 className="font-black text-2xl uppercase tracking-tighter leading-none mb-1">
                  {role === 'MerchantProPlus' ? 'LADDU PRO+' : role === 'Merchant' ? 'LADDU PRO' : 'LADDU HUB'}
                </h1>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-400 opacity-90">
                  {currentUser?.name} • NODE ACTIVE
                </p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-3 bg-white/10 rounded-[1rem] hover:bg-white/20 transition shadow-xl border border-white/5"><i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun text-yellow-300'}`}></i></button>
            <button onClick={() => { setIsLoggedIn(false); setRole(null); }} className="p-3 bg-red-500/20 rounded-[1rem] text-red-100 font-bold text-[10px] uppercase hover:bg-red-500/40 transition shadow-xl border border-white/5"><i className="fa-solid fa-power-off"></i></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r dark:border-slate-800 shadow-xl z-40">
          <div className="p-6 space-y-2 overflow-y-auto no-scrollbar">
            <SidebarItem id="Home" label="Hub Home" icon="fa-house" />
            
            {role === 'MerchantProPlus' && (
              <>
                <div className="pt-6 pb-2 text-[9px] font-black text-orange-500 uppercase tracking-[0.4em] border-b dark:border-slate-800 mb-2">Master Power</div>
                <SidebarItem id="MasterConfig" label="Master Console" icon="fa-gears" />
                <SidebarItem id="Users" label="Global Registry" icon="fa-fingerprint" />
              </>
            )}

            {role === 'Merchant' && (
              <>
                <div className="pt-6 pb-2 text-[9px] font-black text-orange-500 uppercase tracking-[0.4em] border-b dark:border-slate-800 mb-2">Merchant Desk</div>
                <SidebarItem id="Users" label="My Sub-Nodes" icon="fa-network-wired" />
                <SidebarItem id="XeroxDesk" label="Xerox Desk" icon="fa-print" />
              </>
            )}

            {(role === 'Customer' || role === 'MerchantProPlus') && (
              <>
                <div className="pt-6 pb-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">User Desk</div>
                <SidebarItem id="XeroxHub" label="Print Signal" icon="fa-file-export" />
              </>
            )}

            <div className="pt-6 pb-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Analytics</div>
            <SidebarItem id="History" label="Central Ledger" icon="fa-list-check" />
            <SidebarItem id="LadduBot" label="Laddu AI" icon="fa-robot" />
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto no-scrollbar pb-24">
          {activeTab === 'Home' && (
            <div className="animate-enter max-w-5xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-sbi-blue to-blue-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10">
                        <h2 className="text-5xl font-black uppercase tracking-tighter leading-tight mb-3">Signal Hub Verified</h2>
                        <p className="text-blue-200 font-bold uppercase tracking-[0.3em] text-[10px]">Managed Hierarchy Active</p>
                    </div>
                    <div className="absolute -right-16 -bottom-16 opacity-10 text-[18rem] rotate-12 group-hover:rotate-45 transition-transform duration-[2000ms]"><i className="fa-solid fa-signal"></i></div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 shadow-2xl border dark:border-slate-800 flex flex-col justify-center items-center text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-4">Node Credits</p>
                    <h3 className="text-5xl font-black text-sbi-blue dark:text-blue-400 tracking-tighter">₹{currentUser?.walletBalance.toLocaleString()}</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                 {(role === 'MerchantProPlus' || role === 'Merchant') && (
                   <button onClick={() => setActiveTab('Users')} className="kiosk-card group"><i className="fa-solid fa-fingerprint text-sbi-blue scale-110 mb-2"></i><span>{role === 'MerchantProPlus' ? 'Global Nodes' : 'My Nodes'}</span></button>
                 )}
                 {checkServiceAccess(ServiceType.XEROX) && (
                   <button onClick={() => setActiveTab('XeroxHub')} className="kiosk-card group"><i className="fa-solid fa-print text-orange-500 scale-110 mb-2"></i><span>Print Desk</span></button>
                 )}
              </div>
            </div>
          )}

          {activeTab === 'MasterConfig' && role === 'MerchantProPlus' && (
            <div className="max-w-4xl mx-auto animate-enter space-y-8">
              <div className="bg-white dark:bg-slate-900 rounded-[4rem] p-12 shadow-2xl border dark:border-slate-800">
                <h3 className="text-4xl font-black uppercase tracking-tighter mb-12 dark:text-white flex items-center gap-5">
                    <i className="fa-solid fa-shield-halved text-yellow-500"></i> Authority Console
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8 p-10 bg-slate-50 dark:bg-slate-800/50 rounded-[3rem] border dark:border-slate-700">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Global Hub Switches</h4>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs uppercase dark:text-white tracking-widest">Enrollments</span>
                        <button onClick={() => setGlobalConfig({...globalConfig, loginEnabled: !globalConfig.loginEnabled})} className={`w-16 h-8 rounded-full transition-all relative ${globalConfig.loginEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${globalConfig.loginEnabled ? 'left-9' : 'left-1'}`}></div>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs uppercase dark:text-white tracking-widest">Global Print</span>
                        <button onClick={() => setGlobalConfig({...globalConfig, xeroxEnabled: !globalConfig.xeroxEnabled})} className={`w-16 h-8 rounded-full transition-all relative ${globalConfig.xeroxEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${globalConfig.xeroxEnabled ? 'left-9' : 'left-1'}`}></div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-950 p-12 rounded-[3rem] text-white flex flex-col justify-center items-center text-center shadow-xl group">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center text-4xl mb-6 text-yellow-400 border border-white/10 animate-pulse"><i className="fa-solid fa-lock-open"></i></div>
                    <h4 className="text-2xl font-black uppercase tracking-tighter mb-2">Authority Active</h4>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Chain Hierarchy Rule: Strictly Enforced</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Users' && (role === 'MerchantProPlus' || role === 'Merchant') && (
            <div className="max-w-5xl mx-auto animate-enter space-y-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-4xl font-black uppercase tracking-tighter dark:text-white leading-none">
                    {role === 'MerchantProPlus' ? 'Global Hub Registry' : 'My Chain Customers'}
                  </h3>
                  <span className="px-5 py-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-[1rem] text-[9px] font-black uppercase tracking-[0.3em] border dark:border-blue-500/20">Active Sub-Nodes: {managedUsers.length}</span>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                    {managedUsers.map(u => (
                        <div key={u.phone} className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl flex flex-col xl:flex-row items-center justify-between border dark:border-slate-800 group relative transition-all duration-300 hover:border-sbi-blue/40">
                            {u.status === 'approved' && <div className="absolute top-0 right-0 w-3 h-full bg-emerald-500/30 rounded-r-[3.5rem]"></div>}
                            {u.status === 'pending' && <div className="absolute top-0 right-0 w-3 h-full bg-orange-500/30 animate-pulse rounded-r-[3.5rem]"></div>}
                            
                            <div className="flex items-center gap-8 mb-6 xl:mb-0 w-full xl:w-auto">
                                <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center text-4xl shadow-xl transition-all ${u.role === 'Merchant' ? 'bg-purple-600 text-white' : 'bg-sbi-blue text-white'}`}>
                                    <i className={`fa-solid ${u.role === 'Merchant' ? 'fa-user-tie' : 'fa-user'}`}></i>
                                </div>
                                <div className="flex-1">
                                    <p className="text-3xl font-black uppercase dark:text-white tracking-tighter mb-1">{u.name}</p>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{u.role} Node • {u.phone}</p>
                                    
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>{u.status}</span>
                                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.systemAccess ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>{u.systemAccess ? 'Link Active' : 'Link Dead'}</span>
                                      {role === 'MerchantProPlus' && (
                                        <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500">Sponsor: {u.registeredBy || 'Master'}</span>
                                      )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-8 items-center w-full xl:w-auto">
                              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[2rem] flex gap-8 border dark:border-slate-700 shadow-inner">
                                <div className="flex flex-col items-center gap-2">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Print</span>
                                  <button onClick={() => toggleServiceAccess(u.phone, ServiceType.XEROX)} className={`w-12 h-6.5 rounded-full transition-all relative ${u.allowedServices?.includes(ServiceType.XEROX) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <div className={`absolute top-0.5 w-5.5 h-5.5 bg-white rounded-full transition-all ${u.allowedServices?.includes(ServiceType.XEROX) ? 'left-6' : 'left-0.5'}`}></div>
                                  </button>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Kirana</span>
                                  <button onClick={() => toggleServiceAccess(u.phone, ServiceType.KIRANA_ORDER)} className={`w-12 h-6.5 rounded-full transition-all relative ${u.allowedServices?.includes(ServiceType.KIRANA_ORDER) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <div className={`absolute top-0.5 w-5.5 h-5.5 bg-white rounded-full transition-all ${u.allowedServices?.includes(ServiceType.KIRANA_ORDER) ? 'left-6' : 'left-0.5'}`}></div>
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-col gap-3 min-w-[180px]">
                                {u.status === 'pending' && (
                                  <button onClick={() => approveNode(u.phone, 'approved')} className="px-6 py-3.5 bg-emerald-600 text-white rounded-[1.2rem] font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Verify Node</button>
                                )}
                                <button onClick={() => toggleUserAccess(u.phone)} className={`px-6 py-3.5 rounded-[1.2rem] font-black text-[10px] uppercase shadow-xl transition-all ${u.systemAccess ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-sbi-blue text-white'}`}>
                                  {u.systemAccess ? 'Kill Signal' : 'Restore Signal'}
                                </button>
                                <button onClick={() => approveNode(u.phone, 'rejected')} className="text-[9px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors">Expunge Node</button>
                              </div>
                            </div>
                        </div>
                    ))}
                    {managedUsers.length === 0 && <div className="p-32 text-center text-slate-300 font-black uppercase tracking-[0.5em] text-3xl animate-pulse">Chain Registry Empty</div>}
                </div>
            </div>
          )}

          {activeTab === 'XeroxHub' && (
            <div className="max-w-3xl mx-auto animate-enter">
                <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-16 shadow-2xl border dark:border-slate-800">
                    <h3 className="text-4xl font-black uppercase tracking-tighter mb-10 dark:text-white flex items-center gap-5">
                        <i className="fa-solid fa-file-export text-orange-500"></i> Print Protocol Signal
                    </h3>
                    <div className="space-y-10">
                        <div className="grid grid-cols-2 gap-8">
                            <button onClick={() => setXeroxForm({...xeroxForm, variant: 'BW'})} className={`p-8 rounded-[2.5rem] font-black uppercase text-xs transition-all border-4 flex flex-col items-center gap-3 ${xeroxForm.variant === 'BW' ? 'bg-orange-600 border-orange-600 text-white shadow-xl scale-105' : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-400'}`}>
                              <i className="fa-solid fa-droplet-slash text-2xl"></i>
                              B&W (₹2)
                            </button>
                            <button onClick={() => setXeroxForm({...xeroxForm, variant: 'Color'})} className={`p-8 rounded-[2.5rem] font-black uppercase text-xs transition-all border-4 flex flex-col items-center gap-3 ${xeroxForm.variant === 'Color' ? 'bg-orange-600 border-orange-600 text-white shadow-xl scale-105' : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-400'}`}>
                              <i className="fa-solid fa-droplet text-2xl"></i>
                              Color (₹10)
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-6 text-slate-400">Print Quantity</label>
                            <input type="number" className="w-full p-6 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-[2rem] font-black text-3xl dark:text-white outline-none shadow-inner" value={xeroxForm.quantity} onChange={e => setXeroxForm({...xeroxForm, quantity: parseInt(e.target.value)})} />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-6 text-slate-400">Signal Source</label>
                            <select className="w-full p-6 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-[2rem] font-black uppercase text-[10px] dark:text-white outline-none" value={xeroxForm.sourcePlatform} onChange={e => setXeroxForm({...xeroxForm, sourcePlatform: e.target.value})}>
                                <option value="WhatsApp">WhatsApp Link</option>
                                <option value="Email">Mail Server</option>
                                <option value="Cloud">Cloud Storage</option>
                            </select>
                          </div>
                        </div>
                        <button onClick={submitXerox} className="w-full p-8 bg-orange-600 text-white rounded-[3rem] font-black uppercase text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all">Transmit Task Signal</button>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'History' && (
            <div className="max-w-5xl mx-auto animate-enter space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-4xl font-black uppercase tracking-tighter dark:text-white">Central Chain Ledger</h3>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl overflow-hidden border dark:border-slate-800">
                    {transactions.filter(t => role === 'MerchantProPlus' || role === 'Merchant' || t.customerPhone === currentUser?.phone).map((tx, i) => (
                        <div key={tx.id} className={`p-10 flex items-center justify-between group transition-all duration-300 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 ${i !== 0 ? 'border-t dark:border-slate-800' : ''}`}>
                            <div className="flex items-center gap-8">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-[1.5rem] flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:bg-sbi-blue group-hover:text-white transition-all shadow-inner"><i className="fa-solid fa-receipt text-2xl"></i></div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{new Date(tx.timestamp).toLocaleString()}</p>
                                    <p className="text-2xl font-black uppercase dark:text-white tracking-tighter mb-1">{tx.description}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{tx.customerName} • {tx.category}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">₹{tx.amount}</p>
                                <span className="inline-block mt-3 text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full shadow-sm border border-emerald-500/10">Verified Signal</span>
                            </div>
                        </div>
                    ))}
                    {transactions.length === 0 && <div className="p-32 text-center font-black text-slate-200 dark:text-slate-800 uppercase tracking-[0.4em] text-3xl animate-pulse">Zero Flux Registered</div>}
                </div>
            </div>
          )}

          {activeTab === 'LadduBot' && (
            <div className="max-w-4xl mx-auto h-[75vh] flex flex-col animate-enter bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl overflow-hidden border dark:border-slate-800">
                <div className="p-8 bg-gradient-to-r from-sbi-blue to-blue-950 text-white flex items-center justify-between shadow-xl">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-3xl animate-bounce-subtle"><i className="fa-solid fa-robot"></i></div>
                      <div>
                          <h4 className="text-2xl font-black uppercase tracking-tighter mb-0.5">Laddu AI Central</h4>
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">Universal Hierarchy Assistant</p>
                      </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar bg-slate-50/30 dark:bg-slate-950/20">
                    {chatMessages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6">
                        <div className="w-32 h-32 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-5xl text-slate-400 dark:text-slate-600 mb-2 shadow-inner"><i className="fa-solid fa-comments"></i></div>
                        <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px] max-w-sm leading-loose">Hub Signal Ready. Transmit protocol input...</p>
                      </div>
                    )}
                    {chatMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-enter`}>
                            <div className={`max-w-[85%] p-6 rounded-[2.5rem] font-bold text-sm shadow-xl ${m.role === 'user' ? 'bg-sbi-blue text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 dark:text-white rounded-tl-none border dark:border-slate-700'}`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {isTyping && <div className="text-[10px] font-black text-sbi-blue dark:text-blue-400 uppercase tracking-[0.4em] animate-pulse ml-8">Analyzing signal logic...</div>}
                </div>
                <div className="p-8 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex gap-5 shadow-2xl">
                    <input 
                      className="flex-1 p-6 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-[2rem] border dark:border-slate-700 outline-none font-bold shadow-inner focus:ring-4 ring-blue-500/5 transition-all" 
                      placeholder="Input authority signal..." 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && sendMessageToLaddu()}
                    />
                    <button onClick={sendMessageToLaddu} className="w-16 h-16 bg-sbi-blue text-white rounded-full flex items-center justify-center text-2xl hover:scale-110 active:rotate-12 transition-all shadow-xl shadow-blue-600/30"><i className="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
          )}
        </main>
      </div>

      <div className="fixed bottom-12 right-12 z-[100] flex flex-col gap-5 w-80 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="p-8 bg-white/95 dark:bg-slate-900/95 border-l-[15px] border-sbi-blue shadow-2xl rounded-[2.5rem] animate-enter pointer-events-auto backdrop-blur-xl flex items-center justify-between border dark:border-slate-800">
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Authority Signal</p>
              <p className="text-xs font-black uppercase text-slate-800 dark:text-white leading-tight tracking-tight">{n.message}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/40 rounded-full flex items-center justify-center ml-6 border border-blue-500/10 shadow-inner">
              <i className="fa-solid fa-circle-check text-sbi-blue text-2xl"></i>
            </div>
          </div>
        ))}
      </div>
      
      {globalConfig.maintenanceMode && (
        <div className="fixed inset-0 z-[999] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-16 text-center">
          <div className="max-w-lg space-y-12 animate-pop">
            <div className="w-32 h-32 bg-red-600 rounded-full mx-auto flex items-center justify-center text-white text-6xl shadow-3xl animate-pulse border-[10px] border-red-500/20">
              <i className="fa-solid fa-lock"></i>
            </div>
            <h2 className="text-5xl font-black text-white uppercase tracking-tighter">SIGNAL SEVERED</h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] leading-relaxed">Central authority has terminated the signal chain. All hubs are offline.</p>
            {role === 'MerchantProPlus' && (
              <button onClick={() => setGlobalConfig({...globalConfig, maintenanceMode: false})} className="px-12 py-5 bg-white text-black rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-110 transition border-4 border-slate-200">RESTORE MASTER LINK</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;