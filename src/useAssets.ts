import { useState, useEffect, useMemo } from 'react';
import { Asset, AssetCategory, AssetStatus, AuditRecord, Category } from './types';

const STORAGE_KEY = 'asset_master_data';
const CATEGORIES_KEY = 'asset_master_categories';
const AUDITS_KEY = 'asset_master_audits';

const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Hardware', usefulLifeYears: 5 },
  { id: 'cat-2', name: 'Software', usefulLifeYears: 5 },
  { id: 'cat-3', name: 'Mobiliário', usefulLifeYears: 10 },
  { id: 'cat-4', name: 'Veículos', usefulLifeYears: 10 },
  { id: 'cat-5', name: 'Imóveis', usefulLifeYears: 20 },
  { id: 'cat-6', name: 'Computadores', usefulLifeYears: 5 },
];

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

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

export function useAssets() {
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(CATEGORIES_KEY);
    if (!saved) return INITIAL_CATEGORIES;
    try {
      const parsed = JSON.parse(saved);
      // Migration for legacy string categories
      return parsed.map((cat: any, index: number) => {
        if (typeof cat === 'string') {
          return { id: `legacy-${index}-${Date.now()}`, name: cat, usefulLifeYears: 10 };
        }
        if (cat && typeof cat === 'object' && !cat.id) {
          return { ...cat, id: `migrated-${index}-${Date.now()}`, usefulLifeYears: cat.usefulLifeYears || 10 };
        }
        return cat;
      });
    } catch {
      return INITIAL_CATEGORIES;
    }
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

  const addCategory = (name: string, usefulLifeYears: number = 10) => {
    if (name && !categories.some(c => c.name === name)) {
      setCategories(prev => [...prev, { id: generateId(), name, usefulLifeYears }]);
    }
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
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

  const bulkAddAssets = (newAssets: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    const prepared = newAssets.map(asset => ({
      ...asset,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    setAssets(prev => [...prepared, ...prev]);
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

    const totalMaintenanceCost = assets.reduce((acc, asset) => {
      const history = asset.maintenanceHistory || [];
      return acc + history.reduce((hAcc, hCurr) => hAcc + hCurr.cost, 0);
    }, 0);

    const alerts = assets.reduce((acc, asset) => {
      const today = new Date();
      const tenDaysFromNow = new Date();
      tenDaysFromNow.setDate(today.getDate() + 10);

      const checkNear = (dateStr?: string) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return date >= today && date <= tenDaysFromNow;
      };

      const getEffectiveNextMaintenanceDate = (asset: Asset) => {
        if (!asset.nextMaintenanceDate) return null;
        let nextDate = new Date(asset.nextMaintenanceDate);
        
        if (asset.hasPreventiveMaintenance && asset.maintenanceIntervalMonths && asset.maintenanceIntervalMonths > 0) {
          // If the date is in the past, calculate the next occurrence
          while (nextDate < today) {
            nextDate.setMonth(nextDate.getMonth() + asset.maintenanceIntervalMonths);
          }
        }
        return nextDate;
      };

      const effectiveMaintenanceDate = getEffectiveNextMaintenanceDate(asset);
      if (effectiveMaintenanceDate && effectiveMaintenanceDate <= tenDaysFromNow) {
        acc.push({ 
          id: asset.id, 
          name: asset.name, 
          type: 'Manutenção', 
          date: effectiveMaintenanceDate.toISOString().split('T')[0]
        });
      }

      if (asset.hasWarranty && checkNear(asset.warrantyExpirationDate)) {
        acc.push({ 
          id: asset.id, 
          name: asset.name, 
          type: 'Garantia', 
          date: asset.warrantyExpirationDate! 
        });
      }

      return acc;
    }, [] as { id: string, name: string, type: string, date: string }[]);

    return {
      totalAssets: assets.length,
      totalValue,
      totalMaintenanceCost,
      alerts,
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
    updateCategory,
    removeCategory, 
    addAsset, 
    updateAsset, 
    deleteAsset, 
    bulkAddAssets,
    startAudit,
    toggleAssetAudit,
    finalizeAudit,
    deleteAudit,
    stats 
  };
}
