import { useState, useEffect, useMemo } from 'react';
import { Asset, AssetCategory, AssetStatus, AuditRecord } from './types';

const STORAGE_KEY = 'asset_master_data';
const CATEGORIES_KEY = 'asset_master_categories';
const AUDITS_KEY = 'asset_master_audits';

const INITIAL_CATEGORIES: string[] = ['Hardware', 'Software', 'Mobiliário', 'Veículos', 'Infraestrutura', 'Outros'];

const INITIAL_DATA: Asset[] = [
  {
    id: '1',
    name: 'MacBook Pro M2',
    tag: 'TI-001',
    category: 'Hardware',
    status: 'Ativo',
    purchaseDate: '2023-05-15',
    value: 12500,
    location: 'Sede - TI',
    assignedTo: 'João Silva',
    createdAt: '2023-05-15T10:00:00Z',
    updatedAt: '2023-05-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Cadeira Ergonômica Pro',
    tag: 'MOB-042',
    category: 'Mobiliário',
    status: 'Ativo',
    purchaseDate: '2023-08-20',
    value: 1800,
    location: 'Sede - RH',
    assignedTo: 'Maria Oliveira',
    createdAt: '2023-08-20T14:30:00Z',
    updatedAt: '2023-08-20T14:30:00Z',
  },
  {
    id: '3',
    name: 'Servidor Dell PowerEdge',
    tag: 'INFRA-010',
    category: 'Infraestrutura',
    status: 'Em Manutenção',
    purchaseDate: '2022-11-10',
    value: 45000,
    location: 'Data Center',
    maintenanceNotes: 'Oficina Central Dell',
    createdAt: '2022-11-10T09:00:00Z',
    updatedAt: '2024-01-15T16:20:00Z',
  },
  {
    id: '4',
    name: 'Toyota Corolla Executivo',
    tag: 'VEI-005',
    category: 'Veículos',
    status: 'Emprestado',
    purchaseDate: '2021-03-05',
    value: 140000,
    location: 'Garagem Central',
    assignedTo: 'Diretoria Especial',
    createdAt: '2021-03-05T08:00:00Z',
    updatedAt: '2023-12-01T11:00:00Z',
  }
];

export function useAssets() {
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(CATEGORIES_KEY);
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });

  const [audits, setAudits] = useState<AuditRecord[]>(() => {
    const saved = localStorage.getItem(AUDITS_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(AUDITS_KEY, JSON.stringify(audits));
  }, [audits]);

  const startAudit = (auditorName: string) => {
    const newAudit: AuditRecord = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      auditorName,
      verifiedIds: [],
      allAssetsSnapshot: assets.map(a => ({ 
        id: a.id, 
        name: a.name, 
        tag: a.tag,
        category: a.category,
        value: a.value
      })),
      isFinalized: false,
    };
    setAudits(prev => [newAudit, ...prev]);
  };

  const toggleAssetAudit = (auditId: string, assetId: string) => {
    setAudits(prev => prev.map(audit => {
      if (audit.id === auditId) {
        const isVerified = audit.verifiedIds.includes(assetId);
        return {
          ...audit,
          verifiedIds: isVerified 
            ? audit.verifiedIds.filter(id => id !== assetId)
            : [...audit.verifiedIds, assetId]
        };
      }
      return audit;
    }));
  };

  const finalizeAudit = (auditId: string) => {
    setAudits(prev => prev.map(audit => 
      audit.id === auditId ? { ...audit, isFinalized: true } : audit
    ));
  };

  const deleteAudit = (id: string) => {
    setAudits(prev => prev.filter(a => a.id !== id));
  };

  const addCategory = (name: string) => {
    if (name && !categories.includes(name)) {
      setCategories(prev => [...prev, name]);
    }
  };

  const removeCategory = (name: string) => {
    setCategories(prev => prev.filter(c => c !== name));
  };

  const addAsset = (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAsset: Asset = {
      ...asset,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAssets(prev => [newAsset, ...prev]);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const stats = useMemo(() => {
    const totalValue = assets.reduce((acc, curr) => acc + curr.value, 0);
    
    const byCategory = assets.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = assets.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAssets: assets.length,
      totalValue,
      byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
      byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
      recentActivity: [...assets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
    };
  }, [assets]);

  return { 
    assets, 
    categories, 
    audits,
    addCategory, 
    removeCategory, 
    addAsset, 
    updateAsset, 
    deleteAsset, 
    startAudit,
    toggleAssetAudit,
    finalizeAudit,
    deleteAudit,
    stats 
  };
}
