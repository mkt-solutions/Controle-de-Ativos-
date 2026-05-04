import React from 'react';
import { LayoutDashboard, Package, PieChart, Plus, Search, Filter, MoreVertical, Edit2, Trash2, MapPin, User, Calendar, ExternalLink, ArrowUpRight, TrendingUp, DollarSign, Box, Settings, Check, X, ClipboardCheck, History, Download, UserCheck, Camera, QrCode, Scan, Menu, MessageCircle, FileUp, Bell, Clock, AlertTriangle, Eye, Info, LogOut, Lock, Mail, Building2 } from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { motion, AnimatePresence } from 'motion/react';
import { useAssets } from './useAssets';
import { Asset, AssetStatus, AssetCategory, Category, AuditRecord } from './types';
import { supabase } from './lib/supabase';
import { cn, formatCurrency, formatDate } from './lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from 'recharts';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium",
      active 
        ? "bg-slate-800 text-blue-400" 
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    )}
  >
    <Icon size={18} className={cn("transition-transform duration-200", active ? "scale-110" : "group-hover:scale-110")} />
    <span>{label}</span>
  </button>
);

const StatCard = ({ label, value, trend, trendColor, onClick }: { label: string, value: string | number, trend?: string, trendColor?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all group",
      onClick ? "cursor-pointer hover:shadow-md hover:border-blue-200 active:scale-95" : ""
    )}
  >
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
    <h3 className="text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{value}</h3>
    {trend && (
      <p className={cn("text-xs mt-2 font-medium", trendColor || "text-slate-500")}>{trend}</p>
    )}
  </div>
);

// --- Components ---

