import { useState, useEffect, useMemo } from 'react';
import { Asset, AuditRecord, Category } from './types';
import { supabase } from './lib/supabase';

export function useAssets() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async (retries = 3) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Get Empresa ID for the current user
      const { data: userEmpresa, error: empresaError } = await supabase
        .from('usuarios_empresa')
        .select('empresa_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (empresaError) {
        console.error('Erro ao buscar empresa:', empresaError);
      }

      if (!userEmpresa) {
        if (retries > 0) {
          console.log(`Empresa não encontrada, tentando novamente em 1s... (${retries} tentativas restantes)`);
          setTimeout(() => fetchAll(retries - 1), 1000);
          return;
        }
        setEmpresaId(null);
        setLoading(false);
        return;
      }

      setEmpresaId(userEmpresa.empresa_id);

      // 2. Fetch using empresa_id
      const [catRes, assetRes, auditRes] = await Promise.all([
        supabase.from('categories').select('*').eq('empresa_id', userEmpresa.empresa_id).order('name'),
        supabase.from('assets').select('*, categories(name)').eq('empresa_id', userEmpresa.empresa_id).order('created_at', { ascending: false }),
        supabase.from('audits').select('*').eq('empresa_id', userEmpresa.empresa_id).order('date', { ascending: false })
      ]);

      if (catRes.data) {
        setCategories(catRes.data.map((c: any) => ({
          ...c,
          usefulLifeYears: c.useful_life_years
        })));
      }
      if (assetRes.data) {
        setAssets(assetRes.data.map((a: any) => ({
          ...a,
          category: a.categories?.name || 'Sem Categoria',
          purchaseDate: a.purchase_date,
          maintenanceNotes: a.maintenance_notes,
          maintenanceHistory: a.maintenance_history,
          inactiveReason: a.inactive_reason,
          nextMaintenanceDate: a.next_maintenance_date,
          maintenanceIntervalMonths: a.maintenance_interval_months,
          hasPreventiveMaintenance: a.has_preventive_maintenance,
          hasWarranty: a.has_warranty,
          warrantyExpirationDate: a.warranty_expiration_date,
          createdAt: a.created_at,
          updatedAt: a.updated_at
        })));
      }
      if (auditRes.data) {
        setAudits(auditRes.data.map((audit: any) => ({
          ...audit,
          auditorName: audit.auditor_name,
          verifiedIds: audit.verified_ids,
          allAssetsSnapshot: audit.all_assets_snapshot,
          isFinalized: audit.is_finalized
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchAll();
      } else if (event === 'SIGNED_OUT') {
        setCategories([]);
        setAssets([]);
        setAudits([]);
        setEmpresaId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const addCategory = async (name: string, usefulLifeYears: number = 10) => {
    if (!name.trim()) return;

    let currentEmpresaId = empresaId;
    
    // Tentativa de obter empresaId se ainda não estiver carregado
    if (!currentEmpresaId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userEmpresa } = await supabase
          .from('usuarios_empresa')
          .select('empresa_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (userEmpresa) {
          currentEmpresaId = userEmpresa.empresa_id;
          setEmpresaId(currentEmpresaId);
        }
      }
    }

    if (!currentEmpresaId) {
      setError('Sua empresa ainda não está vinculada. Tente recarregar a página.');
      return;
    }

    if (categories.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('Esta categoria já existe.');
      return;
    }

    try {
      setError(null);
      const { data, error: sbError } = await supabase
        .from('categories')
        .insert([{ 
          name: name.trim(), 
          useful_life_years: usefulLifeYears, 
          empresa_id: currentEmpresaId 
        }])
        .select()
        .single();
      
      if (sbError) {
        console.error('Erro Supabase:', sbError);
        throw sbError;
      }
      
      if (data) {
        setCategories(prev => [...prev, {
          ...data,
          usefulLifeYears: data.useful_life_years
        }]);
      }
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err);
      setError(`Erro ao salvar: ${err.message || 'Verifique se as tabelas foram criadas no Supabase (clique no ícone de engrenagem para ver o SQL)'}`);
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.usefulLifeYears !== undefined) updateData.useful_life_years = updates.usefulLifeYears;

    const { error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id);

    if (!error) {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }
  };

  const removeCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) {
      setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  const addAsset = async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'empresa_id'>) => {
    if (!empresaId) return;

    let category_id = asset.category_id;
    if (!category_id) {
      const cat = categories.find(c => c.name === asset.category);
      if (cat) category_id = cat.id;
    }

    const newAssetData = {
      name: asset.name,
      tag: asset.tag,
      category_id: category_id,
      status: asset.status,
      purchase_date: asset.purchaseDate,
      value: asset.value,
      location: asset.location,
      assigned_to: asset.assignedTo,
      assigned_to_user_id: asset.assigned_to_user_id,
      maintenance_notes: asset.maintenanceNotes,
      maintenance_history: asset.maintenanceHistory,
      inactive_reason: asset.inactiveReason,
      next_maintenance_date: asset.nextMaintenanceDate,
      maintenance_interval_months: asset.maintenanceIntervalMonths,
      has_preventive_maintenance: asset.hasPreventiveMaintenance,
      has_warranty: asset.hasWarranty,
      warranty_expiration_date: asset.warrantyExpirationDate,
      description: asset.description,
      empresa_id: empresaId
    };

    const { data, error } = await supabase
      .from('assets')
      .insert([newAssetData])
      .select('*, categories(name)')
      .single();

    if (data) {
      const mapped = {
        ...data,
        category: data.categories?.name || 'Sem Categoria',
        purchaseDate: data.purchase_date,
        maintenanceNotes: data.maintenance_notes,
        maintenanceHistory: data.maintenance_history,
        inactiveReason: data.inactive_reason,
        nextMaintenanceDate: data.next_maintenance_date,
        maintenanceIntervalMonths: data.maintenance_interval_months,
        hasPreventiveMaintenance: data.has_preventive_maintenance,
        hasWarranty: data.has_warranty,
        warranty_expiration_date: data.warranty_expiration_date,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      setAssets(prev => [mapped, ...prev]);
    }
    if (error) console.error('Error adding asset:', error);
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.tag !== undefined) updateData.tag = updates.tag;
    if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.purchaseDate !== undefined) updateData.purchase_date = updates.purchaseDate;
    if (updates.value !== undefined) updateData.value = updates.value;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo;
    if (updates.assigned_to_user_id !== undefined) updateData.assigned_to_user_id = updates.assigned_to_user_id;
    if (updates.maintenanceNotes !== undefined) updateData.maintenance_notes = updates.maintenanceNotes;
    if (updates.maintenanceHistory !== undefined) updateData.maintenance_history = updates.maintenanceHistory;
    if (updates.inactiveReason !== undefined) updateData.inactive_reason = updates.inactiveReason;
    if (updates.nextMaintenanceDate !== undefined) updateData.next_maintenance_date = updates.nextMaintenanceDate;
    if (updates.maintenanceIntervalMonths !== undefined) updateData.maintenance_interval_months = updates.maintenanceIntervalMonths;
    if (updates.hasPreventiveMaintenance !== undefined) updateData.has_preventive_maintenance = updates.hasPreventiveMaintenance;
    if (updates.hasWarranty !== undefined) updateData.has_warranty = updates.hasWarranty;
    if (updates.warrantyExpirationDate !== undefined) updateData.warranty_expiration_date = updates.warrantyExpirationDate;
    if (updates.description !== undefined) updateData.description = updates.description;

    const { error } = await supabase
      .from('assets')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));
    }
  };

  const deleteAsset = async (id: string) => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (!error) {
      setAssets(prev => prev.filter(a => a.id !== id));
    }
  };

  const bulkAddAssets = async (newAssets: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'empresa_id'>[]) => {
    if (!empresaId) return;

    const prepared = newAssets.map(asset => {
      let category_id = asset.category_id;
      if (!category_id) {
        const cat = categories.find(c => c.name === asset.category);
        if (cat) category_id = cat.id;
      }

      return {
        name: asset.name,
        tag: asset.tag,
        category_id: category_id,
        status: asset.status,
        purchase_date: asset.purchaseDate,
        value: asset.value,
        location: asset.location,
        assigned_to: asset.assignedTo,
        maintenance_notes: asset.maintenanceNotes,
        maintenance_history: asset.maintenanceHistory,
        inactive_reason: asset.inactiveReason,
        next_maintenance_date: asset.nextMaintenanceDate,
        maintenance_interval_months: asset.maintenanceIntervalMonths,
        has_preventive_maintenance: asset.hasPreventiveMaintenance,
        has_warranty: asset.hasWarranty,
        warranty_expiration_date: asset.warrantyExpirationDate,
        description: asset.description,
        empresa_id: empresaId
      };
    });

    const { data, error } = await supabase
      .from('assets')
      .insert(prepared)
      .select('*, categories(name)');

    if (data) {
      const mapped = data.map(d => ({
        ...d,
        category: d.categories?.name || 'Sem Categoria',
        purchaseDate: d.purchase_date,
        maintenanceNotes: d.maintenance_notes,
        maintenanceHistory: d.maintenance_history,
        inactiveReason: d.inactive_reason,
        nextMaintenanceDate: d.next_maintenance_date,
        maintenanceIntervalMonths: d.maintenance_interval_months,
        hasPreventiveMaintenance: d.has_preventive_maintenance,
        hasWarranty: d.has_warranty,
        warranty_expiration_date: d.warranty_expiration_date,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));
      setAssets(prev => [...mapped, ...prev]);
    }
  };

  const startAudit = async (auditorName: string) => {
    if (!empresaId) return;

    const { data: { user } } = await supabase.auth.getUser();

    const allAssetsSnapshot = assets.map(a => ({ 
      id: a.id, 
      name: a.name, 
      tag: a.tag,
      category: a.category,
      value: a.value,
      location: a.location
    }));

    const newAuditData = {
      date: new Date().toISOString(),
      auditor_name: auditorName,
      auditor_user_id: user?.id,
      verified_ids: [],
      all_assets_snapshot: allAssetsSnapshot,
      is_finalized: false,
      empresa_id: empresaId
    };

    const { data, error } = await supabase
      .from('audits')
      .insert([newAuditData])
      .select()
      .single();

    if (data) {
      const mapped = {
        ...data,
        auditorName: data.auditor_name,
        verifiedIds: data.verified_ids,
        allAssetsSnapshot: data.all_assets_snapshot,
        isFinalized: data.is_finalized
      };
      setAudits(prev => [mapped, ...prev]);
    }
  };

  const toggleAssetAudit = async (auditId: string, assetId: string) => {
    const audit = audits.find(a => a.id === auditId);
    if (!audit) return;

    const isVerified = audit.verifiedIds.includes(assetId);
    const newVerifiedIds = isVerified 
      ? audit.verifiedIds.filter(id => id !== assetId)
      : [...audit.verifiedIds, assetId];

    const { error } = await supabase
      .from('audits')
      .update({ verified_ids: newVerifiedIds })
      .eq('id', auditId);

    if (!error) {
      setAudits(prev => prev.map(a => a.id === auditId ? { ...a, verifiedIds: newVerifiedIds } : a));
    }
  };

  const finalizeAudit = async (auditId: string) => {
    const { error } = await supabase
      .from('audits')
      .update({ is_finalized: true })
      .eq('id', auditId);

    if (!error) {
      setAudits(prev => prev.map(audit => 
        audit.id === auditId ? { ...audit, isFinalized: true } : audit
      ));
    }
  };

  const deleteAudit = async (id: string) => {
    const { error } = await supabase.from('audits').delete().eq('id', id);
    if (!error) {
      setAudits(prev => prev.filter(a => a.id !== id));
    }
  };

  const stats = useMemo(() => {
    const totalValue = assets.reduce((acc, curr) => acc + curr.value, 0);
    
    const byCategory = assets.reduce((acc, curr) => {
      const catName = curr.category || 'Sem Categoria';
      acc[catName] = (acc[catName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = assets.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalMaintenanceCost = assets.reduce((acc, asset) => {
      const history = asset.maintenanceHistory || [];
      return acc + history.reduce((hAcc, hCurr: any) => hAcc + (hCurr.cost || 0), 0);
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
    loading,
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
    stats,
    error,
    setError
  };
}
