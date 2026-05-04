/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssetCategory = 'Hardware' | 'Software' | 'Mobiliário' | 'Veículos' | 'Infraestrutura' | 'Outros';

export type AssetStatus = 'Ativo' | 'Em Manutenção' | 'Inativo' | 'Baixado' | 'Emprestado';

export interface Category {
  id: string;
  name: string;
  usefulLifeYears: number;
}

export interface MaintenanceSession {
  id: string;
  date: string;
  cost: number;
  notes: string;
}

export interface Asset {
  id: string;
  name: string;
  tag: string; // Patrimônio ID
  category: AssetCategory;
  status: AssetStatus;
  purchaseDate: string;
  value: number;
  location: string;
  assignedTo?: string;
  maintenanceNotes?: string;
  maintenanceHistory?: MaintenanceSession[];
  inactiveReason?: string;
  nextMaintenanceDate?: string;
  maintenanceIntervalMonths?: number;
  hasPreventiveMaintenance?: boolean;
  hasWarranty?: boolean;
  warrantyExpirationDate?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  date: string;
  auditorName: string;
  verifiedIds: string[];
  allAssetsSnapshot: { id: string, name: string, tag: string, category: string, value: number, location: string }[];
  isFinalized: boolean;
}

export interface AssetStats {
  totalAssets: number;
  totalValue: number;
  totalMaintenanceCost: number;
  alerts: { id: string, name: string, type: string, date: string }[];
  byCategory: { name: string; value: number }[];
  byStatus: { name: string; value: number }[];
  recentActivity: Asset[];
}