const AuthScreen = ({ onAuthSuccess }: { onAuthSuccess: (user: any) => void }) => {
  const [isRegister, setIsRegister] = React.useState(true);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      if (isRegister) {
        // 1. Sign up user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              company_name: companyName,
            }
          }
        });
        
        if (authError) throw authError;
        if (!authData.user) throw new Error('Falha ao criar usuário');

        // 2. Create Empresa (Multi-tenant)
        // If registration used an existing empresa_id (invite flow), this would be different.
        // For self-signup, we create a new company.
        const empresaId = authData.user.id; // Using user ID as initial company ID is a common pattern for simplicity, or generate new
        
        const { error: empresaError } = await supabase
          .from('empresas')
          .insert([{ id: empresaId, nome: companyName }]);
        
        if (empresaError) throw empresaError;

        // 3. Create relationship
        const { error: relError } = await supabase
          .from('usuarios_empresa')
          .insert([{ 
            user_id: authData.user.id, 
            empresa_id: empresaId, 
            role: 'admin' 
          }]);
        
        if (relError) throw relError;

        onAuthSuccess(authData.user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) onAuthSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
              <Box className="text-white" size={32} />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">
            {isRegister ? 'Criar Nova Conta' : 'Acessar Sistema'}
          </h2>
          <p className="text-center text-slate-500 text-sm mb-8">
            {isRegister 
              ? 'Registre sua empresa para começar o controle.' 
              : 'Entre com suas credenciais para continuar.'}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Building2 size={12} /> Nome da Empresa
                </label>
                <input
                  required
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Tech Solutions Ltda"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Mail size={12} /> E-mail
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Lock size={12} /> Senha
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              />
            </div>

            <button
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-50 mt-6"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? 'Cadastrar Empresa' : 'Entrar no Sistema'}
                  <ArrowUpRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              {isRegister ? 'Já possui uma conta?' : 'Ainda não tem acesso?'}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="ml-2 text-blue-600 font-bold hover:underline"
              >
                {isRegister ? 'Fazer Log-in' : 'Criar Registro'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Views ---

const DashboardView = ({ stats, onMaintenanceClick, onViewAll }: { stats: any, onMaintenanceClick: () => void, onViewAll: () => void }) => {
  const COLORS = ['#3b82f6', '#818cf8', '#94a3b8', '#64748b', '#ef4444', '#1e293b'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total de Ativos" value={stats.totalAssets} trend="+12 este mês" trendColor="text-emerald-600" />
        <StatCard 
          label="Em Manutenção" 
          value={stats.byStatus.find((s:any) => s.name === 'Em Manutenção')?.value || 0} 
          trend="Ver detalhes" 
          trendColor="text-amber-600"
          onClick={onMaintenanceClick}
        />
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[100px] max-h-[100px] overflow-hidden">
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <div className="p-1.5 bg-red-50 rounded-lg">
              <Bell size={14} className="text-red-600" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alertas Próximos</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5">
            {stats.alerts && stats.alerts.length > 0 ? (
              stats.alerts.map((alert: any) => (
                <div key={`${alert.id}-${alert.type}-${alert.date}`} className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("p-1 rounded-full", alert.type === 'Garantia' ? "bg-blue-100" : "bg-amber-100")}>
                      {alert.type === 'Garantia' ? <Search size={8} /> : <Clock size={8} />}
                    </div>
                    <p className="text-[10px] font-medium text-slate-700 truncate">{alert.name}</p>
                  </div>
                  <p className={cn("text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded", alert.type === 'Garantia' ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700")}>
                    {alert.type} {alert.date.split('-').reverse().join('/')}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <Check size={16} className="mb-0.5" />
                <p className="text-[9px] font-medium">Nenhum alerta crítico</p>
              </div>
            )}
          </div>
        </div>

        <StatCard label="Valor Patrimonial" value={formatCurrency(stats.totalValue)} trend="Depreciação: 8%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[460px]">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h4 className="font-bold text-slate-800">Recém Cadastrados / Atualizados</h4>
            <button 
              onClick={onViewAll}
              className="text-blue-600 text-xs font-semibold hover:underline flex items-center gap-1"
            >
              Ver Todos <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Patrimônio</th>
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3">Categoria</th>
                  <th className="px-6 py-4 text-slate-500">Localização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.recentActivity.map((asset: Asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">#{asset.tag}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{asset.name}</td>
                    <td className="px-6 py-4 text-slate-500">{asset.category}</td>
                    <td className="px-6 py-4 text-slate-500">{asset.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
          <h4 className="font-bold text-slate-800 mb-6">Distribuição por Categoria</h4>
          <div className="flex-1 flex flex-col items-center">
            <div className="h-48 w-full relative mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={stats.byCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.byCategory.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-slate-800">{stats.totalAssets}</span>
                <span className="text-[10px] text-slate-400 uppercase font-black">Ativos</span>
              </div>
            </div>
            
            <div className="w-full space-y-3">
              {stats.byCategory.slice(0, 4).map((cat: any, idx: number) => (
                <div key={cat.name} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-slate-600">{cat.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{cat.value} un.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AssetListView = ({ assets, categories, initialStatusFilter, onDelete, onEdit, onBulkUpload }: { assets: Asset[], categories: Category[], initialStatusFilter?: string, onDelete: (id: string) => void, onEdit: (a: Asset) => void, onBulkUpload: (assets: any[]) => void }) => {
  const [search, setSearch] = React.useState('');
  const [filterCategory, setFilterCategory] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>(initialStatusFilter || 'all');
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);
      
      const mappedAssets = data.map(item => ({
        name: item.Nome || item.name || '',
        tag: String(item.Patrimonio || item.tag || ''),
        category: (item.Categoria || item.category || 'Outros') as AssetCategory,
        status: 'Ativo' as AssetStatus,
        value: Number(item.Valor || item.value || 0),
        purchaseDate: item['Data de Compra'] || item.purchaseDate || new Date().toISOString().split('T')[0],
        location: item.Localizacao || item.location || 'Nao Informado',
        maintenanceHistory: [],
        hasPreventiveMaintenance: false,
        maintenanceIntervalMonths: 0,
        hasWarranty: false,
      })).filter(a => a.name && a.tag);

      if (mappedAssets.length > 0) {
        onBulkUpload(mappedAssets);
        alert(`${mappedAssets.length} ativos importados com sucesso!`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filtered = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                          a.tag.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'all' || a.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Modelo_Importacao');

    worksheet.columns = [
      { header: 'Patrimonio', key: 'tag', width: 15 },
      { header: 'Nome', key: 'name', width: 30 },
      { header: 'Categoria', key: 'category', width: 20 },
      { header: 'Localizacao', key: 'location', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Valor', key: 'value', width: 15 },
      { header: 'Data Compra', key: 'purchaseDate', width: 15 }
    ];

    // Add an example row as instruction
    worksheet.addRow({
      tag: 'PAT001',
      name: 'Exemplo de Computador',
      category: 'Computadores',
      location: 'Escritório Central',
      status: 'Ativo',
      value: 3500.00,
      purchaseDate: '2024-01-15'
    });

    // Formatting headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, "Modelo_Importacao_Ativos.xlsx");
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario');

    worksheet.columns = [
      { header: 'Patrimonio', key: 'tag', width: 15 },
      { header: 'Nome', key: 'name', width: 30 },
      { header: 'Categoria', key: 'category', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Valor', key: 'value', width: 15 },
      { header: 'Data Compra', key: 'purchaseDate', width: 15 },
      { header: 'Localizacao', key: 'location', width: 20 }
    ];

    filtered.forEach(a => {
      worksheet.addRow({
        tag: a.tag,
        name: a.name,
        category: a.category,
        status: a.status,
        value: a.value,
        purchaseDate: a.purchaseDate,
        location: a.location
      });
    });

    // Formatting headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, "Inventario_Ativos.xlsx");
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-bottom border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-slate-800">Inventário Geral</h3>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="all">Todos Status</option>
            <option value="Ativo">Ativo</option>
            <option value="Em Manutenção">Em Manutenção</option>
            <option value="Emprestado">Emprestado</option>
            <option value="Inativo">Inativo</option>
          </select>
            <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="all">Todas Categorias</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
              title="Baixar modelo para preenchimento"
            >
              <Download size={16} /> Modelo
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
              title="Importar de arquivo Excel"
            >
              <FileUp size={16} /> Importar
            </button>
            <button 
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-100"
              title="Exportar lista atual para Excel"
            >
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Patrimônio</th>
              <th className="px-6 py-4">Item</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Localização</th>
              <th className="px-6 py-4">Manutenção</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((asset) => (
              <React.Fragment key={asset.id}>
                <tr className={cn(
                  "hover:bg-slate-50/50 transition-colors group",
                  expandedRowId === asset.id ? "bg-blue-50/30" : ""
                )}>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">#{asset.tag}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <p className="font-bold text-slate-800">{asset.name}</p>
                      {asset.status === 'Em Manutenção' && asset.maintenanceNotes && (
                        <p className="text-[10px] text-amber-600 mt-1 font-medium italic">
                          📍 {asset.maintenanceNotes}
                        </p>
                      )}
                      {asset.status === 'Inativo' && asset.inactiveReason && (
                        <p className="text-[10px] text-red-500 mt-1 font-medium leading-tight max-w-[150px]">
                          ⚠️ {asset.inactiveReason}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{asset.category}</td>
                  <td className="px-6 py-4 focus:outline-none">
                    <span className={cn(
                      "px-2 py-1 text-[10px] rounded-full uppercase font-bold",
                      asset.status === 'Ativo' ? "bg-emerald-100 text-emerald-700" :
                      asset.status === 'Em Manutenção' ? "bg-amber-100 text-amber-700" :
                      asset.status === 'Emprestado' ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{asset.location}</td>
                  <td className="px-6 py-4">
                    {asset.maintenanceHistory && asset.maintenanceHistory.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Gasto</p>
                        <p className="text-xs font-semibold text-red-600">{formatCurrency(asset.maintenanceHistory.reduce((acc, curr) => acc + curr.cost, 0))}</p>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 group-hover:opacity-100 opacity-20 transition-opacity">
                      <button 
                        onClick={() => setExpandedRowId(expandedRowId === asset.id ? null : asset.id)}
                        className={cn(
                          "p-1.5 transition-colors",
                          expandedRowId === asset.id ? "text-blue-600 bg-blue-50 rounded-lg" : "text-slate-400 hover:text-blue-600"
                        )}
                        title="Ver Ativo"
                      >
                        <Eye size={14} />
                      </button>
                      <button onClick={() => onEdit(asset)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Editar"><Edit2 size={14} /></button>
                      <button onClick={() => onDelete(asset.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Excluir"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
                {expandedRowId === asset.id && (
                  <tr>
                    <td colSpan={7} className="px-6 py-6 bg-slate-50 border-y border-slate-100 animate-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                             <Info size={12} /> Detalhes Gerais
                          </h4>
                          <div className="grid grid-cols-2 gap-y-3">
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Data de Compra</p>
                              <p className="text-xs text-slate-800">{formatDate(asset.purchaseDate)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Valor Original</p>
                              <p className="text-xs text-slate-800">{formatCurrency(asset.value)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Próxima Manutenção</p>
                              <p className="text-xs text-slate-800">
                                {asset.nextMaintenanceDate ? formatDate(asset.nextMaintenanceDate) : 'Não agendada'}
                                {asset.hasPreventiveMaintenance && asset.maintenanceIntervalMonths ? (
                                  <span className="text-[10px] text-blue-600 ml-1 font-bold">(Recorrente: {asset.maintenanceIntervalMonths}m)</span>
                                ) : null}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Garantia</p>
                              <p className={cn("text-xs", asset.hasWarranty ? "text-blue-600 font-bold" : "text-slate-500")}>
                                {asset.hasWarranty ? `Expira ${formatDate(asset.warrantyExpirationDate!)}` : 'Sem garantia'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                             <History size={12} /> Histórico de Manutenção
                          </h4>
                          <div className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-2">
                            {asset.maintenanceHistory && asset.maintenanceHistory.length > 0 ? (
                              asset.maintenanceHistory.map((h) => (
                                <div key={h.id} className="p-2 bg-white rounded border border-slate-200 text-[11px] flex justify-between items-start">
                                  <div>
                                    <p className="font-bold text-slate-800">{formatDate(h.date)}</p>
                                    <p className="text-slate-500 leading-tight mt-0.5">{h.notes}</p>
                                  </div>
                                  <span className="font-bold text-red-600">-{formatCurrency(h.cost)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-slate-400 italic py-4 text-center">Nenhuma manutenção registrada.</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
                             <MapPin size={12} /> Localização & Notas
                          </h4>
                          <div className="space-y-3">
                             <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Local Atual</p>
                                <p className="text-xs text-slate-800">{asset.location}</p>
                             </div>
                             {asset.description && (
                               <div>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">Observações</p>
                                  <p className="text-xs text-slate-600 leading-relaxed">{asset.description}</p>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReportsView = ({ assets, categories, audits }: { assets: Asset[], categories: Category[], audits: AuditRecord[] }) => {
  const calculateDepreciation = (originalValue: number, purchaseDate: string, categoryName: string) => {
    const purchase = new Date(purchaseDate);
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth());
    
    const category = categories.find(c => c.name === categoryName);
    const usefulLifeYears = category ? category.usefulLifeYears : 5;
    const usefulLifeMonths = usefulLifeYears * 12;
    
    const monthlyDepreciation = originalValue / usefulLifeMonths;
    const currentDepreciation = Math.min(originalValue, monthlyDepreciation * Math.max(0, monthsElapsed));
    const remainingValue = originalValue - currentDepreciation;
    
    return {
      depreciation: currentDepreciation,
      remaining: remainingValue,
      monthsRemaining: Math.max(0, usefulLifeMonths - monthsElapsed)
    };
  };

  const assetsWithMeta = assets.map(a => ({
    ...a,
    ...calculateDepreciation(a.value, a.purchaseDate, a.category)
  }));

  const totalOriginalValue = assets.reduce((acc, curr) => acc + curr.value, 0);
  const totalRemainingValue = assetsWithMeta.reduce((acc, curr) => acc + curr.remaining, 0);
  const totalDepreciation = totalOriginalValue - totalRemainingValue;

  // 1. Distribuição por Categoria
  const categoryData = categories.map(cat => ({
    name: cat.name,
    value: assets.filter(a => a.category === cat.name).length
  })).filter(c => c.value > 0);

  // 2. Locais
  const locationData = [...new Set(assets.map(a => a.location))].map(loc => ({
    name: loc,
    value: assets.filter(a => a.location === loc).length
  })).sort((a, b) => b.value - a.value).slice(0, 5);

  // 3. Status
  const statusData = ['Ativo', 'Em Manutenção', 'Inativo', 'Baixado', 'Emprestado'].map(s => ({
    name: s,
    value: assets.filter(a => a.status === s).length
  })).filter(s => s.value > 0);

  // 4. Idade dos ativos
  const ageData = assets.reduce((acc: any[], a) => {
    const age = new Date().getFullYear() - new Date(a.purchaseDate).getFullYear();
    const label = age === 0 ? 'Recente' : age === 1 ? '1 ano' : `${age} anos`;
    const existing = acc.find(i => i.name === label);
    if (existing) existing.value++;
    else acc.push({ name: label, value: 1, age });
    return acc;
  }, []).sort((a, b) => a.age - b.age);

  // 5. Depreciação vs Valor Atual
  const depreciationStacked = [
    { name: 'Status Financeiro', residual: totalRemainingValue, depreciação: totalDepreciation }
  ];

  // 6. Ativos próximos do fim da vida útil
  const nearEndOfLife = assetsWithMeta
    .filter(a => a.status !== 'Baixado')
    .sort((a, b) => a.monthsRemaining - b.monthsRemaining)
    .slice(0, 5)
    .map(a => ({
      name: a.tag,
      meses: a.monthsRemaining,
      fullName: a.name
    }));

  // 7. Manutenção Acumulada por Categoria
  const maintenanceData = categories.map(cat => ({
    name: cat.name,
    value: assets.filter(a => a.category === cat.name)
      .reduce((sum, a) => sum + (a.maintenanceHistory?.reduce((s, h) => s + h.cost, 0) || 0), 0)
  })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  // 8. Inventário
  const latestAudit = audits.filter(a => a.isFinalized).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const auditData = latestAudit ? [
    { name: 'Encontrados', value: latestAudit.verifiedIds.length },
    { name: 'Não Encontrados', value: latestAudit.allAssetsSnapshot.length - latestAudit.verifiedIds.length }
  ] : [];

  const exportAccountingReport = async () => {
    const workbook = new ExcelJS.Workbook();
    const dateStr = new Date().toLocaleDateString('pt-BR').split('/').join('-');
    const filename = `relatorio_patrimonial_${dateStr}.xlsx`;
    
    // Helper to calculate data for export
    const assetsWithMeta = assets.map(a => ({
      ...a,
      ...calculateDepreciation(a.value, a.purchaseDate, a.category)
    }));

    // 1. Aba: Resumo
    const wsResumo = workbook.addWorksheet('Resumo');
    wsResumo.columns = [
      { header: 'Descrição', key: 'desc', width: 30 },
      { header: 'Valor / Quantidade', key: 'val', width: 25 }
    ];

    const statsResumo = {
      totalAssets: assets.length,
      totalOriginal: assets.reduce((sum, a) => sum + a.value, 0),
      totalDepreciation: assetsWithMeta.reduce((sum, a) => sum + a.depreciation, 0),
      totalCurrent: assetsWithMeta.reduce((sum, a) => sum + a.remaining, 0)
    };

    wsResumo.addRows([
      { desc: 'RELATÓRIO PATRIMONIAL CONSOLIDADO', val: '' },
      { desc: 'Data de Emissão', val: new Date().toLocaleDateString('pt-BR') },
      { desc: '', val: '' },
      { desc: 'TOTAIS GERAIS', val: '' },
      { desc: 'Total de Ativos', val: statsResumo.totalAssets },
      { desc: 'Valor Total Original', val: statsResumo.totalOriginal },
      { desc: 'Depreciação Acumulada Total', val: statsResumo.totalDepreciation },
      { desc: 'Valor Atual Total', val: statsResumo.totalCurrent },
      { desc: '', val: '' },
      { desc: 'ATIVOS POR STATUS', val: '' }
    ]);

    statusData.forEach(s => {
      wsResumo.addRow({ desc: s.name, val: s.value });
    });

    wsResumo.addRow({ desc: '', val: '' });
    wsResumo.addRow({ desc: 'ATIVOS POR CATEGORIA', val: '' });
    categoryData.forEach(c => {
      wsResumo.addRow({ desc: c.name, val: c.value });
    });

    // Styling Resumo
    wsResumo.getRow(1).font = { bold: true, size: 14 };
    [4, 10, 16].forEach(rowIdx => wsResumo.getRow(rowIdx).font = { bold: true });
    
    wsResumo.getColumn(2).numFmt = '"R$ "#,##0.00';
    // Fix non-currency numbers in Column 2
    [2, 5].forEach(rowIdx => wsResumo.getCell(`B${rowIdx}`).numFmt = '0');

    // 2. Aba: Ativos
    const wsAtivos = workbook.addWorksheet('Ativos');
    wsAtivos.columns = [
      { header: 'ID do Ativo', key: 'id', width: 10 },
      { header: 'Nome do Ativo', key: 'name', width: 30 },
      { header: 'Categoria', key: 'category', width: 20 },
      { header: 'Número Patrimônio', key: 'tag', width: 15 },
      { header: 'Localização', key: 'location', width: 20 },
      { header: 'Responsável', key: 'auditor', width: 20 },
      { header: 'Data Compra', key: 'purchaseDate', width: 15 },
      { header: 'Valor Original', key: 'value', width: 15 },
      { header: 'Vida Útil (Anos)', key: 'usefulLife', width: 15 },
      { header: 'Valor Residual', key: 'remaining', width: 15 },
      { header: 'Depreciação Acum.', key: 'depreciation', width: 15 },
      { header: 'Valor Atual', key: 'current', width: 15 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    assetsWithMeta.forEach(a => {
      const cat = categories.find(c => c.name === a.category);
      wsAtivos.addRow({
        id: a.id.slice(-6),
        name: a.name,
        category: a.category,
        tag: a.tag,
        location: a.location,
        auditor: '-',
        purchaseDate: new Date(a.purchaseDate),
        value: a.value,
        usefulLife: cat?.usefulLifeYears || 0,
        remaining: a.remaining,
        depreciation: a.depreciation,
        current: a.remaining,
        status: a.status
      });
    });

    // 3. Aba: Depreciação
    const wsDepr = workbook.addWorksheet('Depreciação');
    wsDepr.columns = [
      { header: 'Nome do Ativo', key: 'name', width: 30 },
      { header: 'Valor Original', key: 'value', width: 15 },
      { header: 'Valor Residual', key: 'residual', width: 15 },
      { header: 'Vida Útil (Anos)', key: 'usefulLife', width: 15 },
      { header: 'Meses Decorridos', key: 'months', width: 15 },
      { header: 'Depreciação Mensal', key: 'monthly', width: 15 },
      { header: 'Depreciação Acumulada', key: 'accumulated', width: 20 },
      { header: 'Valor Atual', key: 'current', width: 15 }
    ];

    assetsWithMeta.forEach(a => {
      const cat = categories.find(c => c.name === a.category);
      const usefulLifeMonths = (cat?.usefulLifeYears || 5) * 12;
      const purchase = new Date(a.purchaseDate);
      const now = new Date();
      const monthsElapsed = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth());
      const monthlyRate = a.value / usefulLifeMonths;

      wsDepr.addRow({
        name: a.name,
        value: a.value,
        residual: 0,
        usefulLife: cat?.usefulLifeYears || 0,
        months: Math.max(0, monthsElapsed),
        monthly: monthlyRate,
        accumulated: a.depreciation,
        current: a.remaining
      });
    });

    // 4. Aba: Inventário
    const wsInv = workbook.addWorksheet('Inventário');
    wsInv.columns = [
      { header: 'Nome do Ativo', key: 'name', width: 30 },
      { header: 'Localização Esperada', key: 'locExp', width: 25 },
      { header: 'Localização Atual', key: 'locActual', width: 25 },
      { header: 'Status Conferência', key: 'status', width: 20 },
      { header: 'Data Última Verificação', key: 'date', width: 20 }
    ];

    if (latestAudit) {
      latestAudit.allAssetsSnapshot.forEach(item => {
        const found = latestAudit.verifiedIds.includes(item.id);
        wsInv.addRow({
          name: item.name,
          locExp: item.location,
          locActual: found ? item.location : 'NÃO LOCALIZADO',
          status: found ? 'ENCONTRADO' : 'NÃO ENCONTRADO',
          date: new Date(latestAudit.date)
        });
      });
    }

    // Comum a todas as abas técnicas
    [wsAtivos, wsDepr, wsInv].forEach(ws => {
      // Freeze header
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      
      // Filter columns
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columns.length }
      };

      // Header style
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      // Formatting currency columns
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell, colNumber) => {
          const header = ws.getColumn(colNumber).header as string;
          if (header?.includes('Valor') || header?.includes('Depreciação') || header?.includes('Original') || header?.includes('Atual') || header?.includes('Mensal')) {
            cell.numFmt = '"R$ "#,##0.00';
          }
          if (header?.includes('Data')) {
            cell.numFmt = 'dd/mm/yyyy';
          }
        });
      });
    });

    // Adicionando fórmulas de soma nas abas Ativos e Depreciação
    const addSumRow = (ws: ExcelJS.Worksheet) => {
      const lastRowNumber = ws.rowCount;
      const sumRow = ws.addRow({});
      ws.columns.forEach((col, colIdx) => {
        if (col.header?.includes('Valor') || col.header?.includes('Depreciação') || col.header?.includes('Original') || col.header?.includes('Atual')) {
          const colLetter = String.fromCharCode(65 + colIdx);
          sumRow.getCell(colIdx + 1).value = { formula: `SUM(${colLetter}2:${colLetter}${lastRowNumber})` };
          sumRow.getCell(colIdx + 1).numFmt = '"R$ "#,##0.00';
          sumRow.getCell(colIdx + 1).font = { bold: true };
        }
      });
    };
    
    addSumRow(wsAtivos);
    addSumRow(wsDepr);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899', '#14b8a6'];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Relatórios Analíticos</h2>
          <p className="text-slate-500 text-sm">Visão geral detalhada do patrimônio e saúde operacional.</p>
        </div>
        <button
          onClick={exportAccountingReport}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 uppercase tracking-wider"
        >
          <Download size={18} />
          Exportar Contabilidade
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Residual Total</p>
          <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(totalRemainingValue)}</h3>
          <p className="text-xs text-slate-500 mt-2">Valor atual descontando depreciação (calculado por categoria)</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Acúmulo de Depreciação</p>
          <h3 className="text-2xl font-bold text-red-600">-{formatCurrency(totalDepreciation)}</h3>
          <p className="text-xs text-slate-500 mt-2">Perda de valor estimada desde a aquisição</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Categoria */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 px-2">Distribuição por Categoria</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                  {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Locais */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 px-2">Principais Locais</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} width={100} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Status */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 px-2">Status dos Ativos</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={80}>
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Idade */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 px-2">Idade do Patrimônio</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Depreciação x Valor Atual */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 px-2">Valor Residual vs Depreciação</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depreciationStacked} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" hide />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="residual" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={40} />
                <Bar dataKey="depreciação" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#10b981] rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Valor Atual</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ef4444] rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Depreciação</span></div>
            </div>
          </div>
        </div>

        {/* 6. Fim da vida útil */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-bold text-slate-800">Próximos do Fim da Vida Útil</h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Meses Restantes</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nearEndOfLife} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} width={80} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="meses" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7. Manutenção */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 px-2">Custo de Manutenção Acumulado</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maintenanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} tickFormatter={(val) => `R$ ${val/1000}k`} />
                <Tooltip cursor={{fill: '#f8fafc'}} formatter={(val: number) => formatCurrency(val)} />
                <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 8. Inventário */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-bold text-slate-800">Resultado do Último Inventário</h3>
            {latestAudit && <span className="text-[10px] text-slate-400 font-bold">{formatDate(latestAudit.date)}</span>}
          </div>
          <div className="h-64">
            {auditData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={auditData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">Nenhum inventário finalizado encontrado.</div>
            )}
            <div className="flex gap-4 justify-center mt-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#10b981] rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Encontrados</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ef4444] rounded-sm"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Não Encontrados</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" 
        />
        <motion.div
           initial={{ opacity: 0, scale: 0.98, y: 10 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.98, y: 10 }}
           className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 border border-slate-200"
        >
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">&times;</button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Entry Point ---

const CategoriesView = ({ categories, onAdd, onUpdate, onRemove }: { categories: Category[], onAdd: (name: string, life: number) => void, onUpdate: (id: string, updates: Partial<Category>) => void, onRemove: (id: string) => void }) => {
  const [newCat, setNewCat] = React.useState('');
  const [newLife, setNewLife] = React.useState<number>(10);

  const DEFAULT_LIVES: Record<string, number> = {
    'Hardware': 5,
    'Software': 5,
    'Mobiliário': 10,
    'Veículos': 10,
    'Imóveis': 20,
    'Computadores': 5
  };

  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleApplyUpdates = () => {
    setIsUpdating(true);
    // Visual feedback for calculation update
    setTimeout(() => {
      setIsUpdating(false);
    }, 800);
  };

  const handleNameChange = (val: string) => {
    setNewCat(val);
    if (DEFAULT_LIVES[val]) {
      setNewLife(DEFAULT_LIVES[val]);
    }
  };

  const handleAdd = () => {
    if (newCat.trim()) {
      onAdd(newCat.trim(), newLife);
      setNewCat('');
      setNewLife(10);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 animate-in zoom-in-95 duration-500 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-800">Gerenciar Categorias</h3>
        <button 
          onClick={handleApplyUpdates}
          disabled={isUpdating}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            isUpdating 
              ? 'bg-emerald-50 text-emerald-600' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {isUpdating ? (
            <>
              <Check size={14} className="animate-bounce" />
              ATUALIZADO
            </>
          ) : (
            <>
              <History size={14} />
              ATUALIZAR ITENS
            </>
          )}
        </button>
      </div>

      <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed font-medium">
          Verifique sempre junto ao seu contador a vida útil que está sendo usada na sua empresa. Atualize os valores sempre que necessário.
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2 mb-8">
        <div className="flex-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Nome da Categoria</label>
          <input 
            type="text" 
            placeholder="Nova categoria..." 
            value={newCat}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="w-full sm:w-32">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Vida Útil (Anos)</label>
          <input 
            type="number" 
            min="1"
            value={newLife}
            onChange={(e) => setNewLife(Number(e.target.value))}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-end">
          <button 
            onClick={handleAdd}
            className="bg-blue-600 px-4 py-2 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all flex items-center gap-2 h-[38px]"
          >
            <Plus size={18} /> Adicionar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group">
            <div className="flex items-center gap-4 flex-1">
              <span className="text-sm font-medium text-slate-700 min-w-[120px]">{cat.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Vida Útil:</span>
                <input 
                  type="number"
                  min="1"
                  value={cat.usefulLifeYears}
                  onChange={(e) => onUpdate(cat.id, { usefulLifeYears: Number(e.target.value) })}
                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 font-bold uppercase">Anos</span>
              </div>
            </div>
            <button 
              onClick={() => onRemove(cat.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const Scanner = ({ onScan }: { onScan: (decodedText: string) => void }) => {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // Prioritize back camera
          config,
          (decodedText) => {
            onScan(decodedText);
          },
          () => {} // silent failure for frames without matches
        );
        setError(null);
      } catch (err) {
        console.error("Erro ao iniciar câmera:", err);
        setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      }
    };

    startScanner();

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Erro ao parar scanner:", err));
      }
    };
  }, [onScan]);

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden shadow-2xl relative min-h-[300px] flex flex-col">
      <div id="reader" className="w-full h-full flex-1"></div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-6 text-center">
          <div className="text-white">
            <Camera size={32} className="mx-auto mb-3 text-red-500" />
            <p className="text-sm font-medium">{error}</p>
            <p className="text-xs text-slate-400 mt-2">Certifique-se de que o site tem permissão para usar a câmera.</p>
          </div>
        </div>
      )}
      <div className="p-4 bg-slate-800 text-white text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
          <Scan size={14} className="animate-pulse" /> Escaneando Código...
        </p>
      </div>
    </div>
  );
};

const AuditView = ({ audits, startAudit, toggleAssetAudit, finalizeAudit, deleteAudit }: { audits: AuditRecord[], startAudit: (name: string) => void, toggleAssetAudit: (auditId: string, assetId: string) => void, finalizeAudit: (auditId: string) => void, deleteAudit: (id: string) => void }) => {
  const activeAudit = audits.find(a => !a.isFinalized);
  const [showStartModal, setShowStartModal] = React.useState(false);
  const [auditorName, setAuditorName] = React.useState('');
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);

  const handleScan = React.useCallback((decodedText: string) => {
    if (!activeAudit) return;

    // The tag scanned might include the # prefix or not
    const cleanScan = decodedText.startsWith('#') ? decodedText.slice(1) : decodedText;
    
    const asset = activeAudit.allAssetsSnapshot.find(a => 
      a.tag.toLowerCase() === cleanScan.toLowerCase() || 
      a.tag.toLowerCase() === decodedText.toLowerCase()
    );

    if (asset) {
      if (!activeAudit.verifiedIds.includes(asset.id)) {
        toggleAssetAudit(activeAudit.id, asset.id);
      }
    }
  }, [activeAudit, toggleAssetAudit]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (auditorName.trim()) {
      startAudit(auditorName.trim());
      setAuditorName('');
      setShowStartModal(false);
    }
  };

  const exportToExcel = async (audit: AuditRecord) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Conferencia');

    worksheet.columns = [
      { header: 'Codigo Patrimonio', key: 'tag', width: 20 },
      { header: 'Localizado', key: 'status', width: 20 },
      { header: 'Item', key: 'name', width: 30 },
      { header: 'Categoria', key: 'category', width: 20 },
      { header: 'Valor', key: 'value', width: 15 },
      { header: 'Data da Leitura', key: 'date', width: 20 },
      { header: 'Responsavel', key: 'auditor', width: 20 }
    ];

    audit.allAssetsSnapshot.forEach(item => {
      const isVerified = audit.verifiedIds.includes(item.id);
      const row = worksheet.addRow({
        tag: `#${item.tag}`,
        status: isVerified ? 'LOCALIZADO' : 'NAO LOCALIZADO',
        name: item.name,
        category: item.category,
        value: item.value,
        date: formatDate(audit.date),
        auditor: audit.auditorName || 'N/A'
      });

      // Style Column B (Status)
      const statusCell = row.getCell(2);
      if (isVerified) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' } // Green
        };
        statusCell.font = { color: { argb: 'FF000000' }, bold: true };
      } else {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFC7CE' } // Red
        };
        statusCell.font = { color: { argb: 'FF000000' }, bold: true };
      }
    });

    // Formatting headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Relatorio_Controle_${audit.date.split('T')[0]}.xlsx`);
  };

  const sendToWhatsApp = (audit: AuditRecord) => {
    const total = audit.allAssetsSnapshot.length;
    const found = audit.verifiedIds.length;
    const notFound = audit.allAssetsSnapshot.filter(a => !audit.verifiedIds.includes(a.id));

    let message = `*RELATÓRIO DE CONFERÊNCIA FÍSICA*\n`;
    message += `📅 Data: ${formatDate(audit.date)}\n`;
    message += `👤 Responsável: ${audit.auditorName}\n`;
    message += `✅ Localizados: ${found} / ${total}\n\n`;

    if (notFound.length > 0) {
      message += `❌ *ITENS NÃO LOCALIZADOS:*\n`;
      notFound.forEach(item => {
        message += `• #${item.tag} - ${item.name}\n`;
      });
    } else {
      message += `✨ Todos os itens foram localizados com sucesso!`;
    }

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {activeAudit ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-slate-100 bg-blue-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="p-2 lg:p-3 bg-white rounded-lg shadow-sm shrink-0">
                <UserCheck size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base lg:text-lg font-bold text-slate-800 truncate">Controle: {activeAudit.auditorName}</h3>
                <p className="text-[10px] lg:text-xs text-slate-500">Iniciada em {formatDate(activeAudit.date)}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 lg:gap-3 justify-between sm:justify-end">
              <div className="text-left sm:text-right mr-2 lg:mr-4 text-slate-500">
                <p className="text-[9px] lg:text-[10px] font-bold uppercase">Conferidos</p>
                <p className="text-xs lg:text-sm font-bold text-blue-600">{activeAudit.verifiedIds.length} / {activeAudit.allAssetsSnapshot.length}</p>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsScannerOpen(!isScannerOpen)}
                  className={cn(
                    "px-3 py-2 text-[10px] lg:text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2",
                    isScannerOpen ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {isScannerOpen ? <X size={14} /> : <Scan size={14} />} 
                  <span className="hidden xs:inline">{isScannerOpen ? 'FECHAR LER' : 'LER CÓDIGO'}</span>
                  <span className="xs:hidden">{isScannerOpen ? 'FECHAR' : 'LER'}</span>
                </button>
                <button 
                  onClick={() => finalizeAudit(activeAudit.id)}
                  className="px-3 py-2 bg-emerald-600 text-white text-[10px] lg:text-xs font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                   <Check size={14} /> <span className="hidden xs:inline">FINALIZAR SESSÃO</span><span className="xs:hidden">FINALIZAR</span>
                </button>
                <button 
                  onClick={() => deleteAudit(activeAudit.id)}
                  className="px-3 py-2 bg-white border border-red-200 text-red-600 text-[10px] lg:text-xs font-bold rounded-lg shadow-sm hover:bg-red-50 transition-all flex items-center gap-2"
                  title="Desistir da leitura e apagar sessão atual"
                >
                   <Trash2 size={14} /> <span className="hidden xs:inline">VOLTAR / CANCELAR</span><span className="xs:hidden">VOLTAR</span>
                </button>
              </div>
            </div>
          </div>
          <AnimatePresence>
            {isScannerOpen && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-100 p-6 border-b border-slate-200"
              >
                <div className="max-w-md mx-auto">
                  <Scanner onScan={handleScan} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 w-12 text-center">Status</th>
                  <th className="px-6 py-4">Patrimônio</th>
                  <th className="px-6 py-4">Item</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeAudit.allAssetsSnapshot.map((item) => {
                  const isVerified = activeAudit.verifiedIds.includes(item.id);
                  return (
                    <tr key={item.id} className={cn("transition-colors", isVerified ? "bg-emerald-50/30" : "hover:bg-slate-50")}>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => toggleAssetAudit(activeAudit.id, item.id)}
                          className={cn(
                            "w-6 h-6 mx-auto rounded border flex items-center justify-center transition-all",
                            isVerified 
                              ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" 
                              : "border-slate-300 text-transparent hover:border-slate-400"
                          )}
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">#{item.tag}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
           <ClipboardCheck size={48} className="text-slate-300 mb-4" />
           <h3 className="text-lg font-bold text-slate-800">Pronto para conferência?</h3>
           <p className="text-slate-500 text-sm mb-6">Inicie uma nova verificação para conferir seus ativos fisicamente.</p>
           <button 
             onClick={() => setShowStartModal(true)}
             className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-sm"
           >
             + INICIAR NOVO CONTROLE
           </button>
        </div>
      )}

      {audits.length > 0 && audits.some(a => a.isFinalized) && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <History size={14} /> Histórico de Verificações
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audits.filter(a => a.isFinalized).map((audit) => {
              const pendingCount = audit.allAssetsSnapshot.length - audit.verifiedIds.length;
              return (
                <div key={audit.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md relative group flex flex-col">
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => sendToWhatsApp(audit)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Enviar por WhatsApp"
                    >
                      <MessageCircle size={14} />
                    </button>
                    <button 
                      onClick={() => exportToExcel(audit)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                      title="Exportar para Excel"
                    >
                      <Download size={14} />
                    </button>
                    <button 
                      onClick={() => deleteAudit(audit.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "p-2 rounded-lg",
                      pendingCount === 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                    )}>
                      <ClipboardCheck size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{formatDate(audit.date)}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Resp: {audit.auditorName}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Localizados</p>
                      <p className="text-sm font-bold text-emerald-600">{audit.verifiedIds.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Pendentes</p>
                      <p className={cn("text-sm font-bold", pendingCount > 0 ? "text-red-600" : "text-emerald-600")}>{pendingCount}</p>
                    </div>
                  </div>
                  {pendingCount > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex-1 overflow-hidden">
                      <p className="text-[10px] font-bold text-red-500 uppercase mb-2">Não Localizados:</p>
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {audit.allAssetsSnapshot.filter(item => !audit.verifiedIds.includes(item.id)).map(item => (
                          <div key={item.id} className="text-[11px] text-slate-500 flex justify-between bg-slate-50 px-2 py-1 rounded border border-slate-100/50">
                            <span>{item.name}</span>
                            <span className="font-mono text-[9px] opacity-70 tracking-tighter">#{item.tag}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => exportToExcel(audit)}
                      className="py-2 border border-emerald-100 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] lg:text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download size={14} /> EXCEL
                    </button>
                    <button 
                      onClick={() => sendToWhatsApp(audit)}
                      className="py-2 border border-emerald-100 bg-[#25D366]/10 text-[#075E54] rounded-lg text-[10px] lg:text-xs font-bold hover:bg-[#25D366]/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={14} /> WHATSAPP
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Start Audit Modal */}
      <Modal 
        isOpen={showStartModal} 
        onClose={() => setShowStartModal(false)}
        title="Nome do Auditor"
      >
        <form onSubmit={handleStart} className="space-y-4">
          <p className="text-sm text-slate-500">Informe o nome do colaborador que realizará a contagem física dos ativos.</p>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Nome Completo</label>
            <input 
              autoFocus
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Ex: João Silva de Souza"
            />
          </div>
          <button 
            type="submit"
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
          >
            Começar Verificação <ArrowUpRight size={18} />
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default function App() {
  const { assets, categories, audits, loading, addCategory, updateCategory, removeCategory, stats, addAsset, updateAsset, deleteAsset, bulkAddAssets, startAudit, toggleAssetAudit, finalizeAudit, deleteAudit } = useAssets();
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [view, setView] = React.useState<'dashboard' | 'list' | 'reports' | 'categories' | 'audit'>('dashboard');
  
  // Check auth on load
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser({
          ...session.user,
          companyName: session.user.user_metadata?.company_name
        });
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser({
          ...session.user,
          companyName: session.user.user_metadata?.company_name
        });
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAuthSuccess = (user: any) => {
    setCurrentUser({
      ...user,
      companyName: user.user_metadata?.company_name
    });
    setIsAuthenticated(true);
  };
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingAsset, setEditingAsset] = React.useState<Asset | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<AssetStatus>('Ativo');
  const [hasWarranty, setHasWarranty] = React.useState<boolean>(false);
  const [hasPreventiveMaintenance, setHasPreventiveMaintenance] = React.useState<boolean>(false);
  const [initialListStatus, setInitialListStatus] = React.useState<string>('all');

  const navigateToFilteredList = (status: string) => {
    setInitialListStatus(status);
    setView('list');
  };

  // Reset initial filter when manual navigation happens or view changes
  React.useEffect(() => {
    if (view !== 'list') {
      setInitialListStatus('all');
    }
  }, [view]);

  React.useEffect(() => {
    if (editingAsset) {
      setSelectedStatus(editingAsset.status);
      setHasWarranty(editingAsset.hasWarranty || false);
      setHasPreventiveMaintenance(editingAsset.hasPreventiveMaintenance || false);
    } else {
      setSelectedStatus('Ativo');
      setHasWarranty(false);
      setHasPreventiveMaintenance(false);
    }
  }, [editingAsset, isModalOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const status = formData.get('status') as AssetStatus;
    const maintenanceCost = Number(formData.get('maintenanceCost') || 0);
    const maintenanceNotes = formData.get('maintenanceNotes') as string || '';
    const hasWarrantyValue = formData.get('hasWarranty') === 'on';
    const hasPreventiveValue = formData.get('hasPreventiveMaintenance') === 'on';
    
    let maintenanceHistory = editingAsset?.maintenanceHistory || [];
    if (status === 'Em Manutenção' && maintenanceCost > 0) {
      maintenanceHistory = [
        ...maintenanceHistory,
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          cost: maintenanceCost,
          notes: maintenanceNotes,
        }
      ];
    }

    const data = {
      name: formData.get('name') as string,
      tag: formData.get('tag') as string,
      category: formData.get('category') as AssetCategory,
      status,
      value: Number(formData.get('value')),
      purchaseDate: formData.get('purchaseDate') as string,
      location: formData.get('location') as string,
      nextMaintenanceDate: formData.get('nextMaintenanceDate') as string || '',
      maintenanceIntervalMonths: Number(formData.get('maintenanceIntervalMonths') || 0),
      hasPreventiveMaintenance: hasPreventiveValue,
      hasWarranty: hasWarrantyValue,
      warrantyExpirationDate: formData.get('warrantyExpirationDate') as string || '',
      maintenanceNotes,
      inactiveReason: formData.get('inactiveReason') as string || '',
      maintenanceHistory,
    };

    if (editingAsset) {
      updateAsset(editingAsset.id, data);
    } else {
      addAsset(data);
    }
    setIsModalOpen(false);
    setEditingAsset(null);
  };

  if (isAuthenticated === null) return null; // Loading state

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setIsModalOpen(true);
  };

  return (
    <div className="w-full h-screen bg-slate-50 text-slate-900 font-sans flex overflow-hidden relative">
      {/* Sidebar Overlay (Mobile Only) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col border-r border-slate-800 transition-transform duration-300 transform lg:translate-x-0 lg:static lg:inset-auto shrink-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">AF</div>
              <span className="text-white font-semibold text-lg tracking-tight">AssetFlow</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-slate-400 hover:text-white lg:hidden"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="space-y-1">
            <SidebarItem icon={LayoutDashboard} label="Painel Geral" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }} />
            <SidebarItem icon={Box} label="Inventário" active={view === 'list'} onClick={() => { setView('list'); setIsSidebarOpen(false); }} />
            <SidebarItem icon={ClipboardCheck} label="Controle" active={view === 'audit'} onClick={() => { setView('audit'); setIsSidebarOpen(false); }} />
            <SidebarItem icon={PieChart} label="Relatórios" active={view === 'reports'} onClick={() => { setView('reports'); setIsSidebarOpen(false); }} />
            <SidebarItem icon={Settings} label="Configurações" active={view === 'categories'} onClick={() => { setView('categories'); setIsSidebarOpen(false); }} />
            <a 
              href="https://mkt-solutions.com.br/placas-de-patrimonio/#cotacao" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <ExternalLink size={18} className="transition-transform duration-200 group-hover:scale-110" />
              <span>Pedir novas placas</span>
            </a>
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                {currentUser?.companyName?.charAt(0) || 'U'}
              </div>
              <div className="text-xs text-slate-400 min-w-0">
                <p className="text-white font-medium truncate">{currentUser?.companyName || 'Empresa'}</p>
                <p className="truncate">{currentUser?.email}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut size={18} />
              Sair da conta
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-20">
          <div className="flex items-center gap-3 lg:gap-8 overflow-hidden">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden shrink-0"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-base lg:text-lg font-bold text-slate-800 leading-none truncate min-w-fit">
              {view === 'dashboard' ? 'Painel Geral' : view === 'list' ? 'Inventário' : view === 'reports' ? 'Relatórios' : view === 'audit' ? 'Controle Físico' : 'Configurações'}
            </h2>
            <div className="relative hidden md:block w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input 
                type="text" 
                placeholder="Buscar ativos..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ring-inset outline-none transition-all" 
              />
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 shrink-0">
            {view !== 'categories' && view !== 'audit' && (
              <button 
                onClick={() => { setEditingAsset(null); setIsModalOpen(true); }}
                className="px-3 lg:px-4 py-2 bg-blue-600 text-white text-[10px] lg:text-xs font-bold rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap"
              >
                + NOVO <span className="hidden sm:inline">ATIVO</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile Search Bar (only shown on small screens) */}
        <div className="p-4 bg-white border-b border-slate-100 md:hidden block shrink-0">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={16} />
            </span>
            <input 
              type="text" 
              placeholder="Buscar ativos..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ring-inset outline-none transition-all" 
            />
          </div>
        </div>

        {/* Scrollable Region */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {view === 'dashboard' && (
            <DashboardView 
              stats={stats} 
              onMaintenanceClick={() => navigateToFilteredList('Em Manutenção')} 
              onViewAll={() => setView('list')}
            />
          )}
          {view === 'list' && (
            <AssetListView 
              assets={assets.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.tag.toLowerCase().includes(searchTerm.toLowerCase()))} 
              categories={categories}
              initialStatusFilter={initialListStatus}
              onDelete={deleteAsset} 
              onEdit={handleEdit} 
              onBulkUpload={bulkAddAssets}
            />
          )}
          {view === 'reports' && <ReportsView assets={assets} categories={categories} audits={audits} />}
          {view === 'categories' && <CategoriesView categories={categories} onAdd={addCategory} onUpdate={updateCategory} onRemove={removeCategory} />}
          {view === 'audit' && <AuditView audits={audits} startAudit={startAudit} toggleAssetAudit={toggleAssetAudit} finalizeAudit={finalizeAudit} deleteAudit={deleteAudit} />}
        </div>
      </main>

      {/* Modal Form */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingAsset(null); }} 
        title={editingAsset ? "Editar Ativo" : "Cadastrar Ativo"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Nome do Ativo</label>
            <input name="name" defaultValue={editingAsset?.name} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Tag de Patrimônio</label>
              <input name="tag" defaultValue={editingAsset?.tag} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Categoria</label>
              <select name="category" defaultValue={editingAsset?.category} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Status</label>
              <select 
                name="status" 
                defaultValue={editingAsset?.status} 
                onChange={(e) => setSelectedStatus(e.target.value as AssetStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Ativo">Ativo</option>
                <option value="Em Manutenção">Em Manutenção</option>
                <option value="Emprestado">Emprestado</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Data de Compra</label>
              <input name="purchaseDate" type="date" defaultValue={editingAsset?.purchaseDate || new Date().toISOString().split('T')[0]} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer mb-2 px-1">
                <input 
                  name="hasPreventiveMaintenance" 
                  type="checkbox" 
                  checked={hasPreventiveMaintenance}
                  onChange={(e) => setHasPreventiveMaintenance(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" 
                />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">Manutenção Preventiva?</span>
              </label>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer mb-2 px-1">
                <input 
                  name="hasWarranty" 
                  type="checkbox" 
                  checked={hasWarranty}
                  onChange={(e) => setHasWarranty(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" 
                />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">Possui Garantia?</span>
              </label>
            </div>
          </div>

          <AnimatePresence>
            {hasPreventiveMaintenance && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Próxima Manutenção</label>
                    <input 
                      name="nextMaintenanceDate" 
                      type="date" 
                      defaultValue={editingAsset?.nextMaintenanceDate} 
                      required={hasPreventiveMaintenance}
                      className="w-full px-3 py-2 bg-slate-50 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light]" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Se repete em (meses)</label>
                    <input 
                      name="maintenanceIntervalMonths" 
                      type="number" 
                      min="1"
                      placeholder="Ex: 6"
                      defaultValue={editingAsset?.maintenanceIntervalMonths} 
                      className="w-full px-3 py-2 bg-slate-50 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {hasWarranty && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Garantia expira em</label>
                <input 
                  name="warrantyExpirationDate" 
                  type="date" 
                  defaultValue={editingAsset?.warrantyExpirationDate} 
                  required={hasWarranty}
                  className="w-full px-3 py-2 bg-slate-50 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light]" 
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Valor (BRL)</label>
              <input name="value" type="number" defaultValue={editingAsset?.value} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Localização</label>
              <input name="location" defaultValue={editingAsset?.location} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <AnimatePresence>
            {selectedStatus === 'Em Manutenção' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Valor da Manutenção (BRL)</label>
                    <input 
                      name="maintenanceCost" 
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Empresa / Local</label>
                    <input 
                      name="maintenanceNotes" 
                      defaultValue={editingAsset?.maintenanceNotes} 
                      placeholder="Ex: Oficina Central"
                      className="w-full px-3 py-2 bg-slate-50 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" 
                    />
                  </div>
                </div>
                {editingAsset?.maintenanceHistory && editingAsset.maintenanceHistory.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Histórico Recente</p>
                    <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                      {editingAsset.maintenanceHistory.map((h) => (
                        <div key={h.id} className="flex justify-between text-[11px] text-slate-600 border-b border-white pb-1">
                          <span>{formatDate(h.date)}</span>
                          <span className="font-bold text-red-600">-{formatCurrency(h.cost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
            {selectedStatus === 'Inativo' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Motivo da Inativação</label>
                <textarea 
                  name="inactiveReason" 
                  defaultValue={editingAsset?.inactiveReason} 
                  required={selectedStatus === 'Inativo'}
                  placeholder="Ex: Item avariado sem conserto, obsolescência técnica..."
                  className="w-full px-3 py-2 bg-slate-50 border border-red-200 ring-2 ring-red-50 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none min-h-[80px]" 
                />
              </motion.div>
            )}
          </AnimatePresence>
          <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all mt-4 tracking-wide uppercase">
            {editingAsset ? "Atualizar Registro" : "Salvar Ativo"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
