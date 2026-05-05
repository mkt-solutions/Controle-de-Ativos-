/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CategoriaAtivo = 'Hardware' | 'Software' | 'Mobiliário' | 'Veículos' | 'Infraestrutura' | 'Outros';

export type AssetStatus = 'Ativo' | 'Em Manutenção' | 'Inativo' | 'Baixado' | 'Emprestado';

export interface Categoria {
  id: string;
  name: string;
  usefulLifeYears: number;
  empresa_id: string;
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
  categoria: string; // Transformed from nested join or just label
  categoria_id?: string;
  status: AssetStatus;
  purchaseDate: string;
  value: number;
  location: string;
  assignedTo?: string;
  assigned_to_user_id?: string;
  maintenanceNotes?: string;
  maintenanceHistory?: MaintenanceSession[];
  inactiveReason?: string;
  nextMaintenanceDate?: string;
  maintenanceIntervalMonths?: number;
  hasPreventiveMaintenance?: boolean;
  hasWarranty?: boolean;
  warrantyExpirationDate?: string;
  description?: string;
  empresa_id: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  date: string;
  auditorName: string;
  auditor_user_id?: string;
  verifiedIds: string[];
  allAssetsSnapshot: { id: string, name: string, tag: string, categoria: string, value: number, location: string }[];
  isFinalized: boolean;
  empresa_id: string;
}

export interface AssetStats {
  totalAssets: number;
  totalValue: number;
  totalMaintenanceCost: number;
  alerts: { id: string, name: string, type: string, date: string }[];
  byCategoria: { name: string; value: number }[];
  byStatus: { name: string; value: number }[];
  recentActivity: Asset[];
}
