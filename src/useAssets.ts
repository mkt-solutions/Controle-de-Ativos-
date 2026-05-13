import { useState, useEffect, useMemo } from 'react';
import { Asset, AuditRecord, Categoria, Filial } from './types';
import { supabase } from './lib/supabase';

export function useAssets() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
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
        setEmpresaId(null);
        setLoading(false);
        return;
      }

      setEmpresaId(userEmpresa.empresa_id);
      
      // 1.1 Fetch Empresa Name
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('nome')
        .eq('id', userEmpresa.empresa_id)
        .maybeSingle();
      
      if (empresaData) {
        setEmpresaNome(empresaData.nome);
      }
      
      console.log('✅ Empresa identificada:', userEmpresa.empresa_id);

      // 2. Fetch using empresa_id
      const [catRes, assetRes, auditRes, filialRes] = await Promise.all([
        supabase.from('categorias').select('*').eq('empresa_id', userEmpresa.empresa_id).order('name'),
        supabase.from('assets').select('*').eq('empresa_id', userEmpresa.empresa_id).order('created_at', { ascending: false }),
        supabase.from('audits').select('*').eq('empresa_id', userEmpresa.empresa_id).order('date', { ascending: false }),
        supabase.from('filiais').select('*').eq('empresa_id', userEmpresa.empresa_id).order('nome')
      ]);

      if (catRes.error) {
        console.error('❌ Erro categorias:', catRes.error);
        if (catRes.error.code === '42501' || catRes.error.message.toLowerCase().includes('permission denied')) {
          setError("Erro de Permissão: O Supabase bloqueou o acesso. Por favor, vá ao SQL Editor e execute o script de reparo disponível na aba de Configurações.");
        } else {
          setError(`Erro ao carregar categorias: ${catRes.error.message}`);
        }
      }

      const freshCats = catRes.data ? catRes.data.map((c: any) => ({
        ...c,
        usefulLifeYears: c.useful_life_years
      })) : [];

      setCategorias(freshCats);

      if (filialRes.error) {
        console.warn('⚠️ Erro ao carregar filiais:', filialRes.error);
        // Não travamos o sistema por causa das filiais
        setFiliais([]);
      } else if (filialRes.data) {
        setFiliais(filialRes.data.map((f: any) => ({
          ...f,
          createdAt: f.created_at
        })));
      }

      if (assetRes.error) {
        console.error('❌ Erro ativos:', assetRes.error);
        setError(`Erro ao carregar ativos: ${assetRes.error.message}`);
      }

      if (assetRes.data) {
        if (assetRes.data.length > 0) {
          console.log('📊 Estrutura do primeiro ativo retornado:', Object.keys(assetRes.data[0]));
        }
        setAssets(assetRes.data.map((a: any) => {
          const cat = freshCats.find(c => c.id === a.category_id || c.id === a.categoria_id);
          const filial = (filialRes.data || []).find((f: any) => f.id === a.filial_id);
          return {
            ...a,
            categoria: cat?.name || 'Sem Categoria',
            categoria_id: a.category_id || a.categoria_id,
            filial_id: a.filial_id,
            filial_nome: filial?.nome,
            purchaseDate: a.purchase_date,
            value: a.value,
            assignedTo: a.assigned_to,
            maintenanceNotes: a.maintenance_notes,
            maintenanceValue: a.maintenance_value,
            maintenanceHistory: a.maintenance_history || [],
            inactiveReason: a.inactive_reason,
            nextMaintenanceDate: a.next_maintenance_date,
            maintenanceIntervalMonths: a.maintenance_interval_months,
            hasPreventiveMaintenance: a.has_preventive_maintenance,
            hasWarranty: a.has_warranty,
            warrantyExpirationDate: a.warranty_expiration_date,
            codBaseBem: a.cod_base_bem,
            brand: a.brand,
            model: a.model,
            serialNumber: a.serial_number,
            createdAt: a.created_at,
            updatedAt: a.updated_at
          };
        }));
      }
      if (auditRes.data) {
        setAudits(auditRes.data.map((audit: any) => {
          const filialObj = audit.filial_id ? (filialRes.data || []).find((f: any) => f.id === audit.filial_id) : null;
          return {
            ...audit,
            auditorName: audit.auditor_name,
            verifiedIds: audit.verified_ids || [],
            allAssetsSnapshot: audit.all_assets_snapshot,
            isFinalized: audit.is_finalized,
            filial_nome: audit.filial_id ? (filialObj?.nome || 'Filial') : 'Sede / Matriz'
          };
        }));
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
        setFiliais([]);
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
      console.log('📤 Salvando categoria:', { name: name.trim(), useful_life_years: usefulLifeYears });
      
      const { data, error: sbError } = await supabase
        .from('categorias')
        .insert([{ 
          name: name.trim(), 
          useful_life_years: Number(usefulLifeYears), 
          empresa_id: currentEmpresaId 
        }])
        .select()
        .single();
      
      if (sbError) {
        console.error('❌ Erro Supabase ao salvar categoria:', sbError);
        if (sbError.message.includes('useful_life_years')) {
          setError("Erro de Banco de Dados: A coluna 'useful_life_years' não foi encontrada. Por favor, execute o script SQL de atualização no Supabase.");
        } else {
          setError(`Erro ao salvar no banco de dados: ${sbError.message}`);
        }
        return;
      }
      
      if (data) {
        console.log('✅ Categoria salva:', data);
        setCategorias(prev => [...prev, {
          ...data,
          usefulLifeYears: data.useful_life_years
        }]);
      }
    } catch (err: any) {
      console.error('💥 Erro ao salvar categoria:', err);
      setError(`Erro inesperado: ${err.message}`);
    }
  };

  const updateCategoria = async (id: string, updates: Partial<Categoria>) => {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.usefulLifeYears !== undefined) {
      updateData.useful_life_years = Number(updates.usefulLifeYears);
    }

    console.log('📤 Atualizando categoria:', { id, updateData });

    const { error } = await supabase
      .from('categorias')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('❌ Erro ao atualizar categoria:', error);
      setError(`Erro ao atualizar banco: ${error.message}`);
    } else {
      setCategorias(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }
  };
  
  const addFilial = async (nome: string) => {
    if (!nome.trim() || !empresaId) return;
    
    try {
      const { data, error } = await supabase
        .from('filiais')
        .insert([{ nome: nome.trim(), empresa_id: empresaId }])
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        setFiliais(prev => [...prev, { ...data, createdAt: data.created_at }]);
        return true;
      }
    } catch (err: any) {
      console.error('Erro ao adicionar filial:', err);
      if (err.code === '42501' || err.message.toLowerCase().includes('permission denied') || err.message.toLowerCase().includes('cod_base_bem')) {
        setError(`ERRO DE BANCO DE DADOS: O Supabase detectou colunas ou permissões faltando. 
        
Para corrigir, copie e execute este código no SQL Editor do Supabase:

CREATE TABLE IF NOT EXISTS filiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

GRANT ALL ON TABLE filiais TO authenticated;
ALTER TABLE filiais DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "total_access" ON filiais;
ALTER TABLE filiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "total_access" ON filiais FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE assets ADD COLUMN IF NOT EXISTS filial_id uuid REFERENCES filiais(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS cod_base_bem text;
NOTIFY pgrst, 'reload schema';`);
      } else {
        setError(`Erro ao adicionar filial: ${err.message}`);
      }
    }
    return false;
  };

  const removeFilial = async (id: string) => {
    try {
      const { error } = await supabase.from('filiais').delete().eq('id', id);
      if (error) throw error;
      setFiliais(prev => prev.filter(f => f.id !== id));
      return true;
    } catch (err: any) {
      console.error('Erro ao remover filial:', err);
      setError(`Erro ao remover filial: ${err.message}`);
    }
    return false;
  };

  const removeCategoria = async (id: string) => {
    setError(null);
    try {
      // 1. Verificar se existem ativos vinculados
      const { count, error: countErr } = await supabase
        .from('assets')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id);

      if (count && count > 0) {
        setError('Não é possível excluir esta categoria pois existem ativos vinculados a ela. Exclua ou altere a categoria dos ativos primeiro.');
        return;
      }

      const { error: sbError } = await supabase.from('categorias').delete().eq('id', id);
      
      if (sbError) {
        console.error('Erro ao deletar categoria:', sbError);
        setError(`Erro ao excluir: ${sbError.message}`);
        return;
      }
      
      setCategorias(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      console.error('Exceção ao deletar:', err);
      setError('Erro inesperado ao tentar excluir.');
    }
  };

  const addAsset = async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'empresa_id'>) => {
    setError(null);
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
      console.error('❌ Falha ao adicionar ativo: Empresa ID não encontrado.');
      setError('Aguarde a sincronização da empresa.');
      return false;
    }

    // Validação de Unique Tag
    const tagExists = assets.some(a => a.tag.trim().toLowerCase() === asset.tag.trim().toLowerCase());
    if (tagExists) {
      setError(`A Tag de Patrimônio "${asset.tag}" já está em uso por outro ativo.`);
      return false;
    }

    let categoryId = asset.categoria_id;
    if (!categoryId) {
      const cat = categorias.find(c => c.name.trim().toLowerCase() === (asset.categoria || "").trim().toLowerCase());
      if (cat) {
        categoryId = cat.id;
        console.log(`📂 Mapeada categoria "${asset.categoria}" para ID: ${categoryId}`);
      }
    }

    const newAssetData: any = {
      name: asset.name,
      tag: asset.tag,
      category_id: categoryId || null, 
      status: asset.status,
      purchase_date: asset.purchaseDate,
      value: asset.value,
      location: asset.location,
      assigned_to: asset.assignedTo,
      description: asset.description,
      empresa_id: currentEmpresaId,
      filial_id: asset.filial_id || null,
      maintenance_notes: asset.maintenanceNotes,
      maintenance_value: asset.maintenanceValue,
      maintenance_history: asset.maintenanceHistory,
      inactive_reason: asset.inactiveReason,
      next_maintenance_date: asset.nextMaintenanceDate || null,
      maintenance_interval_months: asset.maintenanceIntervalMonths || 0,
      has_preventive_maintenance: !!asset.hasPreventiveMaintenance,
      has_warranty: !!asset.hasWarranty,
      warranty_expiration_date: asset.warrantyExpirationDate || null,
      cod_base_bem: asset.codBaseBem || null,
      brand: asset.brand || null,
      model: asset.model || null,
      serial_number: asset.serialNumber || null
    };

    console.log('📤 Tentando inserir ativo no Supabase:', newAssetData);

    try {
      const { data, error: insertError } = await supabase
        .from('assets')
        .insert([newAssetData])
        .select() 
        .single();

      if (insertError) {
        console.error('❌ Erro Supabase ao adicionar ativo:', insertError);
        if (insertError.message.includes('cod_base_bem') || insertError.message.includes('column') || insertError.code === '42703') {
          setError(`ERRO DE BANCO DE DADOS: O Ativo não pôde ser salvo porque algumas colunas estão faltando no Supabase. 
          
Vá em Configurações e use o Script de Reparo ou execute o comando NOTIFY no SQL Editor.`);
        } else {
          setError(`Erro ao salvar ativo: ${insertError.message}`);
        }
        return false;
      }

      if (data) {
        console.log('✅ Ativo adicionado com sucesso:', data);
        
        // Mapeamento manual de nomes usando o estado local
        const catLocal = categorias.find(c => c.id === data.category_id || c.id === (data as any).categoria_id);
        const filialLocal = filiais.find(f => f.id === data.filial_id);
        
        const mapped = {
          ...data,
          categoria: catLocal?.name || 'Sem Categoria',
          categoria_id: data.category_id || (data as any).categoria_id,
          filial_id: data.filial_id,
          filial_nome: filialLocal?.nome,
          purchaseDate: data.purchase_date,
          value: data.value,
          assignedTo: data.assigned_to,
          maintenanceNotes: data.maintenance_notes,
          maintenanceValue: data.maintenance_value,
          maintenanceHistory: data.maintenance_history || [],
          inactiveReason: data.inactive_reason,
          nextMaintenanceDate: data.next_maintenance_date,
          maintenanceIntervalMonths: data.maintenance_interval_months,
          hasPreventiveMaintenance: data.has_preventive_maintenance,
          hasWarranty: data.has_warranty,
          warrantyExpirationDate: data.warranty_expiration_date,
          codBaseBem: data.cod_base_bem,
          brand: data.brand,
          model: data.model,
          serialNumber: data.serial_number,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
        setAssets(prev => [mapped, ...prev]);
        setError(null);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('💥 Exceção ao adicionar ativo:', err);
      setError(`Erro inesperado: ${err.message}`);
      return false;
    }
  };

  const updateEmpresaNome = async (novoNome: string) => {
    if (!empresaId || !novoNome.trim()) return false;
    
    try {
      const { error } = await supabase
        .from('empresas')
        .update({ nome: novoNome.trim() })
        .eq('id', empresaId);
        
      if (error) throw error;
      
      setEmpresaNome(novoNome.trim());
      return true;
    } catch (err: any) {
      console.error('Erro ao atualizar nome da empresa:', err);
      setError(`Erro ao atualizar nome da empresa: ${err.message}`);
      return false;
    }
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    setError(null);
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    
    if (updates.tag !== undefined) {
      const tagExists = assets.some(a => a.id !== id && a.tag.trim().toLowerCase() === updates.tag?.trim().toLowerCase());
      if (tagExists) {
        setError(`A Tag de Patrimônio "${updates.tag}" já está em uso por outro ativo.`);
        return false;
      }
      updateData.tag = updates.tag;
    }
    
    // Mapeamento de categoria -> category_id (paridade com addAsset)
    if (updates.categoria !== undefined) {
      const cat = categorias.find(c => c.name.trim().toLowerCase() === (updates.categoria || "").trim().toLowerCase());
      if (cat) {
        updateData.category_id = cat.id;
      }
    }
    
    if (updates.categoria_id !== undefined || (updates as any).category_id !== undefined) {
      updateData.category_id = updates.categoria_id || (updates as any).category_id;
    }

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.purchaseDate !== undefined) updateData.purchase_date = updates.purchaseDate || null;
    if (updates.value !== undefined) updateData.value = updates.value;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo;
    if (updates.filial_id !== undefined) updateData.filial_id = updates.filial_id || null;
    if (updates.maintenanceNotes !== undefined) updateData.maintenance_notes = updates.maintenanceNotes;
    if (updates.maintenanceValue !== undefined) updateData.maintenance_value = updates.maintenanceValue;
    if (updates.maintenanceHistory !== undefined) updateData.maintenance_history = updates.maintenanceHistory;
    if (updates.inactiveReason !== undefined) updateData.inactive_reason = updates.inactiveReason;
    
    // Tratamento de datas opcionais para evitar erros de string vazia no Postgres
    if (updates.nextMaintenanceDate !== undefined) {
      updateData.next_maintenance_date = updates.nextMaintenanceDate || null;
    }
    if (updates.maintenanceIntervalMonths !== undefined) updateData.maintenance_interval_months = updates.maintenanceIntervalMonths;
    if (updates.hasPreventiveMaintenance !== undefined) updateData.has_preventive_maintenance = updates.hasPreventiveMaintenance;
    if (updates.hasWarranty !== undefined) updateData.has_warranty = updates.hasWarranty;
    if (updates.warrantyExpirationDate !== undefined) {
      updateData.warranty_expiration_date = updates.warrantyExpirationDate || null;
    }
    if (updates.codBaseBem !== undefined) {
      updateData.cod_base_bem = updates.codBaseBem || null;
    }
    if (updates.brand !== undefined) updateData.brand = updates.brand || null;
    if (updates.model !== undefined) updateData.model = updates.model || null;
    if (updates.serialNumber !== undefined) updateData.serial_number = updates.serialNumber || null;
    if (updates.description !== undefined) updateData.description = updates.description;

    console.log('📤 Enviando atualização para Supabase:', { id, updateData });

    const { error } = await supabase
      .from('assets')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('❌ Erro ao atualizar ativo:', error);
      setError(`Erro ao atualizar no banco: ${error.message}`);
      return false;
    } else {
      console.log('✅ Ativo atualizado com sucesso no Supabase');
      
      // Recalcular nomes baseados nos IDs para manter o estado local sincronizado
      const filialLocal = updates.filial_id ? filiais.find(f => f.id === updates.filial_id) : null;
      const catLocal = updates.categoria || updates.categoria_id ? 
        categorias.find(c => c.id === updates.categoria_id || c.name === updates.categoria) : null;

      setAssets(prev => prev.map(a => {
        if (a.id === id) {
          const updatedAsset = { ...a, ...updates, updatedAt: new Date().toISOString() };
          if (updates.filial_id !== undefined) {
            updatedAsset.filial_nome = filialLocal?.nome || (updates.filial_id === null ? 'Sede / Matriz' : a.filial_nome);
          }
          if (catLocal) {
            updatedAsset.categoria = catLocal.name;
          }
          return updatedAsset;
        }
        return a;
      }));
      return true;
    }
  };

  const deleteAsset = async (id: string) => {
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) {
        console.error('Erro ao deletar ativo:', error);
        // Se for erro de permissão mas o item é local, ou se o usuário quer apenas "limpar" da tela
        setError(`Erro ao excluir do banco: ${error.message}. Removendo apenas da visualização.`);
      }
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (err) {
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

    // Filtrar duplicados no próprio lote e contra os já existentes
    const existingTags = new Set(assets.map(a => a.tag.trim().toLowerCase()));
    const seenInBatch = new Set<string>();
    const uniqueToInsert: typeof newAssets = [];
    const duplicates: string[] = [];

    for (const asset of newAssets) {
      const normalizedTag = asset.tag.trim().toLowerCase();
      if (existingTags.has(normalizedTag) || seenInBatch.has(normalizedTag)) {
        duplicates.push(asset.tag);
      } else {
        seenInBatch.add(normalizedTag);
        uniqueToInsert.push(asset);
      }
    }

    if (uniqueToInsert.length === 0) {
      setError(`Nenhum ativo novo importado. Todas as tags (${duplicates.join(', ')}) já existem no sistema.`);
      return false;
    }

    if (duplicates.length > 0) {
      console.warn('Ativos ignorados por duplicidade de tag:', duplicates);
      setError(`${uniqueToInsert.length} ativos importados. ${duplicates.length} itens foram ignorados pois as Tags de Patrimônio já existem.`);
    }

    const prepared = uniqueToInsert.map(asset => {
      let categoryId = asset.categoria_id;
      if (!categoryId) {
        const cat = categorias.find(c => c.name.trim().toLowerCase() === (asset.categoria || '').trim().toLowerCase());
        if (cat) categoryId = cat.id;
      }

      return {
        name: asset.name,
        tag: asset.tag,
        category_id: categoryId || null,
        status: asset.status,
        purchase_date: asset.purchaseDate,
        value: asset.value,
        location: asset.location,
        assigned_to: asset.assignedTo,
        maintenance_notes: asset.maintenanceNotes || '',
        maintenance_value: asset.maintenanceValue || 0,
        maintenance_history: asset.maintenanceHistory || [],
        inactive_reason: asset.inactiveReason || '',
        next_maintenance_date: asset.nextMaintenanceDate || null,
        maintenance_interval_months: asset.maintenanceIntervalMonths || 0,
        has_preventive_maintenance: !!asset.hasPreventiveMaintenance,
        has_warranty: !!asset.hasWarranty,
        warranty_expiration_date: asset.warrantyExpirationDate || null,
        cod_base_bem: asset.codBaseBem || null,
        brand: asset.brand || '',
        model: asset.model || '',
        serial_number: asset.serialNumber || '',
        description: asset.description || '',
        filial_id: asset.filial_id || null,
        empresa_id: currentEmpresaId
      };
    });

    const { data, error } = await supabase
      .from('assets')
      .insert(prepared)
      .select();

    if (error) {
      console.error('❌ Erro no bulk insert:', error);
      setError(`Erro ao importar ativos: ${error.message}`);
    } else if (data) {
      console.log(`✅ Bulk insert concluído: ${data.length} ativos.`);
      fetchAll();
      return data.length;
    }
    return 0;
  };

  const startAudit = async (auditorName: string, filterType: string = 'TOTAL') => {
    if (!empresaId) return;

    const { data: { user } } = await supabase.auth.getUser();

    // Filtra os ativos baseados na seleção
    let filteredAssets = assets;
    let filial_id_to_save: string | null = null;
    let filial_nome_display: string = 'Geral / Toda Empresa';

    if (filterType === 'MATRIZ') {
      filteredAssets = assets.filter(a => !a.filial_id);
      filial_nome_display = 'Sede / Matriz';
      // No banco vamos marcar como null para representar a sede se necessário, 
      // ou usar um marcador se a coluna for obrigatória e tivermos IDs.
      // Aqui, 'null' na coluna filial_id geralmente significa sede.
    } else if (filterType !== 'TOTAL' && filterType) {
      filteredAssets = assets.filter(a => a.filial_id === filterType);
      filial_id_to_save = filterType;
      const filialFound = filiais.find(f => f.id === filterType);
      filial_nome_display = filialFound?.nome || 'Filial';
    }

    const allAssetsSnapshot = filteredAssets.map(a => ({ 
      id: a.id, 
      name: a.name, 
      tag: a.tag,
      categoria: a.categoria,
      value: a.value,
      location: a.location
    }));

    const newAuditData: any = {
      date: new Date().toISOString(),
      auditor_name: auditorName,
      auditor_user_id: user?.id,
      verified_ids: [],
      all_assets_snapshot: allAssetsSnapshot,
      is_finalized: false,
      empresa_id: empresaId,
      filial_id: filial_id_to_save
    };

    const { data, error } = await supabase
      .from('audits')
      .insert([newAuditData])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao iniciar verificação:', error);
      if (error.message.includes('column "filial_id"') || error.code === '42703') {
        setError('ERRO DE BANCO: A tabela de conferência (audits) precisa ser atualizada com a coluna "filial_id". Use o rádio de Configurações para corrigir.');
      } else {
        setError(`Erro ao iniciar verificação: ${error.message}`);
      }
      return false;
    }

    if (data) {
      const filialObj = filial_id_to_save ? filiais.find(f => f.id === filial_id_to_save) : null;
      const mapped = {
        ...data,
        auditorName: data.auditor_name,
        verifiedIds: data.verified_ids || [],
        allAssetsSnapshot: data.all_assets_snapshot,
        isFinalized: data.is_finalized,
        filial_id: data.filial_id,
        filial_nome: filial_nome_display
      };
      setAudits(prev => [mapped, ...prev]);
      return true;
    }
    return false;
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
    const totalOriginalValue = assets.reduce((acc, curr) => acc + curr.value, 0);
    
    let totalRemainingValue = 0;
    const now = new Date();

    const assetsWithDepreciation = assets.map(asset => {
      // Procura a categoria para pegar a vida útil
      const cat = categorias.find(c => 
        c.name.trim().toLowerCase() === (asset.categoria || "").trim().toLowerCase() ||
        c.id === (asset as any).categoria_id
      );
      const usefulLifeYears = cat ? Number(cat.usefulLifeYears) : 10;
      const usefulLifeMonths = Math.max(usefulLifeYears * 12, 1);
      
      const purchase = new Date(asset.purchaseDate);
      const monthsElapsed = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth());
      
      const monthlyDepreciation = asset.value / usefulLifeMonths;
      const depreciation = Math.min(asset.value, monthlyDepreciation * Math.max(0, monthsElapsed));
      const remaining = asset.value - depreciation;
      
      totalRemainingValue += remaining;
      
      return { ...asset, depreciation, remaining };
    });

    const totalDepreciation = totalOriginalValue - totalRemainingValue;

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
      totalValue: totalRemainingValue, // Mostramos o valor residual como padrão no Dashboard
      totalOriginalValue,
      totalDepreciation,
      totalRemainingValue,
      totalMaintenanceCost,
      alerts,
      byCategoria: Object.entries(byCategoria).map(([name, value]) => ({ name, value })),
      byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
      recentActivity: [...assets].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5)
    };
  }, [assets, categorias]);

  return { 
    assets, 
    categorias, 
    filiais,
    audits,
    loading,
    addCategoria, 
    updateCategoria,
    removeCategoria, 
    addFilial,
    removeFilial,
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
    setError,
    empresaId,
    empresaNome,
    updateEmpresaNome,
    refresh: () => fetchAll(3, true)
  };
}
