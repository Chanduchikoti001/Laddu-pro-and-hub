
export enum ServiceType {
  KIRANA = 'KIRANA',
  CSP = 'CSP',
  XEROX = 'XEROX',
  ONLINE = 'ONLINE'
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
  profileImage?: string; // base64
  status: 'pending' | 'approved' | 'rejected';
  role: 'Merchant' | 'Customer';
  createdAt: number;
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
  type: 'Transfer' | 'Withdraw' | 'BillPay' | 'Recharge' | 'AEPS' | 'UPI_QR' | 'CreditCard';
  amount: number;
  fee: number;
  netAmount: number;
  targetId?: string; 
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
  fileData?: string; 
}

export interface Expense {
  id: string;
  timestamp: number;
  category: 'Inventory' | 'Utility' | 'Rent' | 'Salary' | 'Maintenance' | 'Other';
  amount: number;
  description: string;
}
