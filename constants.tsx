
import { Product, ServiceType } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Sugar (1kg)', price: 45, stock: 50, category: 'Groceries' },
  { id: '2', name: 'Mustard Oil (1L)', price: 165, stock: 30, category: 'Oil' },
  { id: '3', name: 'Tea Leaves (250g)', price: 110, stock: 20, category: 'Beverages' },
  { id: '4', name: 'Bath Soap', price: 35, stock: 100, category: 'Personal Care' },
  { id: '5', name: 'Detergent Powder', price: 90, stock: 40, category: 'Household' },
];

export const SERVICE_COLORS = {
  [ServiceType.KIRANA]: 'bg-emerald-500',
  [ServiceType.CSP]: 'bg-blue-600',
  [ServiceType.XEROX]: 'bg-orange-500',
  [ServiceType.ONLINE]: 'bg-purple-600',
};

export const MAJOR_INDIAN_BANKS = [
  // Public Sector Banks
  "State Bank of India (SBI)",
  "Bank of Baroda (BoB)",
  "Bank of India",
  "Bank of Maharashtra",
  "Canara Bank",
  "Central Bank of India",
  "Indian Bank",
  "Indian Overseas Bank",
  "Punjab National Bank (PNB)",
  "Punjab & Sind Bank",
  "UCO Bank",
  "Union Bank of India",
  
  // Private Sector Banks
  "Axis Bank",
  "Bandhan Bank",
  "CSB Bank",
  "City Union Bank",
  "DCB Bank",
  "Dhanlaxmi Bank",
  "Federal Bank",
  "HDFC Bank",
  "ICICI Bank",
  "IDBI Bank",
  "IDFC FIRST Bank",
  "IndusInd Bank",
  "Jammu & Kashmir Bank",
  "Karnataka Bank",
  "Karur Vysya Bank",
  "Kotak Mahindra Bank",
  "Nainital Bank",
  "RBL Bank",
  "South Indian Bank",
  "Tamilnad Mercantile Bank",
  "YES Bank",

  // Payments Banks
  "Airtel Payments Bank",
  "India Post Payments Bank (IPPB)",
  "Fino Payments Bank",
  "Jio Payments Bank",
  "NSDL Payments Bank",
  "Paytm Payments Bank",

  // Small Finance Banks
  "AU Small Finance Bank",
  "Capital Small Finance Bank",
  "Equitas Small Finance Bank",
  "ESAF Small Finance Bank",
  "Fincare Small Finance Bank",
  "Jana Small Finance Bank",
  "North East Small Finance Bank",
  "Shivalik Small Finance Bank",
  "Suryoday Small Finance Bank",
  "Ujjivan Small Finance Bank",
  "Unity Small Finance Bank",
  "Utkarsh Small Finance Bank",

  // Major Regional Rural Banks (RRBs)
  "Andhra Pragathi Grameena Bank",
  "Assam Gramin Vikash Bank",
  "Bangiya Gramin Vikash Bank",
  "Baroda Gujarat Gramin Bank",
  "Baroda Rajasthan Kshetriya Gramin Bank",
  "Baroda UP Bank",
  "Chaitanya Godavari Grameena Bank",
  "Chhattisgarh Rajya Gramin Bank",
  "Dakshin Bihar Gramin Bank",
  "Himachal Pradesh Gramin Bank",
  "J&K Grameen Bank",
  "Jharkhand Rajya Gramin Bank",
  "Karnataka Gramin Bank",
  "Karnataka Vikas Grameena Bank",
  "Kerala Gramin Bank",
  "Madhya Pradesh Gramin Bank",
  "Madhyanchal Gramin Bank",
  "Maharashtra Gramin Bank",
  "Odisha Gramya Bank",
  "Paschim Banga Gramin Bank",
  "Prathama UP Gramin Bank",
  "Rajasthan Marudhara Gramin Bank",
  "Saptagiri Grameena Bank",
  "Sarva Haryana Gramin Bank",
  "Saurashtra Gramin Bank",
  "Telangana Grameena Bank",
  "Tripura Gramin Bank",
  "Uttarbanga Kshetriya Gramin Bank",
  "Vidharbha Konkan Gramin Bank"
].sort((a, b) => a.localeCompare(b));
