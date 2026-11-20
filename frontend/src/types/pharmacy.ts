// These match Hms.Api/Dtos/PharmacyDtos.cs.
import type { Prescription } from './medicalRecord'

export type MedicineStock = {
  id: number
  name: string
  genericName: string | null
  form: string
  strength: string
  unitPrice: number
  reorderLevel: number
  isActive: boolean
  usableStock: number
  expiredStock: number
  nextExpiry: string | null
  isLowStock: boolean
  stockValue: number | null // null for doctors (stock only, no cost prices)
}

export type ExpiryState = 'Expired' | 'NearExpiry' | 'Ok'

export type Batch = {
  id: number
  batchNumber: string
  expiryDate: string
  quantityOnHand: number
  costPrice: number | null
  receivedAt: string
  expiryState: ExpiryState
}

export type StockMovementType = 'StockIn' | 'Dispense' | 'Adjustment' | 'Expired'

export const movementLabels: Record<StockMovementType, string> = {
  StockIn: 'Stock in',
  Dispense: 'Dispensed',
  Adjustment: 'Correction',
  Expired: 'Expired, removed',
}

export type StockMovement = {
  id: number
  batchNumber: string
  movementType: StockMovementType
  quantity: number
  reason: string | null
  prescriptionId: number | null
  patientNumber: string | null
  createdBy: string | null
  createdAt: string
}

export type MedicineDetail = { medicine: MedicineStock; batches: Batch[]; movements: StockMovement[] }

export type MedicineRequest = {
  name: string
  genericName: string | null
  form: string
  strength: string
  unitPrice: number
  reorderLevel: number
  isActive: boolean
}

export type AlertBatch = {
  batchId: number
  medicineId: number
  medicineName: string
  strength: string
  form: string
  batchNumber: string
  expiryDate: string
  quantityOnHand: number
}

export type PharmacyAlerts = {
  nearExpiryDays: number
  lowStock: MedicineStock[]
  nearExpiry: AlertBatch[]
  expired: AlertBatch[]
}

export type PharmacyAlertCounts = { lowStock: number; nearExpiry: number; expired: number }

export type DispenseStock = { medicineId: number; usableStock: number; unitPrice: number }

export type DispensedBatch = {
  prescriptionItemId: number
  medicineName: string
  batchNumber: string
  expiryDate: string
  quantity: number
  unitPrice: number
  amount: number
  dispensedBy: string | null
  dispensedAt: string
}

export type DispenseView = { prescription: Prescription; stock: DispenseStock[]; history: DispensedBatch[] }
