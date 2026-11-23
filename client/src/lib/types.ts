export type User = { id: number; username: string; role: 'admin' | 'technician'; firstName: string; lastName: string };
export type Client = { id: number; firstName: string; lastName: string; email: string | null; phone: string; address: string; createdAt: string };
export type MoneyValue = number | string;
export type Service = { id: number; name: string; description: string; price: MoneyValue; createdAt: string };
export type RepairStatus = 'pending' | 'approved' | 'in_progress' | 'checking' | 'done' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type Repair = {
  id: number; code: string; clientId: number; clientName: string; clientPhone?: string; remarks: string;
  totalAmount: MoneyValue; amountPaid?: MoneyValue; outstandingBalance?: MoneyValue;
  paymentStatus: PaymentStatus; status: RepairStatus; createdAt: string; updatedAt?: string;
  services?: Array<{ id: number; name: string; fee: MoneyValue }>;
  materials?: Array<{ id: number; name: string; cost: MoneyValue }>;
  payments?: Array<{ id: number; amount: MoneyValue; method: string; reference: string; createdAt: string }>;
  history?: Array<{ id: number; oldStatus: RepairStatus | null; newStatus: RepairStatus; createdAt: string }>;
};
export type PublicRepairStatus = { code: string; status: RepairStatus; createdAt: string; updatedAt: string };
export type DashboardSummary = {
  clients: number; services: number; repairs: number; pending: number; approved: number; in_progress: number;
  checking: number; completed: number; cancelled: number; outstanding: MoneyValue; recentRepairs: Repair[];
};
export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };
export type ApiEnvelope<T> = { success: boolean; data: T; message?: string };
