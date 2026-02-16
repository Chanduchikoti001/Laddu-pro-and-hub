
export enum ServiceType {
  KIRANA = 'KIRANA',
  CSP = 'CSP',
  XEROX = 'XEROX',
  ONLINE = 'ONLINE',
  BILL_PAY = 'BILL_PAY',
  KIRANA_ORDER = 'KIRANA_ORDER'
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface User {
  phone: string;
  name: string;
  password: string; 
  email?: string;
  address?: string;
  fatherName?: string;
  idType?: 'Aadhar' | 'PAN' | 'Voter ID';
  idNumber?: string;
  profileImage?: string; // base64
  status: 'pending' | 'approved' | 'rejected';
  kycStatus: 'Not Started' | 'Submitted' | 'Verified' | 'Rejected';
  role: 'Merchant' | 'Customer';
  createdAt: number;
  wishlistIds?: string[];
  allowedServices?: ServiceType[]; // NEW: Granular feature control
}

export interface PinnedService {
  id: string;
  label: string;
  icon: string;
  tab: string;
  params?: any;
}

export interface Transaction {
  id: string;
  timestamp: number;
  type: ServiceType;
  description: string;
  amount: number;
  fee?: number;
  category: string;
  customerName?: string;
  customerPhone?: string;
  bankName?: string;
  paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer' | 'Credit Card';
  status: 'Paid' | 'Credit' | 'Cancelled';
  note?: string;
  receiptData?: any; // For print view
}

export interface DailyTransition {
  id: string;
  date: string;
  openingBalance: number;
  closingBalance: number;
  notes: string;
  merchantName: string;
  timestamp: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

export interface CSPLog {
  id: string;
  timestamp: number;
  customerName: string;
  customerPhone?: string;
  bankName?: string;
  accountNumber?: string;
  receiverBankName?: string;
  receiverAccountNumber?: string;
  transactionType: 'Deposit' | 'Withdrawal' | 'Transfer' | 'Bill Payment' | 'Recharge';
  amount: number;
  commission: number;
  status: 'Success' | 'Pending' | 'Failed';
  rrn?: string;
  isAeps?: boolean;
  note?: string;
}

export interface BankingRequest {
  id: string;
  timestamp: number;
  customerName: string;
  customerPhone: string;
  type: 'Transfer' | 'Withdraw' | 'Deposit' | 'BillPay' | 'Recharge' | 'CC_Bill' | 'Electricity';
  amount: number;
  fee: number;
  netAmount: number;
  targetId?: string; // Consumer ID, Account No, or UPI ID
  bankName?: string;
  provider?: string; 
  ifsc?: string;
  status: 'Queued' | 'Approved' | 'Processing' | 'Completed' | 'Failed' | 'Rejected';
  note?: string;
}

export interface XeroxTask {
  id: string;
  timestamp: number;
  customerName: string;
  customerPhone?: string;
  service: 'Xerox' | 'Print' | 'Scan' | 'Lamination' | 'Online';
  variant: 'BW' | 'Color';
  quantity: number;
  paperSize: 'A4' | 'Legal' | 'A3';
  sides: 'Single' | 'Double';
  paperType: string;
  finishing: string;
  deadline: string;
  isPriority: boolean;
  rate: number;
  total: number;
  status: 'Waiting' | 'Approved' | 'Processing' | 'Ready' | 'Delivered' | 'Rejected';
  paymentStatus: 'Paid' | 'Unpaid';
  fileName?: string;
  externalLink?: string; // Links from Drive/WhatsApp/Email
  sourcePlatform?: string; // WhatsApp, Email, Upload, CloudLink
}

export interface KiranaRequirement {
  id: string;
  timestamp: number;
  customerName: string;
  customerPhone: string;
  items: string; // Plain text list or structured
  estimatedBudget?: number;
  status: 'Draft' | 'Sent' | 'Fulfilling' | 'Ready' | 'OutForDelivery' | 'Delivered' | 'Cancelled';
  paymentStatus: 'Unpaid' | 'Paid' | 'Credit';
}

export interface Expense {
  id: string;
  timestamp: number;
  category: 'Inventory' | 'Utility' | 'Rent' | 'Salary' | 'Maintenance' | 'Other';
  amount: number;
  description: string;
}
