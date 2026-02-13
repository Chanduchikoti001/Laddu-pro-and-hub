
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import { ServiceType, Transaction, Product, CSPLog, XeroxTask, AppNotification, BankingRequest, User } from './types';
import { INITIAL_PRODUCTS, MAJOR_INDIAN_BANKS } from './constants';
import { getStoreInsights, chatWithAi, speakText } from './services/geminiService';

const playNotificationSound = (type: AppNotification['type']) => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    if (type === 'success') {
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    } else {
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    }
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {}
};

const getStatusProgress = (status: string) => {
  switch (status) {
    case 'Waiting': return 10;
    case 'Approved': return 30;
    case 'Processing': return 60;
    case 'Ready': return 90;
    case 'Delivered': return 100;
    case 'Completed': return 100;
    default: return 0;
  }
};

const LandingPage: React.FC<{ onSelect: (role: 'Merchant' | 'Customer') => void }> = ({ onSelect }) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-enter">
    <div className="w-24 h-24 bg-orange-600 rounded-[32px] flex items-center justify-center text-4xl shadow-2xl mb-8 animate-wiggle">
      <i className="fa-solid fa-store text-white"></i>
    </div>
    <h1 className="text-4xl font-black text-white uppercase tracking-tighter text-center">LADDU KIRANA</h1>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 mb-16 text-center">Online Services & General Store</p>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
      <button 
        onClick={() => onSelect('Customer')}
        className="glass-card p-12 rounded-[56px] border-indigo-500/20 text-center group hover:border-indigo-500/50"
      >
        <div className="w-20 h-20 bg-indigo-600/10 text-indigo-400 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-user-tag"></i>
        </div>
        <h3 className="text-xl font-black text-white uppercase">LADDU HUB</h3>
        <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest leading-relaxed">
          For Customers: Send Xerox, Print, and Banking requests to the store.
        </p>
        <div className="mt-8 py-3 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
          Open Customer Portal
        </div>
      </button>

      <button 
        onClick={() => onSelect('Merchant')}
        className="glass-card p-12 rounded-[56px] border-orange-500/20 text-center group hover:border-orange-500/50"
      >
        <div className="w-20 h-20 bg-orange-600/10 text-orange-400 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-crown"></i>
        </div>
        <h3 className="text-xl font-black text-white uppercase">LADDU PRO</h3>
        <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest leading-relaxed">
          For Store Owner: Fulfill requests, track daily sales, and manage store data.
        </p>
        <div className="mt-8 py-3 bg-orange-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
          Enter Merchant Terminal
        </div>
      </button>
    </div>

    <div className="mt-20 flex flex-col items-center gap-4 opacity-40">
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5">
        <i className="fa-solid fa-shield-halved text-[10px] text-emerald-400"></i>
        <span className="text-[8px] font-black uppercase text-slate-300 tracking-widest">Device-Only Storage Active</span>
      </div>
      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">No Cloud Data Sync • Your Privacy Protected</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [role, setRole] = useState<'Merchant' | 'Customer' | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Kirana' | 'CSP' | 'Xerox' | 'Users' | 'History' | 'Profile'>('Dashboard');
  const [customerSubTab, setCustomerSubTab] = useState<'Transmissions' | 'Signals' | 'Profile'>('Transmissions');
  
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cspLogs, setCspLogs] = useState<CSPLog[]>([]);
  const [serviceQueue, setServiceQueue] = useState<XeroxTask[]>([]);
  const [xeroxHistory, setXeroxHistory] = useState<XeroxTask[]>([]);
  const [cspRequests, setCspRequests] = useState<BankingRequest[]>([]); 
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedTransactionForReceipt, setSelectedTransactionForReceipt] = useState<Transaction | null>(null);
  const [receiptConfig, setReceiptConfig] = useState({
    showCustomer: true,
    showSignalId: true,
    showNodeType: true,
    showTimestamp: true,
    showBankName: true,
    showFooter: true
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);

  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ 
    phone: '', name: '', email: '', address: '', password: '', profileImage: '' 
  });
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cspForm, setCspForm] = useState({ name: '', amount: 0, bank: '' });
  const [xeroxForm, setXeroxForm] = useState({ 
    service: 'Xerox' as XeroxTask['service'], variant: 'BW' as XeroxTask['variant'], qty: 1 
  });
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [searchProduct, setSearchProduct] = useState('');

  useEffect(() => {
    const load = (key: string, setter: (val: any) => void) => {
      const saved = localStorage.getItem(key);
      if (saved) setter(JSON.parse(saved));
    };
    load('laddu_users', setUsers);
    load('laddu_transactions', setTransactions);
    load('laddu_csp', setCspLogs);
    load('laddu_service_queue', setServiceQueue);
    load('laddu_xerox_history', setXeroxHistory);
    load('laddu_csp_requests', setCspRequests);
    const savedRole = localStorage.getItem('laddu_current_role');
    if (savedRole) setRole(savedRole as any);
    const savedAuth = localStorage.getItem('laddu_auth_user');
    if (savedAuth) {
      const authUser = JSON.parse(savedAuth);
      setCurrentUser(authUser);
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('laddu_users', JSON.stringify(users));
    localStorage.setItem('laddu_transactions', JSON.stringify(transactions));
    localStorage.setItem('laddu_csp', JSON.stringify(cspLogs));
    localStorage.setItem('laddu_service_queue', JSON.stringify(serviceQueue));
    localStorage.setItem('laddu_xerox_history', JSON.stringify(xeroxHistory));
    localStorage.setItem('laddu_csp_requests', JSON.stringify(cspRequests));
    if (role) localStorage.setItem('laddu_current_role', role);
  }, [users, transactions, cspLogs, serviceQueue, xeroxHistory, cspRequests, role]);

  // Smart Queue Logic: Automatically move Approved tasks to Processing if idle
  useEffect(() => {
    if (role === 'Merchant' && serviceQueue.length > 0) {
      const isAnythingProcessing = serviceQueue.some(j => j.status === 'Processing');
      if (!isAnythingProcessing) {
        const firstApprovedIndex = serviceQueue.findIndex(j => j.status === 'Approved');
        if (firstApprovedIndex !== -1) {
          const firstApproved = serviceQueue[firstApprovedIndex];
          setServiceQueue(prev => prev.map(j => j.id === firstApproved.id ? { ...j, status: 'Processing' } : j));
          addNotification(`Smart Queue: Job for ${firstApproved.customerName} started automatically.`, "info");
        }
      }
    }
  }, [serviceQueue, role]);

  const addNotification = useCallback((message: string, type: AppNotification['type'] = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    playNotificationSound(type);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  const handleLogin = () => {
    setLoginError(null);
    const user = users.find(u => u.phone === loginForm.username && u.password === loginForm.password);
    if (!user) return setLoginError("Invalid Login Credentials.");
    if (user.status === 'pending') return setLoginError("Awaiting Store Approval.");
    setIsLoggedIn(true);
    setCurrentUser(user);
    localStorage.setItem('laddu_auth_user', JSON.stringify(user));
    addNotification(`Welcome, ${user.name}`, "success");
  };

  const handleSignUp = () => {
    if (!signupForm.phone || !signupForm.name || !signupForm.password) return setLoginError("All fields are required.");
    if (users.some(u => u.phone === signupForm.phone)) return setLoginError("Phone number already registered.");
    
    const newUser: User = { 
      phone: signupForm.phone, 
      name: signupForm.name, 
      email: signupForm.email,
      address: signupForm.address,
      profileImage: signupForm.profileImage,
      password: signupForm.password, 
      status: 'pending', 
      role: 'Customer', 
      createdAt: Date.now() 
    };
    setUsers(prev => [...prev, newUser]);
    setIsSigningUp(false);
    setSignupForm({ phone: '', name: '', email: '', address: '', password: '', profileImage: '' });
    addNotification("Profile signal sent. Awaiting Store Approval.", "info");
  };

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraActive(false);
      addNotification("Camera access denied.", "error");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setSignupForm({ ...signupForm, profileImage: dataUrl });
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        setCameraActive(false);
      }
    }
  };

  const createXeroxJob = () => {
    if (!currentUser) return;
    const total = xeroxForm.qty * (xeroxForm.variant === 'Color' ? 10 : 2);
    const newTask: XeroxTask = {
      id: `XRX-${Date.now()}`,
      timestamp: Date.now(),
      customerName: currentUser.name,
      service: xeroxForm.service,
      variant: xeroxForm.variant,
      quantity: xeroxForm.qty,
      total,
      status: 'Waiting',
      paymentStatus: 'Unpaid',
      paperSize: 'A4',
      sides: 'Single',
      paperType: 'Standard',
      finishing: 'None',
      deadline: 'ASAP',
      isPriority: false,
      rate: total / xeroxForm.qty
    };
    setServiceQueue(prev => [...prev, newTask]);
    addNotification("Service signal transmitted to store.", "success");
  };

  const createBankingRequest = () => {
    if (!cspForm.amount || !currentUser) return;
    const newReq: BankingRequest = {
      id: `BNK-${Date.now()}`,
      timestamp: Date.now(),
      customerName: currentUser.name,
      type: 'Withdraw',
      amount: cspForm.amount,
      status: 'Queued'
    };
    setCspRequests(prev => [...prev, newReq]);
    addNotification("Banking signal broadcasted.", "success");
    setCspForm({ name: '', amount: 0, bank: '' });
  };

  const completeKiranaSale = (method: Transaction['paymentMethod']) => {
    const total = cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
    if (total <= 0) return;
    const newTx: Transaction = {
      id: `TX-${Date.now()}`,
      timestamp: Date.now(),
      type: ServiceType.KIRANA,
      description: `Kirana Sale`,
      amount: total,
      category: 'Groceries',
      paymentMethod: method,
      status: 'Paid'
    };
    setTransactions(prev => [newTx, ...prev]);
    setCart([]);
    setSelectedTransactionForReceipt(newTx);
    addNotification("Sale settled in ledger.", "success");
  };

  const totals = useMemo(() => ({
    revenue: transactions.reduce((acc, curr) => acc + curr.amount, 0),
  }), [transactions]);

  const userCounts = useMemo(() => ({
    pending: users.filter(u => u.status === 'pending').length,
  }), [users]);

  const handleApproveBanking = (id: string) => {
    setCspRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
    addNotification("Banking signal approved. Node ready for settlement.", "success");
  };

  const handleRejectBanking = (id: string) => {
    setCspRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Rejected' } : r));
    addNotification("Banking signal rejected.", "warning");
  };

  const handleApproveXerox = (id: string) => {
    setServiceQueue(prev => prev.map(j => j.id === id ? { ...j, status: 'Approved' } : j));
    addNotification("Xerox signal approved. Job queued for processing.", "success");
  };

  const handleRejectXerox = (id: string) => {
    setServiceQueue(prev => prev.map(j => j.id === id ? { ...j, status: 'Rejected' } : j));
    addNotification("Xerox signal rejected.", "warning");
  };

  const updateXeroxStatus = (id: string, status: XeroxTask['status']) => {
    setServiceQueue(prev => prev.map(j => j.id === id ? { ...j, status } : j));
    addNotification(`Job status updated: ${status}`, "info");
  };

  if (!role) return <LandingPage onSelect={setRole} />;

  return (
    <div className="min-h-screen pb-32 pt-12 px-4 md:px-8 max-w-7xl mx-auto relative z-10">
      
      {/* App Bar */}
      <div className="fixed top-0 left-0 w-full z-[100] no-print p-4">
        <div className="max-w-7xl mx-auto glass rounded-2xl p-3 flex items-center justify-between border-white/10 shadow-2xl">
           <div className="flex items-center gap-3 ml-2">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${role === 'Merchant' ? 'bg-orange-500' : 'bg-indigo-500'}`}></div>
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${role === 'Merchant' ? 'text-orange-400' : 'text-indigo-400'}`}>
                {role === 'Merchant' ? 'LADDU PRO TERMINAL' : 'LADDU HUB CLIENT'}
              </span>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={() => {setRole(null); setIsLoggedIn(false); setCurrentUser(null); localStorage.removeItem('laddu_current_role');}} className="text-[9px] font-black text-slate-500 hover:text-white uppercase flex items-center gap-2 transition-all">
                <i className="fa-solid fa-shuffle"></i> Switch
             </button>
             {isLoggedIn && (
               <button onClick={() => {setIsLoggedIn(false); setCurrentUser(null); localStorage.removeItem('laddu_auth_user');}} className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-2">
                  <i className="fa-solid fa-power-off"></i> Out
               </button>
             )}
           </div>
        </div>
      </div>

      <header className="mb-16 mt-8 animate-enter">
        <div className="flex items-center gap-5">
          <div className={`w-14 h-14 glass rounded-2xl flex items-center justify-center text-2xl shadow-2xl ${role === 'Merchant' ? 'text-orange-500' : 'text-indigo-400'}`}>
            <i className={`fa-solid ${role === 'Merchant' ? 'fa-bolt-lightning' : 'fa-satellite-dish'}`}></i>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">LADDU<span className={role === 'Merchant' ? 'text-orange-400' : 'text-indigo-400'}>{role === 'Merchant' ? 'PRO' : 'HUB'}</span></h1>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">{role === 'Merchant' ? 'Store Control Node' : 'Client Access Hub'}</p>
          </div>
        </div>
      </header>

      <main>
        {role === 'Customer' && !isLoggedIn ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="w-full max-w-lg glass-card p-10 rounded-[56px] border-white/10 shadow-2xl overflow-hidden">
              <h2 className="text-2xl font-black text-white uppercase text-center mb-8">{isSigningUp ? 'Join Store Hub' : 'Identify Hub Link'}</h2>
              {loginError && <p className="text-[10px] font-black text-rose-400 uppercase text-center mb-6">{loginError}</p>}
              {!isSigningUp ? (
                <div className="space-y-6">
                  <input className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500/50" placeholder="Phone Number" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
                  <input type="password" opacity-100 className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500/50" placeholder="Security Key" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
                  <button onClick={handleLogin} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Connect Hub</button>
                  <button onClick={() => setIsSigningUp(true)} className="w-full text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest pt-4">New Hub Registration</button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex justify-center mb-6">
                     <div className="relative group">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-white/5 border-2 border-dashed border-indigo-500/30 flex items-center justify-center">
                           {signupForm.profileImage ? (
                             <img src={signupForm.profileImage} className="w-full h-full object-cover" />
                           ) : (
                             <i className="fa-solid fa-user text-3xl text-indigo-400"></i>
                           )}
                        </div>
                        <button onClick={startCamera} className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs border-2 border-slate-900 group-hover:scale-110 transition-transform">
                           <i className="fa-solid fa-camera"></i>
                        </button>
                     </div>
                  </div>

                  {cameraActive && (
                    <div className="fixed inset-0 z-[2000] bg-black flex flex-col items-center justify-center p-6">
                      <video ref={videoRef} className="rounded-3xl w-full max-w-sm" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="mt-8 flex gap-4">
                        <button onClick={capturePhoto} className="px-10 py-5 bg-white text-black font-black uppercase rounded-full">Snap Photo</button>
                        <button onClick={() => setCameraActive(false)} className="px-10 py-5 bg-white/10 text-white font-black uppercase rounded-full">Cancel</button>
                      </div>
                    </div>
                  )}

                  <input className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none text-sm" placeholder="Full Legal Name" value={signupForm.name} onChange={e => setSignupForm({...signupForm, name: e.target.value})} />
                  <input className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none text-sm" placeholder="Mobile Node Number" value={signupForm.phone} onChange={e => setSignupForm({...signupForm, phone: e.target.value})} />
                  <input className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none text-sm" placeholder="Email Address" value={signupForm.email} onChange={e => setSignupForm({...signupForm, email: e.target.value})} />
                  <textarea className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none text-sm h-24" placeholder="Residential Address" value={signupForm.address} onChange={e => setSignupForm({...signupForm, address: e.target.value})} />
                  <input type="password" opacity-100 className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none text-sm" placeholder="Create Security Key" value={signupForm.password} onChange={e => setSignupForm({...signupForm, password: e.target.value})} />
                  <button onClick={handleSignUp} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase text-[11px] tracking-widest shadow-xl mt-4">Send Hub Profile Signal</button>
                  <button onClick={() => setIsSigningUp(false)} className="w-full text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest pt-4">Back to Login</button>
                </div>
              )}
            </div>
          </div>
        ) : role === 'Customer' ? (
          <div className="max-w-4xl mx-auto space-y-12 animate-enter">
            <div className="flex gap-4 justify-center">
              <button onClick={() => setCustomerSubTab('Transmissions')} className={`px-10 py-5 rounded-[32px] font-black uppercase text-[10px] transition-all ${customerSubTab === 'Transmissions' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'glass text-slate-500'}`}>Transmissions</button>
              <button onClick={() => setCustomerSubTab('Signals')} className={`px-10 py-5 rounded-[32px] font-black uppercase text-[10px] transition-all ${customerSubTab === 'Signals' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'glass text-slate-500'}`}>Signals</button>
              <button onClick={() => setCustomerSubTab('Profile')} className={`px-10 py-5 rounded-[32px] font-black uppercase text-[10px] transition-all ${customerSubTab === 'Profile' ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'glass text-slate-500'}`}>Profile Hub</button>
            </div>

            {customerSubTab === 'Transmissions' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-card p-10 rounded-[56px] border-emerald-500/20 space-y-8">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-4"><i className="fa-solid fa-print text-emerald-400"></i> Print Hub</h3>
                  <div className="space-y-6">
                    <select className="w-full p-4 bg-slate-900 border border-white/10 rounded-2xl text-white text-xs font-black outline-none" value={xeroxForm.service} onChange={e => setXeroxForm({...xeroxForm, service: e.target.value as any})}>
                      <option value="Xerox">Photocopy</option><option value="Print">Printout</option><option value="Scan">Digital Scan</option><option value="Online">Online Form</option>
                    </select>
                    <div className="grid grid-cols-2 gap-4">
                      <select className="w-full p-4 bg-slate-900 border border-white/10 rounded-2xl text-white text-xs font-black" value={xeroxForm.variant} onChange={e => setXeroxForm({...xeroxForm, variant: e.target.value as any})}><option value="BW">B&W</option><option value="Color">Color</option></select>
                      <input type="number" min="1" className="w-full p-4 bg-slate-900 border border-white/10 rounded-2xl text-white text-xs font-black" value={xeroxForm.qty} onChange={e => setXeroxForm({...xeroxForm, qty: parseInt(e.target.value) || 1})} />
                    </div>
                    <button onClick={createXeroxJob} className="w-full py-6 bg-emerald-600 text-white rounded-[28px] font-black uppercase text-[12px] shadow-lg active:scale-95 transition-transform">Transmit Signal</button>
                  </div>
                </div>
                <div className="glass-card p-10 rounded-[56px] border-blue-500/20 space-y-8">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-4"><i className="fa-solid fa-landmark text-blue-400"></i> Fintech Node</h3>
                  <div className="space-y-8">
                    <input type="number" className="w-full p-8 bg-white/5 border border-white/10 rounded-[32px] text-white font-black text-4xl text-center outline-none" placeholder="₹ 0.00" value={cspForm.amount || ''} onChange={e => setCspForm({...cspForm, amount: parseFloat(e.target.value) || 0, bank: cspForm.bank})} />
                    <button onClick={createBankingRequest} className="w-full py-6 bg-blue-600 text-white rounded-[28px] font-black uppercase text-[12px] shadow-lg active:scale-95 transition-transform">Broadcast Withdrawal</button>
                  </div>
                </div>
              </div>
            )}

            {customerSubTab === 'Signals' && (
              <div className="glass-card p-10 rounded-[56px] border-white/5 space-y-6">
                <h4 className="text-[12px] font-black uppercase text-indigo-400 tracking-[0.4em] flex items-center gap-3">Active Signal Pulse</h4>
                <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
                  {serviceQueue.filter(j => j.customerName === currentUser?.name).map(j => (
                    <div key={j.id} className="p-8 glass rounded-[40px] flex justify-between items-center border border-white/5 group">
                      <div className="flex gap-5 items-center">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl"><i className="fa-solid fa-print"></i></div>
                        <div><p className="text-lg font-black text-white">{j.service} ({j.variant})</p><p className="text-[9px] text-slate-500 font-black uppercase mt-1">{new Date(j.timestamp).toLocaleTimeString()} • Signal ID: {j.id.split('-')[1]}</p></div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-6 py-2 rounded-2xl ${j.status === 'Ready' || j.status === 'Approved' || j.status === 'Processing' ? 'bg-emerald-600 text-white animate-pulse' : 'bg-white/10 text-slate-500'}`}>{j.status}</span>
                    </div>
                  ))}
                  {cspRequests.filter(r => r.customerName === currentUser?.name).map(r => (
                    <div key={r.id} className="p-8 glass rounded-[40px] flex justify-between items-center border border-white/5">
                      <div className="flex gap-5 items-center">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl"><i className="fa-solid fa-building-columns"></i></div>
                        <div><p className="text-lg font-black text-white">Banking: ₹{r.amount}</p><p className="text-[9px] text-slate-500 font-black uppercase mt-1">{new Date(r.timestamp).toLocaleTimeString()}</p></div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-6 py-2 rounded-2xl ${r.status === 'Approved' || r.status === 'Processing' ? 'bg-blue-600 text-white animate-pulse' : 'bg-white/10 text-slate-500'}`}>{r.status}</span>
                    </div>
                  ))}
                  {serviceQueue.filter(j => j.customerName === currentUser?.name).length === 0 && cspRequests.filter(r => r.customerName === currentUser?.name).length === 0 && (
                    <div className="py-20 text-center opacity-10 flex flex-col items-center gap-6"><i className="fa-solid fa-signal text-8xl"></i><p className="font-black uppercase tracking-[0.5em] text-xs">Waiting for Signal Sync</p></div>
                  )}
                </div>
              </div>
            )}

            {customerSubTab === 'Profile' && currentUser && (
              <div className="glass-card p-12 rounded-[56px] border-white/10 space-y-12 animate-in slide-in-from-bottom">
                 <div className="flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-600 shadow-2xl mb-8">
                       {currentUser.profileImage ? (
                         <img src={currentUser.profileImage} className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full bg-slate-800 flex items-center justify-center text-4xl text-indigo-400"><i className="fa-solid fa-user"></i></div>
                       )}
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{currentUser.name}</h2>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] mt-2">Active Hub Profile</p>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-12">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Phone Link</label>
                       <p className="w-full p-6 bg-white/5 rounded-[28px] text-white font-bold">{currentUser.phone}</p>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Email Axis</label>
                       <p className="w-full p-6 bg-white/5 rounded-[28px] text-white font-bold">{currentUser.email || 'None set'}</p>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Residential Matrix</label>
                       <p className="w-full p-6 bg-white/5 rounded-[28px] text-white font-bold">{currentUser.address || 'No address provided'}</p>
                    </div>
                 </div>
                 <div className="flex justify-center pt-8">
                    <button onClick={() => {setIsLoggedIn(false); setCurrentUser(null); localStorage.removeItem('laddu_auth_user');}} className="px-12 py-6 bg-rose-600 text-white font-black uppercase rounded-[32px] text-[11px] tracking-widest shadow-2xl active:scale-95 transition-all">Disconnect Profile</button>
                 </div>
              </div>
            )}
          </div>
        ) : (
          /* LADDU PRO: MERCHANT INTERFACE */
          <div className="space-y-12 animate-enter">
            {activeTab === 'Dashboard' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="glass-card p-12 rounded-[56px] border-emerald-500/20"><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Revenue Hub</p><p className="text-6xl font-black text-white mt-4 tracking-tighter">₹{totals.revenue.toLocaleString()}</p></div>
                    <div className="glass-card p-12 rounded-[56px] border-indigo-500/20 cursor-pointer" onClick={() => setActiveTab('Users')}><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Pending Onboarding</p><p className="text-6xl font-black text-white mt-4 tracking-tighter">{userCounts.pending}</p></div>
                  </div>
                  <div className="glass-card p-12 rounded-[56px] border-indigo-500/20 space-y-8">
                    <div className="flex justify-between items-center"><h3 className="text-xl font-black text-white uppercase tracking-tighter">Chain Intelligence</h3><button onClick={async () => {setIsAnalyzing(true); setAiInsights(await getStoreInsights(transactions, cspLogs)); setIsAnalyzing(false);}} className={`px-8 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase shadow-lg ${isAnalyzing ? 'animate-pulse' : ''}`}>{isAnalyzing ? 'Analyzing...' : 'Run Logic Audit'}</button></div>
                    {aiInsights?.insights && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom">
                        {aiInsights.insights.map((ins: any, i: number) => (
                          <div key={i} className="p-8 glass rounded-[40px] border-white/5 space-y-4"><h4 className="text-white font-black text-xs uppercase leading-tight">{ins.title}</h4><p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase">{ins.description}</p></div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-6">
                  <button onClick={() => setActiveTab('Kirana')} className="w-full p-10 glass-card rounded-[48px] flex items-center gap-8 group"><div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center text-3xl group-hover:scale-110 transition-all shadow-inner"><i className="fa-solid fa-cash-register"></i></div><div className="text-left"><span className="font-black uppercase text-sm text-white block">POS Terminal</span><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Master Kirana Ledger</span></div></button>
                  <button onClick={() => setActiveTab('Xerox')} className="w-full p-10 glass-card rounded-[48px] flex items-center gap-8 group relative"><div className="w-16 h-16 bg-orange-500/10 text-orange-400 rounded-3xl flex items-center justify-center text-3xl group-hover:scale-110 transition-all shadow-inner"><i className="fa-solid fa-print"></i></div><div className="text-left"><span className="font-black uppercase text-sm text-white block">Work Stream</span><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Task Fulfillment Node</span></div>{serviceQueue.length > 0 && <span className="absolute top-6 right-10 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-orange-600 text-[9px] font-black text-white items-center justify-center">{serviceQueue.length}</span></span>}</button>
                  <button onClick={() => setActiveTab('CSP')} className="w-full p-10 glass-card rounded-[48px] flex items-center gap-8 group relative"><div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-3xl flex items-center justify-center text-3xl group-hover:scale-110 transition-all shadow-inner"><i className="fa-solid fa-landmark"></i></div><div className="text-left"><span className="font-black uppercase text-sm text-white block">CSP Banking</span><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Financial Service Hub</span></div>{cspRequests.filter(r => r.status === 'Queued').length > 0 && <span className="absolute top-6 right-10 flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 text-[9px] font-black text-white items-center justify-center">{cspRequests.filter(r => r.status === 'Queued').length}</span></span>}</button>
                </div>
              </div>
            )}

            {activeTab === 'Kirana' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-enter">
                <div className="space-y-6">
                  <div className="glass p-8 rounded-[40px] flex items-center gap-4"><i className="fa-solid fa-search text-slate-500"></i><input className="bg-transparent border-none outline-none text-white font-bold w-full" placeholder="Search Store Inventory..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto no-scrollbar">
                    {INITIAL_PRODUCTS.filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase())).map(p => (
                      <div key={p.id} onClick={() => {
                        setCart(prev => {
                          const ex = prev.find(i => i.product.id === p.id);
                          if (ex) return prev.map(i => i.product.id === p.id ? {...i, quantity: i.quantity + 1} : i);
                          return [...prev, { product: p, quantity: 1 }];
                        });
                        addNotification(`${p.name} added to cart.`, "success");
                      }} className="p-10 glass-card rounded-[48px] cursor-pointer hover:border-emerald-500/50 group">
                        <h4 className="font-black text-white text-xl tracking-tight">{p.name}</h4><p className="text-emerald-400 font-black text-3xl mt-6">₹{p.price}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass-card p-12 rounded-[64px] border-emerald-500/20 flex flex-col h-[700px] shadow-2xl relative overflow-hidden">
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-10">Current Session Ledger</h3>
                   <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
                      {cart.map(item => (
                        <div key={item.product.id} className="flex justify-between items-center p-6 glass rounded-[36px] border-white/5 animate-in slide-in-from-right">
                           <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center font-black text-xs text-emerald-400">{item.quantity}x</div><div><p className="font-black text-white text-sm">{item.product.name}</p></div></div>
                           <div className="flex items-center gap-6"><span className="text-white font-black">₹{item.product.price * item.quantity}</span><button onClick={() => setCart(cart.filter(i => i.product.id !== item.product.id))} className="text-rose-500/50 hover:text-rose-500 transition-colors"><i className="fa-solid fa-circle-xmark"></i></button></div>
                        </div>
                      ))}
                      {cart.length === 0 && <div className="flex-1 flex flex-col items-center justify-center opacity-10 py-40"><i className="fa-solid fa-shopping-basket text-[100px] mb-6"></i><p className="font-black uppercase tracking-[0.5em] text-xs">Basket Empty</p></div>}
                   </div>
                   <div className="pt-10 border-t border-white/10 space-y-10">
                      <div className="flex justify-between items-end"><div><span className="text-slate-500 uppercase font-black text-[9px] tracking-widest block mb-2">Total Settle Value</span><span className="text-6xl font-black text-white tracking-tighter">₹{cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0)}</span></div></div>
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => completeKiranaSale('Cash')} className="py-6 bg-emerald-600 text-white rounded-[32px] font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all">Cash Settle</button>
                        <button onClick={() => completeKiranaSale('UPI')} className="py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all">UPI Node</button>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'Xerox' && (
              <div className="space-y-12 animate-enter">
                <div className="flex justify-between items-center border-b border-white/10 pb-6">
                  <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Work Stream Node</h2>
                  <div className="flex gap-4">
                     <span className="px-4 py-2 glass rounded-full text-[9px] font-black uppercase tracking-widest text-orange-400">Live Signals: {serviceQueue.length}</span>
                  </div>
                </div>
                {serviceQueue.map(job => (
                  <div key={job.id} className={`p-10 glass-card rounded-[64px] border-2 transition-all duration-500 ${job.status === 'Ready' ? 'border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : 'border-orange-500/20'}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
                       <div className="space-y-6">
                          <p className="text-2xl font-black text-white tracking-tight">{job.customerName}</p>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                             <div className={`h-full transition-all duration-1000 ease-in-out ${job.status === 'Ready' ? 'bg-emerald-500' : job.status === 'Processing' ? 'bg-orange-500 animate-pulse' : 'bg-slate-700'}`} style={{ width: `${getStatusProgress(job.status)}%` }}></div>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">PHASE STATUS:</span>
                             <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${job.status === 'Rejected' ? 'text-rose-500' : 'text-orange-400'}`}>
                               {job.status === 'Processing' && <i className="fa-solid fa-spinner animate-spin text-[8px]"></i>}
                               {job.status}
                             </span>
                          </div>
                       </div>
                       <div className="space-y-2 flex flex-col justify-center">
                         <div className="flex gap-4">
                            <span className="px-4 py-1 rounded-full bg-white/5 text-[10px] font-black uppercase text-white tracking-widest border border-white/10">{job.service}</span>
                            <span className="px-4 py-1 rounded-full bg-orange-600 text-[10px] font-black uppercase text-white tracking-widest">{job.variant}</span>
                         </div>
                         <p className="text-[14px] text-slate-400 font-bold uppercase mt-4">Units: {job.quantity} • Rate: ₹{job.rate} • Total: ₹{job.total}</p>
                       </div>
                       <div className="flex gap-3 flex-col">
                          {job.status === 'Waiting' && (
                             <div className="flex gap-2">
                                <button onClick={() => handleApproveXerox(job.id)} className="flex-1 py-5 bg-emerald-600 text-white rounded-[24px] text-[10px] font-black uppercase shadow-xl transition-all hover:bg-emerald-500 active:scale-95">Approve Job</button>
                                <button onClick={() => handleRejectXerox(job.id)} className="w-16 py-5 bg-rose-600 text-white rounded-[24px] flex items-center justify-center transition-all hover:bg-rose-500 active:scale-95"><i className="fa-solid fa-xmark"></i></button>
                             </div>
                          )}
                          {job.status === 'Approved' && <button onClick={() => updateXeroxStatus(job.id, 'Processing')} className="w-full py-5 bg-blue-600 text-white rounded-[24px] text-[10px] font-black uppercase shadow-xl transition-all">Start Processing</button>}
                          {job.status === 'Processing' && <button onClick={() => updateXeroxStatus(job.id, 'Ready')} className="w-full py-5 bg-emerald-600 text-white rounded-[24px] text-[10px] font-black uppercase shadow-xl transition-all">Complete Logic</button>}
                          {job.status === 'Ready' && <button onClick={() => {
                             const tx: Transaction = { id: `TX-${Date.now()}`, timestamp: Date.now(), type: ServiceType.XEROX, description: `${job.service} Fulfillment`, amount: job.total, category: 'Services', paymentMethod: 'Cash', status: 'Paid', customerName: job.customerName, note: 'Job Completed Successfully' };
                             setTransactions(prev => [tx, ...prev]);
                             setXeroxHistory(prev => [{...job, status: 'Delivered'}, ...prev]);
                             setServiceQueue(prev => prev.filter(j => j.id !== job.id));
                             setSelectedTransactionForReceipt(tx);
                             addNotification("Task finalized and archived.", "success");
                          }} className="w-full py-5 bg-emerald-600 text-white rounded-[24px] text-[10px] font-black uppercase shadow-2xl transition-all animate-pulse shadow-emerald-500/20">Deliver & Settle</button>}
                          
                          {job.status !== 'Waiting' && job.status !== 'Delivered' && (
                             <div className="mt-2 space-y-1">
                                <label className="text-[7px] font-black text-slate-600 uppercase tracking-widest ml-4">Manual Status Override</label>
                                <select 
                                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase text-slate-400 outline-none hover:border-white/20 transition-all"
                                  value={job.status}
                                  onChange={(e) => updateXeroxStatus(job.id, e.target.value as any)}
                                >
                                   <option value="Approved">Approved</option>
                                   <option value="Processing">Processing</option>
                                   <option value="Ready">Ready</option>
                                </select>
                             </div>
                          )}
                          
                          <button onClick={() => setServiceQueue(prev => prev.filter(j => j.id !== job.id))} className="w-full py-3 text-rose-500 text-[9px] font-black uppercase tracking-widest opacity-20 hover:opacity-100 transition-opacity mt-2">Force Purge Signal</button>
                       </div>
                    </div>
                  </div>
                ))}
                {serviceQueue.length === 0 && <div className="text-center py-48 opacity-10 flex flex-col items-center gap-8"><i className="fa-solid fa-signal text-9xl"></i><p className="font-black uppercase tracking-[1em] text-xs">Waiting for Incoming Hub Signals</p></div>}
              </div>
            )}

            {activeTab === 'CSP' && (
              <div className="space-y-12 animate-enter">
                <div className="flex justify-between items-center border-b border-white/10 pb-6">
                  <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Fintech Settlement Hub</h2>
                  <div className="flex gap-4">
                     <span className="px-4 py-2 glass rounded-full text-[9px] font-black uppercase tracking-widest text-blue-400">Claims: {cspRequests.length}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {cspRequests.map(req => (
                    <div key={req.id} className={`p-10 glass-card rounded-[64px] border-2 transition-all duration-500 ${req.status === 'Approved' ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-blue-500/20'}`}>
                      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-8 flex-1">
                          <div className={`w-20 h-20 rounded-[32px] flex items-center justify-center text-3xl shadow-inner ${req.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-600/10 text-blue-400'}`}>
                            <i className="fa-solid fa-building-columns"></i>
                          </div>
                          <div>
                            <p className="text-3xl font-black text-white tracking-tighter">{req.customerName}</p>
                            <div className="flex items-center gap-4 mt-2">
                               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Type: {req.type}</span>
                               <span className={`text-[10px] font-black uppercase tracking-widest ${req.status === 'Queued' ? 'text-slate-500' : 'text-emerald-400'}`}>Status: {req.status}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-center md:text-right px-10">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Claim Value</p>
                          <p className="text-5xl font-black text-white tracking-tighter">₹{req.amount}</p>
                        </div>
                        <div className="flex flex-col gap-3 w-full md:w-auto">
                          {req.status === 'Queued' && (
                            <div className="flex gap-2">
                               <button onClick={() => handleApproveBanking(req.id)} className="px-10 py-5 bg-emerald-600 text-white rounded-[24px] text-[10px] font-black uppercase shadow-xl hover:bg-emerald-500 active:scale-95 transition-all">Approve</button>
                               <button onClick={() => handleRejectBanking(req.id)} className="w-14 h-14 bg-rose-600 text-white rounded-[24px] flex items-center justify-center transition-all active:scale-95"><i className="fa-solid fa-xmark"></i></button>
                            </div>
                          )}
                          {(req.status === 'Approved' || req.status === 'Processing') && (
                            <button onClick={() => {
                              setCspForm({ ...cspForm, name: req.customerName, amount: req.amount });
                              setCspRequests(prev => prev.map(r => r.id === req.id ? {...r, status: 'Processing'} : r));
                              setActiveTab('Kirana'); // Use Kirana POS to settle
                              addNotification("Transitioning to Settle Ledger...", "info");
                            }} className="px-12 py-5 bg-blue-600 text-white rounded-[24px] text-[10px] font-black uppercase shadow-xl hover:bg-blue-500 transition-all active:scale-95 animate-pulse">Initiate Settlement</button>
                          )}
                          <button onClick={() => setCspRequests(prev => prev.filter(r => r.id !== req.id))} className="text-[9px] font-black text-slate-600 hover:text-rose-500 uppercase tracking-widest transition-colors mt-2">Purge Request</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {cspRequests.length === 0 && (
                    <div className="text-center py-48 opacity-10 flex flex-col items-center gap-8"><i className="fa-solid fa-landmark text-9xl"></i><p className="font-black uppercase tracking-[1em] text-xs">Waiting for Banking Signals</p></div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Users' && (
              <div className="space-y-12 animate-enter">
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Hub Signal Onboarding</h2>
                <div className="grid grid-cols-1 gap-8 pb-20">
                    {users.filter(u => u.status === 'pending').map(u => (
                      <div key={u.phone} className="p-12 glass-card rounded-[64px] border-white/10 flex flex-col gap-10 hover:border-indigo-500/50 transition-all duration-500 animate-in slide-in-from-bottom">
                         <div className="flex items-center gap-8">
                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-600 bg-slate-800 flex items-center justify-center">
                               {u.profileImage ? <img src={u.profileImage} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user text-4xl text-indigo-400"></i>}
                            </div>
                            <div className="flex-1">
                               <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{u.name}</h3>
                               <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mt-2">Mobile Node: {u.phone}</p>
                            </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-8 rounded-[40px]">
                            <div><label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Email Link</label><p className="text-sm font-bold text-white">{u.email || 'N/A'}</p></div>
                            <div><label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Residential Matrix</label><p className="text-sm font-bold text-white">{u.address || 'N/A'}</p></div>
                         </div>
                         <div className="flex gap-4"><button onClick={() => setUsers(users.map(us => us.phone === u.phone ? {...us, status: 'approved'} : us))} className="flex-1 py-6 bg-emerald-600 text-white rounded-[32px] text-[11px] font-black uppercase shadow-xl active:scale-95 transition-all">Approve Entry</button><button onClick={() => setUsers(users.filter(us => us.phone !== u.phone))} className="flex-1 py-6 bg-rose-600 text-white rounded-[32px] text-[11px] font-black uppercase shadow-xl active:scale-95 transition-all">Reject Signal</button></div>
                      </div>
                    ))}
                    {users.filter(u => u.status === 'pending').length === 0 && <div className="text-center py-48 opacity-10 flex flex-col items-center gap-8"><i className="fa-solid fa-users-slash text-9xl"></i><p className="font-black uppercase tracking-[1em] text-xs">Queue Clear</p></div>}
                </div>
              </div>
            )}
            
            {activeTab === 'Profile' && (
              <div className="glass-card p-12 rounded-[56px] border-orange-500/20 space-y-12 animate-in zoom-in">
                 <div className="text-center">
                    <div className="w-32 h-32 bg-orange-600 rounded-[40px] flex items-center justify-center mx-auto mb-8 text-5xl shadow-2xl shadow-orange-600/20"><i className="fa-solid fa-bolt-lightning text-white"></i></div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Merchant Root Control</h2>
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.5em] mt-2">Authorized Pro Instance</p>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-8 glass rounded-[40px] text-center"><i className="fa-solid fa-shield-halved text-2xl text-emerald-400 mb-4"></i><p className="text-[10px] font-black text-white uppercase">Device Vault Active</p></div>
                    <div className="p-8 glass rounded-[40px] text-center"><i className="fa-solid fa-database text-2xl text-blue-400 mb-4"></i><p className="text-[10px] font-black text-white uppercase">Local Ledger Only</p></div>
                    <div className="p-8 glass rounded-[40px] text-center"><i className="fa-solid fa-satellite text-2xl text-orange-400 mb-4"></i><p className="text-[10px] font-black text-white uppercase">Hub Transmissions Enabled</p></div>
                 </div>
                 <div className="flex justify-center pt-8">
                    <button onClick={() => {setRole(null); setIsLoggedIn(false); setCurrentUser(null); localStorage.removeItem('laddu_auth_user'); localStorage.removeItem('laddu_current_role');}} className="px-12 py-6 bg-white/5 border border-white/10 text-white font-black uppercase rounded-[32px] text-[11px] tracking-widest hover:bg-white/10 transition-all">Exit Pro Terminal</button>
                 </div>
              </div>
            )}
            
            {activeTab === 'History' && (
              <div className="space-y-12 animate-enter">
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Master Store Archive</h2>
                <div className="space-y-4 pb-20">
                   {transactions.map(tx => (
                     <div key={tx.id} onClick={() => setSelectedTransactionForReceipt(tx)} className="group p-8 glass-card rounded-[48px] flex justify-between items-center cursor-pointer border-white/5 hover:border-white/20 transition-all duration-300">
                        <div className="flex gap-8 items-center">
                          <div className={`w-16 h-16 rounded-[28px] flex items-center justify-center text-white text-2xl shadow-xl ${tx.type === ServiceType.KIRANA ? 'bg-emerald-500' : 'bg-orange-600'}`}>
                            <i className={`fa-solid ${tx.type === ServiceType.KIRANA ? 'fa-cart-shopping' : 'fa-print'}`}></i>
                          </div>
                          <div>
                            <p className="text-2xl font-black text-white tracking-tighter">{tx.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                               <span className="text-[10px] text-slate-500 uppercase font-black">{new Date(tx.timestamp).toLocaleString()}</span>
                               {tx.customerName && <span className="text-[10px] text-indigo-400 uppercase font-black">• {tx.customerName}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-black text-white tracking-tighter">₹{tx.amount}</p>
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">SETTLED</span>
                        </div>
                     </div>
                   ))}
                   {transactions.length === 0 && <div className="text-center py-48 opacity-10 flex flex-col items-center gap-8"><i className="fa-solid fa-receipt text-9xl"></i><p className="font-black uppercase tracking-[1em] text-xs">No Records Found</p></div>}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Persistent Navigation */}
      {isLoggedIn && (
        <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[94%] max-w-2xl glass p-3.5 rounded-[64px] flex justify-around no-print z-50 shadow-2xl border-white/10 animate-enter">
           {role === 'Merchant' ? (
             ['Dashboard', 'Kirana', 'Xerox', 'CSP', 'Users', 'History', 'Profile'].map(id => (
               <button key={id} onClick={() => setActiveTab(id as any)} className={`w-14 md:w-16 h-14 md:h-16 flex flex-col items-center justify-center transition-all duration-300 relative ${activeTab === id ? `text-white active-pill` : 'text-slate-600 hover:text-white'}`}>
                 <i className={`fa-solid ${id === 'Dashboard' ? 'fa-house' : id === 'Kirana' ? 'fa-basket-shopping' : id === 'Xerox' ? 'fa-print' : id === 'CSP' ? 'fa-landmark' : id === 'Users' ? 'fa-users-gear' : id === 'Profile' ? 'fa-user-gear' : 'fa-receipt'} text-base md:text-xl`}></i>
                 <span className="text-[6px] md:text-[7px] font-black uppercase mt-1 md:mt-2 tracking-widest">{id}</span>
               </button>
             ))
           ) : (
             ['Transmissions', 'Signals', 'Profile'].map(id => (
               <button key={id} onClick={() => setCustomerSubTab(id as any)} className={`w-16 h-16 flex flex-col items-center justify-center transition-all duration-300 relative ${customerSubTab === id ? `text-white active-pill` : 'text-slate-600 hover:text-white'}`}>
                 <i className={`fa-solid ${id === 'Transmissions' ? 'fa-satellite-dish' : id === 'Signals' ? 'fa-signal' : id === 'Profile' ? 'fa-user-tag' : 'fa-user-tag'} text-xl`}></i>
                 <span className="text-[7px] font-black uppercase mt-2 tracking-widest">{id}</span>
               </button>
             ))
           )}
        </nav>
      )}

      {/* Notification Layer */}
      <div className="fixed top-8 right-8 z-[1500] space-y-4 pointer-events-none w-[320px]">
         {notifications.map(n => (
            <div key={n.id} className="p-8 rounded-[40px] glass flex items-center gap-6 border-2 animate-in slide-in-from-right pointer-events-auto shadow-2xl transition-all duration-500 border-white/10">
               <p className="text-[12px] font-black uppercase text-white tracking-widest">{n.message}</p>
            </div>
         ))}
      </div>

      {/* Enhanced 58mm Receipt Modal */}
      {selectedTransactionForReceipt && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/95 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in overflow-y-auto">
           <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-10">
              
              {/* Customization Panel */}
              <div className="flex-1 glass-card p-10 rounded-[56px] border-white/10 space-y-8 no-print h-fit">
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter">Receipt Node Config</h3>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Customize your 58mm thermal printout by toggling visible fields below.</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { id: 'showCustomer', label: 'Customer Name', icon: 'fa-user' },
                      { id: 'showSignalId', label: 'Signal ID', icon: 'fa-hashtag' },
                      { id: 'showNodeType', label: 'Node Type', icon: 'fa-microchip' },
                      { id: 'showTimestamp', label: 'Timestamp', icon: 'fa-clock' },
                      { id: 'showBankName', label: 'Bank Name', icon: 'fa-landmark' },
                      { id: 'showFooter', label: 'Status Footer', icon: 'fa-check-circle' }
                    ].map(field => (
                       <button 
                         key={field.id} 
                         onClick={() => setReceiptConfig(prev => ({ ...prev, [field.id]: !prev[field.id as keyof typeof receiptConfig] }))}
                         className={`p-6 rounded-[32px] border-2 flex items-center gap-4 transition-all ${receiptConfig[field.id as keyof typeof receiptConfig] ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}
                       >
                         <i className={`fa-solid ${field.icon} text-sm`}></i>
                         <span className="text-[10px] font-black uppercase tracking-widest">{field.label}</span>
                       </button>
                    ))}
                 </div>
                 <div className="pt-6 border-t border-white/5 flex gap-4">
                    <button onClick={() => window.print()} className="flex-1 py-6 bg-white text-slate-950 rounded-[32px] font-black uppercase text-[10px] tracking-widest transition-all hover:bg-slate-100 shadow-2xl active:scale-95">Print 58mm Link</button>
                    <button onClick={() => setSelectedTransactionForReceipt(null)} className="flex-1 py-6 bg-rose-600 text-white rounded-[32px] font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">Close Instance</button>
                 </div>
              </div>

              {/* 58mm Thermal Preview Container */}
              <div className="w-[300px] mx-auto lg:mx-0 shrink-0">
                 <div className="bg-white text-slate-950 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)] print:shadow-none print:w-[58mm] print:p-2 print:mx-0 rounded-[20px] print:rounded-none relative font-mono overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-950/5 print:hidden"></div>
                    
                    {/* Header */}
                    <div className="text-center border-b-2 border-dashed border-slate-200 pb-4 mb-4">
                       <h2 className="text-lg font-black uppercase tracking-tighter leading-tight">LADDU KIRANA</h2>
                       <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Settle Receipt Node</p>
                    </div>

                    {/* Transaction Details */}
                    <div className="space-y-4">
                       <div className="text-center py-4">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Settle Value</p>
                          <p className="text-4xl font-black tracking-tighter">₹{selectedTransactionForReceipt.amount}</p>
                       </div>

                       <div className="space-y-2 border-t border-dashed border-slate-200 pt-4">
                          {receiptConfig.showCustomer && selectedTransactionForReceipt.customerName && (
                             <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">Hub Client:</span>
                                <span className="text-right">{selectedTransactionForReceipt.customerName}</span>
                             </div>
                          )}
                          {receiptConfig.showSignalId && (
                             <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">Signal ID:</span>
                                <span>{selectedTransactionForReceipt.id.split('-')[1]}</span>
                             </div>
                          )}
                          {receiptConfig.showNodeType && (
                             <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">Node Type:</span>
                                <span>{selectedTransactionForReceipt.type}</span>
                             </div>
                          )}
                          {receiptConfig.showBankName && selectedTransactionForReceipt.bankName && (
                             <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">Bank Hub:</span>
                                <span className="text-right">{selectedTransactionForReceipt.bankName}</span>
                             </div>
                          )}
                          {receiptConfig.showTimestamp && (
                             <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                                <span className="text-slate-400">Timestamp:</span>
                                <span>{new Date(selectedTransactionForReceipt.timestamp).toLocaleDateString()}</span>
                             </div>
                          )}
                       </div>

                       {receiptConfig.showFooter && (
                          <div className="pt-6 text-center border-t border-dashed border-slate-200">
                             <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1">SETTLE CONFIRMED</p>
                             <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Local-First Ledger Sync</p>
                          </div>
                       )}

                       <div className="pt-4 flex justify-center opacity-20">
                          <i className="fa-solid fa-barcode text-2xl"></i>
                       </div>
                    </div>

                    {/* Perforated edge look for UI only */}
                    <div className="absolute bottom-0 left-0 w-full h-2 flex gap-1 print:hidden">
                       {Array.from({ length: 20 }).map((_, i) => (
                         <div key={i} className="flex-1 h-full bg-slate-950 rounded-t-full"></div>
                       ))}
                    </div>
                 </div>
                 <p className="text-center text-[8px] font-black text-slate-600 uppercase tracking-widest mt-6 no-print">58mm Thermal Settle Preview</p>
              </div>

           </div>
        </div>
      )}

      {/* Floating AI Helper */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} className={`fixed bottom-28 right-6 w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl shadow-2xl z-[900] hover:scale-110 active:scale-95 transition-all no-print ${role === 'Merchant' ? 'bg-orange-600' : 'bg-indigo-600'}`}>
        <i className={`fa-solid ${isChatOpen ? 'fa-xmark' : 'fa-sparkles'}`}></i>
      </button>

      {isChatOpen && (
        <div className="fixed bottom-28 right-6 w-[92%] md:w-[450px] h-[600px] glass-card rounded-[56px] border-indigo-500/40 z-[1000] flex flex-col overflow-hidden animate-in slide-in-from-bottom shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
           <div className={`p-8 text-white flex justify-between items-center ${role === 'Merchant' ? 'bg-orange-600' : 'bg-indigo-600'}`}>
              <span className="font-black uppercase tracking-widest text-xs">Laddu AI Engine</span>
              <button onClick={() => setIsChatOpen(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"><i className="fa-solid fa-xmark"></i></button>
           </div>
           <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar bg-slate-950/40">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in`}>
                   <div className={`max-w-[85%] p-6 rounded-[36px] ${msg.role === 'user' ? (role === 'Merchant' ? 'bg-orange-600' : 'bg-indigo-600') : 'bg-white/5 border border-white/10 text-white'}`}><p className="text-[11px] font-bold leading-relaxed">{msg.text}</p></div>
                </div>
              ))}
              {chatMessages.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-20 text-center gap-6"><i className="fa-solid fa-comments text-7xl"></i><p className="font-black uppercase tracking-[0.4em] text-[10px] px-10 leading-loose">Ask Gemini about store metrics or onboarding.</p></div>}
           </div>
           <div className="p-8 bg-slate-900 border-t border-white/10 flex items-center gap-4">
              <input className="flex-1 bg-white/5 border border-white/10 rounded-[28px] p-5 text-xs font-bold text-white outline-none" placeholder="Ask AI..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (async () => {
                if(!chatInput.trim()) return;
                const userMsg = chatInput;
                setChatMessages(p => [...p, {role: 'user', text: userMsg}]);
                setChatInput('');
                const res = await chatWithAi({message: userMsg});
                setChatMessages(p => [...p, {role: 'ai', text: res.text}]);
              })()} />
              <button onClick={async () => {
                if(!chatInput.trim()) return;
                const userMsg = chatInput;
                setChatMessages(p => [...p, {role: 'user', text: userMsg}]);
                setChatInput('');
                const res = await chatWithAi({message: userMsg});
                setChatMessages(p => [...p, {role: 'ai', text: res.text}]);
              }} className="w-14 h-14 bg-white/5 hover:bg-white/10 text-white rounded-[24px] flex items-center justify-center shadow-xl active:scale-95 transition-all"><i className="fa-solid fa-paper-plane"></i></button>
           </div>
        </div>
      )}

    </div>
  );
};

export default App;
