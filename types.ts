

export interface Student {
  id: string; // Internal UUID
  admissionNumber: string; // Visible Primary Key ID (e.g. 001)
  name: string;
  parentName: string;
  mobileNumber: string; // Local call number
  whatsappNumber: string; // WhatsApp specific number
  grade: string;
  gender?: string; // 'Male' | 'Female'
  notes: string;
  joinedDate: string; // YYYY-MM-DD - Determines the billing cycle day
  photo?: string; // Base64 string of the student's photo
  consecutiveAbsences?: number; // Added for attendance tracking
  lastReminderSentAt?: string; // ISO Timestamp for fee reminders
  lastInquirySentDate?: string; // ISO Timestamp for absence inquiries
}

export interface ClassGroup {
  id: string;
  name: string;
  schedule: string; // Display string, e.g. "Mon 5:00 PM"
  day: string; // 'Monday', 'Tuesday', etc.
  startTime: string; // '17:00' (24h format for sorting)
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  date: string; // ISO date string YYYY-MM-DD
  studentIdsPresent: string[];
  contactedAbsentees?: string[]; // IDs of absent students whose parents were contacted
  status?: 'active' | 'cancelled'; // Added for cancellation support
}

export interface FeeRecord {
  id: string;
  studentId: string;
  date: string; // Payment date YYYY-MM-DD
  amount: number;
  notes?: string;
  receiptSent?: boolean; // Track if WhatsApp receipt was sent
  billingMonth?: string; // ISO Date string representing the month paid for
  nextDueDate?: string; // ISO Date string for the next deadline
}

export interface ExamRecord {
  id: string;
  studentId: string;
  date: string;
  testName: string;
  score: number;
  total: number;
  notes?: string;
}

export interface CloudConfig {
  url: string;
  key: string;
  connected: boolean;
}

export type View = 'dashboard' | 'students' | 'classes' | 'attendance' | 'fees' | 'ai-tools' | 'timetable' | 'marks' | 'cloud-settings';

export interface AIResponse {
  text: string;
  loading: boolean;
  error?: string;
}