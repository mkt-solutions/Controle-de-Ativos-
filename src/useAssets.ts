import { useState, useEffect, useMemo } from 'react';
import { Asset, AuditRecord, Categoria } from './types';
import { supabase } from './lib/supabase';

export function useAssets() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async (retries = 5, isRetry = false) => {
    // Só ativa o loading global na primeira tentativa para evitar "piscar"
    if (!isRetry) setLoading(true);
    
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
        // RESCUE LOGIC: Se o trigger falhou ou não existe, tentamos criar a empresa manualmente 
        // caso o usuário tenha um company_name no metadata (vindo do cadastro)
        const companyName = user.user_metadata?.company_name || 'Minha Empresa';
        console.log('⚠️ Empresa não encontrada. Tentando criar rede de segurança para:', companyName);
        
        try {
          // 1. Criar empresa
          const { data: newEmpresa, error: errEmp } = await supabase
            .from('empresas')
            .insert([{ name: companyName }])
            .select()
            .single();
            
          if (newEmpresa) {
            // 2. Vincular usuário
            await supabase
              .from('usuarios_empresa')
              .insert([{ user_id: user.id, empresa_id: newEmpresa.id }]);
              
            // 3. Tentar carregar de novo imediatamente
            fetchAll(0, true);
            return;
          }
        } catch (e) {
          console.error('Falha no resgate automático:', e);
        }

        if (retries > 0) {
          console.log(`Aguardando vínculo de empresa... (${retries} tentativas restantes)`);
          // Se for retry, mantemos o loading ativo silenciosamente
          setLoading(true); 
          setTimeout(() => fetchAll(retries - 1, true), 2000);
          return;
        }
        setEmpresaId(null);
        setLoading(false);
        return;
      }

      setEmpresaId(userEmpresa.empresa_id);
      console.log('✅ Empresa identificada:', userEmpresa.empresa_id);

      // 2. Fetch using empresa_id
      const [catRes, assetRes, auditRes] = await Promise.all([
        supabase.from('categorias').select('*').eq('empresa_id', userEmpresa.empresa_id).order('name'),
        supabase.from('assets').select('*, categorias(name)').eq('empresa_id', userEmpresa.empresa_id).order('created_at', { ascending: false }),
        supabase.from('audits').select('*').eq('empresa_id', userEmpresa.empresa_id).order('date', { ascending: false })
      ]);

      if (catRes.error) console.error('❌ Erro categorias:', catRes.error);
      if (assetRes.error) console.error('❌ Erro ativos:', assetRes.error);

      // AUTO-INITIALIZE CATEGORIES IF EMPTY (AND WE HAVE A COMPANY)
      if (userEmpresa && (!catRes.data || catRes.data.length === 0)) {
        console.log('🌱 Verificando inicialização de categorias...');
        const defaultCategories = [
          { name: 'Imóveis', useful_life_years: 20, empresa_id: userEmpresa.empresa_id },
          { name: 'Hardware', useful_life_years: 3, empresa_id: userEmpresa.empresa_id },
          { name: 'Veículos', useful_life_years: 10, empresa_id: userEmpresa.empresa_id },
          { name: 'Mobiliário', useful_life_years: 5, empresa_id: userEmpresa.empresa_id }
        ];
        
        // Só tenta inserir se realmente não houver nada (para evitar duplicatas em caso de erro de fetch)
        if (catRes.data?.length === 0) {
           const { data: createdCats, error: insError } = await supabase.from('categorias').insert(defaultCategories).select();
           if (insError) console.error('❌ Erro ao criar categorias padrão:', insError);
           if (createdCats) {
             setCategorias(createdCats.map((c: any) => ({
               ...c,
               usefulLifeYears: c.useful_life_years
             })));
           }
        }
      } else if (catRes.data) {
        setCategorias(catRes.data.map((c: any) => ({
          ...c,
          usefulLifeYears: c.useful_life_years
        })));
      }
      if (assetRes.data) {
        setAssets(assetRes.data.map((a: any) => ({
          ...a,
          categoria: a.categorias?.name || 'Sem Categoria',
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
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchAll();
      } else if (event === 'SIGNED_OUT') {
        setCategorias([]);
        setAssets([]);
        setAudits([]);
        setEmpresaId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const addCategoria = async (name: string, usefulLifeYears: number = 10) => {
    if (!name.trim()) return;

    let currentEmpresaId = empresaId;
    
    // Tentativa de obter empresaId se ainda não estiver carregado
    if (!currentEmpresaId) {
      console.log('EmpresaId ausente, tentando recuperação forçada...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Tenta buscar até 3 vezes com pequeno delay
        for (let i = 0; i < 3; i++) {
          const { data: userEmpresa } = await supabase
            .from('usuarios_empresa')
            .select('empresa_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (userEmpresa) {
            currentEmpresaId = userEmpresa.empresa_id;
            setEmpresaId(currentEmpresaId);
            break;
          }
          console.log(`Tentativa ${i + 1} de recuperação de empresa...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!currentEmpresaId) {
      setError('Sincronização em andamento. Por favor, aguarde 3 segundos e tente clicar em salvar novamente.');
      fetchAll(5, true); 
      return;
    }

    // Se chegou aqui, temos empresaId, então limpamos o erro de sincronização
    setError(null);

    if (categorias.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('Esta categoria já existe.');
      return;
    }

    try {
      setError(null);
      const { data, error: sbError } = await supabase
        .from('categorias')
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
        setCategorias(prev => [...prev, {
          ...data,
          usefulLifeYears: data.useful_life_years
        }]);
      }
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err);
      setError(`Erro ao salvar: ${err.message || 'Verifique se as tabelas foram criadas no Supabase (clique no ícone de engrenagem para ver o SQL)'}`);
    }
  };

  const updateCategoria = async (id: string, updates: Partial<Categoria>) => {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.usefulLifeYears !== undefined) updateData.useful_life_years = updates.usefulLifeYears;

    const { error } = await supabase
      .from('categorias')
      .update(updateData)
      .eq('id', id);

    if (!error) {
      setCategorias(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }
  };

  const removeCategoria = async (id: string) => {
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (!error) {
      setCategorias(prev => prev.filter(c => c.id !== id));
    }
  };

  const addAsset = async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'empresa_id'>) => {
    let currentEmpresaId = empresaId;
    
    if (!currentEmpresaId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userEmpresa } = await supabase.from('usuarios_empresa').select('empresa_id').eq('user_id', user.id).maybeSingle();
        if (userEmpresa) {
          currentEmpresaId = userEmpresa.empresa_id;
          setEmpresaId(currentEmpresaId);
        }
      }
    }

    if (!currentEmpresaId) {
      setError('Aguarde a sincronização da empresa.');
      return;
    }

    let categoria_id = asset.categoria_id;
    if (!categoria_id) {
      const cat = categorias.find(c => c.name === asset.categoria);
      if (cat) categoria_id = cat.id;
    }

    const newAssetData = {
      name: asset.name,
      tag: asset.tag,
      category_id: categoria_id,
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
      empresa_id: currentEmpresaId
    };

    const { data, error } = await supabase
      .from('assets')
      .insert([newAssetData])
      .select('*, categorias(name)')
      .single();

    if (data) {
      const mapped = {
        ...data,
        categoria: data.categorias?.name || 'Sem Categoria',
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
    if (updates.categoria_id !== undefined) updateData.category_id = updates.categoria_id;
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
    let currentEmpresaId = empresaId;
    if (!currentEmpresaId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userEmpresa } = await supabase.from('usuarios_empresa').select('empresa_id').eq('user_id', user.id).maybeSingle();
        if (userEmpresa) {
          currentEmpresaId = userEmpresa.empresa_id;
          setEmpresaId(currentEmpresaId);
        }
      }
    }

    if (!currentEmpresaId) return;

    const prepared = newAssets.map(asset => {
      let categoria_id = asset.categoria_id;
      if (!categoria_id) {
        const cat = categorias.find(c => c.name === asset.categoria);
        if (cat) categoria_id = cat.id;
      }

      return {
        name: asset.name,
        tag: asset.tag,
        category_id: categoria_id,
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
        empresa_id: currentEmpresaId
      };
    });

    const { data, error } = await supabase
      .from('assets')
      .insert(prepared)
      .select('*, categorias(name)');

    if (data) {
      const mapped = data.map(d => ({
        ...d,
        categoria: d.categorias?.name || 'Sem Categoria',
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
      categoria: a.categoria,
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
    
    const byCategoria = assets.reduce((acc, curr) => {
      const catName = curr.categoria || 'Sem Categoria';
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
      byCategoria: Object.entries(byCategoria).map(([name, value]) => ({ name, value })),
      byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
      recentActivity: [...assets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
    };
  }, [assets]);

  return { 
    assets, 
    categorias, 
    audits,
    loading,
    addCategoria, 
    updateCategoria,
    removeCategoria, 
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
