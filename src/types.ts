/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssetCategory = 'Hardware' | 'Software' | 'Mobiliário' | 'Veículos' | 'Infraestrutura' | 'Outros';

export type AssetStatus = 'Ativo' | 'Em Manutenção' | 'Inativo' | 'Baixado' | 'Emprestado';

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
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  date: string;
  auditorName: string;
  verifiedIds: string[];
  allAssetsSnapshot: { id: string, name: string, tag: string, category: string, value: number }[];
  isFinalized: boolean;
}

export interface AssetStats {
  totalAssets: number;
  totalValue: number;
  byCategory: { name: string; value: number }[];
  byStatus: { name: string; value: number }[];
  recentActivity: Asset[];
}
