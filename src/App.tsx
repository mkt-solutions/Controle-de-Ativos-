import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, PieChart, Plus, Search, Filter, MoreVertical, Edit2, Edit3, Trash2, MapPin, Map as MapIcon, GitBranch, User, Calendar, ExternalLink, ArrowUpRight, TrendingUp, DollarSign, Box, Settings, Check, X, ClipboardCheck, History, Download, UserCheck, Camera, QrCode, Scan, Menu, MessageCircle, FileUp, Bell, Clock, AlertTriangle, Eye, Info, LogOut, Lock, Mail, Building2, Power, CreditCard, Zap, ShieldCheck, ChevronDown, FileText } from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

import { motion, AnimatePresence } from 'motion/react';
import { useAssets } from './useAssets';
import { Asset, AssetStatus, CategoriaAtivo, Categoria, AuditRecord, Filial } from './types';
import { supabase } from './lib/supabase';
import { cn, formatCurrency, formatDate } from './lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from 'recharts';

// Utilitários de Áudio para o Scanner
const playBeep = (type: 'success' | 'error' | 'neutral' = 'success') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Lá (A5)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'error') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // Lá (A3)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } else {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // Lá (A4)
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    }
  } catch (err) {
    console.warn('Áudio não suportado:', err);
  }
};

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

const AccordionItem = ({ 
  id, 
  title, 
  icon: Icon, 
  isActive, 
  onClick, 
  children 
}: { 
  id: string, 
  title: string, 
  icon: any, 
  isActive: boolean, 
  onClick: () => void, 
  children: React.ReactNode 
}) => (
  <div className={cn("border rounded-2xl overflow-hidden transition-all duration-300", isActive ? "shadow-md border-blue-200 ring-1 ring-blue-50" : "bg-white border-slate-100")}>
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-5 py-4 transition-all",
        isActive ? "bg-blue-50/50 text-blue-600" : "hover:bg-slate-50 text-slate-600"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg transition-colors", isActive ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-400")}>
          <Icon size={16} />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest">{title}</span>
      </div>
      <motion.div
        animate={{ rotate: isActive ? 180 : 0 }}
        transition={{ duration: 0.2 }}
        className="text-slate-300"
      >
        <ChevronDown size={18} />
      </motion.div>
    </button>
    <motion.div
      initial={false}
      animate={{ 
        height: isActive ? 'auto' : 0, 
        opacity: isActive ? 1 : 0
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="px-5 py-6 space-y-5 bg-white border-t border-slate-50">
        {children}
      </div>
    </motion.div>
  </div>
);

// --- Components ---

// --- Auth & Onboarding ---

const AuthPage = ({ onAuthSuccess }: { onAuthSuccess: (user: any) => void }) => {
  const [isRegister, setIsRegister] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      if (isRegister) {
        // Registro 100% puro: Sem metadados, sem triggers.
        console.log('🚀 Tentando cadastro simplificado...');
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password
        });
        
        if (authError) {
          console.error('❌ Erro no SignUp:', authError);
          
          // RESGATE AUTOMÁTICO: Em erros de trigger/banco, o usuário MUITAS VEZES é criado no auth.users
          // mas o Supabase retorna erro 500/Trigger. Tentamos logar imediatamente para resgatar a sessão.
          if (
            authError.message.toLowerCase().includes('database error') || 
            authError.message.toLowerCase().includes('trigger') ||
            authError.message.includes('500') ||
            authError.message.toLowerCase().includes('already registered')
          ) {
            console.log('🔄 Erro de banco detectado. Tentando login de resgate...');
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
            
            if (loginData.user) {
              console.log('✅ Usuário resgatado com sucesso via login direto.');
              onAuthSuccess(loginData.user);
              return;
            }
            // Se o login de resgate também falhar, aí sim lançamos o erro original
            if (loginError) {
               console.error('❌ Falha no resgate:', loginError);
            }
          }
          
          throw authError;
        }
        
        if (authData.user) {
          onAuthSuccess(authData.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) onAuthSuccess(data.user);
      }
    } catch (err: any) {
      console.error('💥 Auth Error:', err);
      let msg = err.message || 'Erro ao processar autenticação';
      
      if (msg.toLowerCase().includes('user already registered')) {
        msg = "Este e-mail já está cadastrado. Tente entrar no sistema.";
      } else if (msg.toLowerCase().includes('database error') || msg.toLowerCase().includes('trigger') || msg.includes('500')) {
        msg = "O Banco de Dados (Supabase) bloqueou o cadastro devido a um Gatilho (Trigger) ainda ativo.\n\nRESOLUÇÃO DEFINITIVA:\n1. Vá no SQL Editor do Supabase\n2. Execute este comando exatamente como está:\n\nDROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;\nDROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;\nDROP FUNCTION IF EXISTS handle_new_user() CASCADE;";
      } else if (msg.toLowerCase().includes('invalid login credentials')) {
        msg = "E-mail ou senha inválidos.";
      }

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
      >
        <div className="p-10">
          <div className="flex justify-center mb-10">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
              <Package className="text-white" size={32} />
            </div>
          </div>
          
          <h2 className="text-2xl font-black text-center text-slate-900 tracking-tight mb-2">
            {isRegister ? 'Seja Bem-vindo!' : 'Acessar Painel'}
          </h2>
          <p className="text-center text-slate-500 text-sm mb-8 font-medium">
            {isRegister 
              ? 'Crie sua conta em segundos e comece a gerenciar.' 
              : 'Bem-vindo de volta ao Solutions Tags.'}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-center gap-3 font-medium">
              <AlertTriangle size={18} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                <Mail size={14} /> E-mail
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@empresa.com"
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 ml-1">
                <Lock size={14} /> Senha
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
            </div>

            <button
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? 'Registrar Agora' : 'Entrar no Sistema'}
                  <ArrowUpRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
            <p className="text-sm text-slate-500 font-medium">
              {isRegister ? 'Já tem uma conta?' : 'Ainda não é cadastrado?'}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="ml-2 text-blue-600 font-bold hover:underline"
              >
                {isRegister ? 'Entrar aqui' : 'Criar Conta Grátis'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- SETUP INICIAL (Configuração Pós-Login) ---
const SetupCompany = ({ user, onComplete, embedded = false }: { user: any, onComplete: () => void, embedded?: boolean }) => {
  const [companyName, setCompanyName] = React.useState('');
  const [hasFiliais, setHasFiliais] = React.useState(false);
  const [filialNames, setFilialNames] = React.useState<string[]>([]);
  const [currentFilialInput, setCurrentFilialInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addFilialToList = () => {
    if (currentFilialInput.trim()) {
      if (!filialNames.includes(currentFilialInput.trim())) {
        setFilialNames([...filialNames, currentFilialInput.trim()]);
      }
      setCurrentFilialInput('');
    }
  };

  const removeFilialFromList = (index: number) => {
    setFilialNames(filialNames.filter((_, i) => i !== index));
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const trimmedName = companyName.trim();
      if (!trimmedName) throw new Error('O nome da empresa é obrigatório.');

      // 1. Criar empresa
      const { data: company, error: errComp } = await supabase
        .from('empresas')
        .insert({ nome: trimmedName })
        .select()
        .single();

      if (errComp) throw errComp;

      // 2. Vincular usuário logado como dono/admin
      const { error: errLink } = await supabase
        .from('usuarios_empresa')
        .insert({
          user_id: user.id,
          empresa_id: company.id,
          role: 'admin'
        });

      if (errLink) throw errLink;

      // 3. Criar filiais se houver
      if (hasFiliais && filialNames.length > 0) {
        const filiaisToInsert = filialNames.map(nome => ({
          nome,
          empresa_id: company.id
        }));
        const { error: errFiliais } = await supabase.from('filiais').insert(filiaisToInsert);
        if (errFiliais) {
          console.error('Erro ao inserir filiais iniciais:', errFiliais);
        }
      }

      // 4. Criar categorias padrão
      const defaultCategories = [
        { name: 'Tecnologia / TI', useful_life_years: 5, empresa_id: company.id },
        { name: 'Mobiliário', useful_life_years: 10, empresa_id: company.id },
        { name: 'Máquinas e Equipamentos', useful_life_years: 10, empresa_id: company.id },
        { name: 'Ferramentas Elétricas', useful_life_years: 5, empresa_id: company.id },
        { name: 'Veículos', useful_life_years: 5, empresa_id: company.id },
        { name: 'Infraestrutura', useful_life_years: 10, empresa_id: company.id },
      ];

      const { error: errCats } = await supabase.from('categorias').insert(defaultCategories);
      if (errCats) {
        console.error('Erro ao inserir categorias padrão:', errCats);
      }

      // 5. Opcionalmente atualizar metadados (para consistência)
      await supabase.auth.updateUser({
        data: { 
          company_name: trimmedName,
          display_name: trimmedName 
        }
      });

      onComplete();
    } catch (err: any) {
      console.error('❌ Setup Error:', err);
      setError(err.message || 'Não foi possível configurar sua empresa.');
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <>
      <div className="text-center mb-8">
        {!embedded && (
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Building2 size={40} className="text-blue-600" />
          </div>
        )}
        <h2 className={cn("font-black text-slate-900 tracking-tight", embedded ? "text-xl text-left" : "text-2xl")}>
          {embedded ? "Confirmar Nome da Empresa" : "Um último passo!"}
        </h2>
        <p className={cn("text-slate-500 mt-2 font-medium", embedded ? "text-sm text-left" : "text-base")}>
          Como devemos chamar sua organização ou empresa?
        </p>
      </div>

      <form onSubmit={handleSetup} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Organização</label>
          <input
            type="text"
            required
            autoFocus
            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-base focus:ring-2 focus:ring-blue-500 transition-all font-bold placeholder:text-slate-300"
            placeholder="Ex: Minha Logística S/A"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="check-filiais" 
                checked={hasFiliais}
                onChange={(e) => setHasFiliais(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="check-filiais" className="text-xs font-bold text-slate-600 cursor-pointer">CADASTRAR FILIAIS AGORA?</label>
            </div>
          </div>

          {hasFiliais && (
            <div className="space-y-4 pt-2 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome da Filial"
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                  value={currentFilialInput}
                  onChange={(e) => setCurrentFilialInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFilialToList())}
                />
                <button
                  type="button"
                  onClick={addFilialToList}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  ADD
                </button>
              </div>

              {filialNames.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filialNames.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                      {name}
                      <button type="button" onClick={() => removeFilialFromList(idx)} className="hover:text-blue-900">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl font-bold border border-red-100 flex items-center gap-3">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-base hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>CONCLUIR CONFIGURAÇÃO <Check size={20} /></>
            )}
          </button>
          
          {!embedded && (
            <button 
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="py-3 text-slate-400 text-sm font-bold hover:text-red-500 transition-colors uppercase tracking-widest"
            >
              Sair desta conta
            </button>
          )}
        </div>
      </form>
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-slate-100"
      >
        {content}
      </motion.div>
    </div>
  );
};

// --- Main Views ---

const DashboardView = ({ stats, onMaintenanceClick, onAlertsClick, onViewAll }: { stats: any, onMaintenanceClick: () => void, onAlertsClick: () => void, onViewAll: () => void }) => {
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
        
        <div 
          onClick={onAlertsClick}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[100px] max-h-[100px] overflow-hidden cursor-pointer hover:border-red-200 hover:shadow-md transition-all active:scale-[0.98]"
        >
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
                  <th className="px-6 py-4 text-slate-500">Departamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.recentActivity.map((asset: Asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">#{asset.tag}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{asset.name}</td>
                    <td className="px-6 py-4 text-slate-500">{asset.categoria}</td>
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
                    data={stats.byCategoria}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.byCategoria.map((entry: any, index: number) => (
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
              {stats.byCategoria.slice(0, 4).map((cat: any, idx: number) => (
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

const AssetListView = ({ assets, categorias, filiais, initialStatusFilter, onDelete, onEdit, onBulkUpload }: { assets: Asset[], categorias: Categoria[], filiais: Filial[], initialStatusFilter?: string, onDelete: (id: string) => void, onEdit: (a: Asset) => void, onBulkUpload: (assets: any[]) => void }) => {
  const [search, setSearch] = React.useState('');
  const [filterCategoria, setFilterCategoria] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>(initialStatusFilter || 'all');
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary', cellDates: true, cellNF: false, cellText: false });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { dateNF: 'YYYY-MM-DD' });
      
      const mappedAssets = data.map(item => {
        const filialName = item.Filial || item.filial || item.Unidade || '';
        const filialObj = filiais.find(f => f.nome.trim().toLowerCase() === String(filialName).trim().toLowerCase());
        
        // Trata data de compra se for objeto Date ou string de data do Excel
        let pDate = item['Data de Compra'] || item.purchaseDate;
        if (pDate instanceof Date) {
          pDate = pDate.toISOString().split('T')[0];
        } else if (typeof pDate === 'number') {
          // Caso ainda venha como número serial do Excel
          const date = new Date(Math.round((pDate - 25569) * 86400 * 1000));
          pDate = date.toISOString().split('T')[0];
        } else if (!pDate) {
          pDate = new Date().toISOString().split('T')[0];
        }

        return {
          name: item.Nome || item.name || '',
          tag: String(item['Tag de Patrimônio'] || item.Patrimonio || item.tag || ''),
          brand: item.Marca || item.brand || '',
          model: item.Modelo || item.model || '',
          serialNumber: item['Nº Série'] || item.serial_number || item.serialNumber || '',
          categoria: (item.Categoria || item.categoria || item.category || 'Outros') as CategoriaAtivo,
          status: 'Ativo' as AssetStatus,
          value: Number(item.Valor || item.value || 0),
          purchaseDate: pDate,
          location: item.Departamento || item.Localizacao || item.location || 'Nao Informado',
          codBaseBem: item['Código Base Bem'] || item.cod_base_bem || item.codBaseBem || '',
          description: item['Observações'] || item.description || '',
          filial_id: filialObj?.id || null,
          maintenanceHistory: [],
          hasPreventiveMaintenance: false,
          maintenanceIntervalMonths: 0,
          hasWarranty: false,
        };
      }).filter(a => a.name && a.tag);

      if (mappedAssets.length > 0) {
        onBulkUpload(mappedAssets);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filtered = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                          a.tag.toLowerCase().includes(search.toLowerCase());
    const matchesCategoria = filterCategoria === 'all' || a.categoria === filterCategoria;
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchesSearch && matchesCategoria && matchesStatus;
  });

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Modelo_Importacao');

    worksheet.columns = [
      { header: 'Tag de Patrimônio', key: 'tag', width: 20 },
      { header: 'Nome', key: 'name', width: 30 },
      { header: 'Marca', key: 'brand', width: 20 },
      { header: 'Modelo', key: 'model', width: 20 },
      { header: 'Nº Série', key: 'serialNumber', width: 20 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Código Base Bem', key: 'codBaseBem', width: 20 },
      { header: 'Filial', key: 'filial_nome', width: 20 },
      { header: 'Departamento', key: 'location', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Valor', key: 'value', width: 15 },
      { header: 'Data de Compra', key: 'purchaseDate', width: 15 },
      { header: 'Observações', key: 'description', width: 30 }
    ];

    // Formatar coluna A como texto para suportar zeros à esquerda (ex: 000001)
    worksheet.getColumn(1).numFmt = '@';
    
    // Formatar coluna L como Data (ajustado índice de 9 para 12)
    worksheet.getColumn(12).numFmt = 'DD/MM/YYYY';

    // Add an example row as instruction
    worksheet.addRow({
      tag: '000001',
      name: 'Exemplo de Computador',
      brand: 'Dell',
      model: 'OptiPlex 7000',
      serialNumber: 'SN123456789',
      categoria: 'Computadores',
      codBaseBem: 'CP-001X',
      filial_nome: filiais.length > 0 ? filiais[0].nome : 'Sede / Matriz',
      location: 'Escritório Central',
      status: 'Ativo',
      value: 3500.00,
      purchaseDate: new Date(2024, 0, 15),
      description: 'Computador do setor administrativo'
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
      { header: 'Tag de Patrimônio', key: 'tag', width: 20 },
      { header: 'Nome', key: 'name', width: 30 },
      { header: 'Marca', key: 'brand', width: 20 },
      { header: 'Modelo', key: 'model', width: 20 },
      { header: 'Nº Série', key: 'serialNumber', width: 20 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Código Base Bem', key: 'codBaseBem', width: 20 },
      { header: 'Filial', key: 'filial_nome', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Valor', key: 'value', width: 15 },
      { header: 'Data de Compra', key: 'purchaseDate', width: 15 },
      { header: 'Departamento', key: 'location', width: 20 },
      { header: 'Observações', key: 'description', width: 30 }
    ];

    // Formatar coluna A como texto
    worksheet.getColumn(1).numFmt = '@';
    // Formatar coluna K como Data (ajustado de 8 para 11)
    worksheet.getColumn(11).numFmt = 'DD/MM/YYYY';

    filtered.forEach(a => {
      worksheet.addRow({
        tag: a.tag,
        name: a.name,
        brand: a.brand,
        model: a.model,
        serialNumber: a.serialNumber,
        categoria: a.categoria,
        codBaseBem: a.codBaseBem,
        filial_nome: a.filial_nome || 'Sede / Matriz',
        status: a.status,
        value: a.value,
        purchaseDate: new Date(a.purchaseDate),
        location: a.location,
        description: a.description
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
            <option value="Em andamento">Em andamento</option>
            <option value="Inativo">Inativo</option>
          </select>
            <select 
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="all">Todas Categorias</option>
            {categorias.map(cat => (
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
              <th className="px-6 py-4">Unidade</th>
              <th className="px-6 py-4">Departamento</th>
              <th className="px-6 py-4">Situação</th>
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
                      {asset.status === 'Emprestado' && asset.assignedTo && (
                        <p className="text-[10px] text-blue-600 mt-1 font-bold italic">
                          👤 {asset.assignedTo}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{asset.categoria}</td>
                  <td className="px-6 py-4 focus:outline-none">
                    <span className={cn(
                      "px-2 py-1 text-[10px] rounded-full uppercase font-bold",
                      asset.status === 'Ativo' ? "bg-emerald-100 text-emerald-700" :
                      asset.status === 'Em Manutenção' ? "bg-amber-100 text-amber-700" :
                      asset.status === 'Emprestado' ? "bg-blue-100 text-blue-700" :
                      asset.status === 'Em andamento' ? "bg-violet-100 text-violet-700" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{asset.filial_nome || 'Sede / Matriz'}</td>
                  <td className="px-6 py-4 text-slate-500">{asset.location}</td>
                  <td className="px-6 py-4">
                    {asset.status === 'Em Manutenção' ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={10} className="text-amber-500" />
                          <span className="text-[10px] font-bold text-amber-700 uppercase">{asset.maintenanceNotes || 'Local não informado'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <DollarSign size={10} className="text-amber-500" />
                          <span className="text-xs font-bold text-amber-600">{formatCurrency(asset.maintenanceValue || 0)}</span>
                        </div>
                      </div>
                    ) : asset.status === 'Inativo' ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Motivo Inativo</span>
                        <span className="text-xs text-red-600 font-medium">{asset.inactiveReason || 'Não informado'}</span>
                      </div>
                    ) : asset.status === 'Emprestado' ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Emprestado para</span>
                        <span className="text-xs text-blue-600 font-bold">{asset.assignedTo || 'Não informado'}</span>
                      </div>
                    ) : asset.status !== 'Ativo' ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Estado Atual</span>
                        <span className="text-xs text-slate-600 font-medium">{asset.status}</span>
                      </div>
                    ) : asset.maintenanceHistory && asset.maintenanceHistory.length > 0 ? (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Gasto Histórico</p>
                        <p className="text-xs font-semibold text-slate-600">{formatCurrency(asset.maintenanceHistory.reduce((acc, curr) => acc + curr.cost, 0))}</p>
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
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Cód. Contábil (opcional)</p>
                              <p className="text-xs text-slate-800">{asset.codBaseBem || 'Não informado'}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Filial / Unidade</p>
                              <p className="text-xs text-slate-800">{asset.filial_nome || 'Sede / Matriz'}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">Marca</p>
                               <p className="text-xs text-slate-800">{asset.brand || '-'}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">Modelo</p>
                               <p className="text-xs text-slate-800">{asset.model || '-'}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">Nº de Série</p>
                               <p className="text-xs text-slate-800 font-mono">{asset.serialNumber || '-'}</p>
                            </div>
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
                             <MapPin size={12} /> Departamento & Notas
                          </h4>
                          <div className="space-y-3">
                             <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Departamento</p>
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

const ReportsView = ({ assets: allAssets, categorias, audits, filiais }: { assets: Asset[], categorias: Categoria[], audits: AuditRecord[], filiais: Filial[] }) => {
  const [selectedFilial, setSelectedFilial] = React.useState<string>('all');

  const assets = React.useMemo(() => {
    if (selectedFilial === 'all') return allAssets;
    if (selectedFilial === 'hq') return allAssets.filter(a => !a.filial_id);
    return allAssets.filter(a => a.filial_id === selectedFilial);
  }, [allAssets, selectedFilial]);

  const calculateDepreciation = (asset: Asset) => {
    const originalValue = asset.value;
    const purchaseDate = asset.purchaseDate;
    const nomeCategoria = asset.categoria;

    const purchase = new Date(purchaseDate);
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth());
    
    // Normalização para busca resiliente
    const catSearch = (nomeCategoria || "").toString().trim().toLowerCase();
    
    // Procura a categoria no estado atual
    const categoriaDefinida = categorias.find(c => 
      c.name.trim().toLowerCase() === catSearch || 
      c.id === (asset as any).categoria_id
    );
    
    const usefulLifeYears = categoriaDefinida ? Number(categoriaDefinida.usefulLifeYears) : 10;
    
    const usefulLifeMonths = Math.max(usefulLifeYears * 12, 1);
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
    ...calculateDepreciation(a)
  }));

  const totalOriginalValue = assets.reduce((acc, curr) => acc + curr.value, 0);
  const totalRemainingValue = assetsWithMeta.reduce((acc, curr) => acc + curr.remaining, 0);
  const totalDepreciation = totalOriginalValue - totalRemainingValue;

  // 1. Distribuição por Categoria
  const categoriaData = categorias.map(cat => ({
    name: cat.name,
    value: assets.filter(a => a.categoria === cat.name).length
  })).filter(c => c.value > 0);

  // 2. Locais
  const locationData = [...new Set(assets.map(a => a.location))].map(loc => ({
    name: loc,
    value: assets.filter(a => a.location === loc).length
  })).sort((a, b) => b.value - a.value).slice(0, 5);

  // 3. Status
  const statusData = ['Ativo', 'Em Manutenção', 'Inativo', 'Baixado', 'Emprestado', 'Em andamento'].map(s => ({
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
      name: `${a.tag} - ${a.name}`,
      meses: a.monthsRemaining,
      tag: a.tag,
      itemName: a.name
    }));

  // 7. Manutenção Acumulada por Categoria
  const maintenanceData = categorias.map(cat => ({
    name: cat.name,
    value: assets.filter(a => a.categoria === cat.name)
      .reduce((sum, a) => sum + (a.maintenanceHistory?.reduce((s, h) => s + h.cost, 0) || 0), 0)
  })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  // 8. Inventário
  const filteredAudits = audits.filter(a => {
    if (selectedFilial === 'all') return true;
    if (selectedFilial === 'hq') return !a.filial_id;
    return a.filial_id === selectedFilial;
  });

  const latestAudit = filteredAudits.filter(a => a.isFinalized).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
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
      ...calculateDepreciation(a)
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
    categoriaData.forEach(c => {
      wsResumo.addRow({ desc: c.name, val: c.value });
    });

    // Styling Resumo
    wsResumo.getRow(1).font = { bold: true, size: 14 };
    
    // Identificar linhas de cabeçalho para negrito
    wsResumo.eachRow((row, rowNumber) => {
      const desc = row.getCell(1).value;
      if (typeof desc === 'string' && (desc.includes('RELATÓRIO') || desc.includes('TOTAIS') || desc.includes('ATIVOS POR'))) {
        row.font = { bold: true };
      }
      
      // Formatação numérica inteligente na coluna B
      const val = row.getCell(2).value;
      if (rowNumber > 1 && val !== null && val !== '') {
        if (typeof desc === 'string' && desc.toLowerCase().includes('valor')) {
          row.getCell(2).numFmt = '"R$ "#,##0.00';
        } else if (typeof desc === 'string' && desc.toLowerCase().includes('depreciação')) {
          row.getCell(2).numFmt = '"R$ "#,##0.00';
        } else if (typeof val === 'number') {
          row.getCell(2).numFmt = '#,##0'; // Formato de número inteiro
        }
      }
    });

    // 2. Aba: Ativos
    const wsAtivos = workbook.addWorksheet('Ativos');
    wsAtivos.columns = [
      { header: 'ID do Ativo', key: 'id', width: 10 },
      { header: 'Nome do Ativo', key: 'name', width: 30 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Patrimônio', key: 'tag', width: 15 },
      { header: 'Cód. Base Bem', key: 'codBaseBem', width: 20 },
      { header: 'Filial', key: 'filial_nome', width: 20 },
      { header: 'Departamento', key: 'location', width: 20 },
      { header: 'Responsável', key: 'auditor', width: 20 },
      { header: 'Data Compra', key: 'purchaseDate', width: 15 },
      { header: 'Valor Original', key: 'value', width: 15 },
      { header: 'Vida Útil (Anos)', key: 'usefulLife', width: 15 },
      { header: 'Valor Residual', key: 'remaining', width: 15 },
      { header: 'Depreciação Acum.', key: 'depreciation', width: 15 },
      { header: 'Valor Atual', key: 'current', width: 15 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    const sortedAssets = [...assetsWithMeta].sort((a, b) => {
      const filialA = a.filial_nome || 'Sede / Matriz';
      const filialB = b.filial_nome || 'Sede / Matriz';
      return filialA.localeCompare(filialB);
    });

    sortedAssets.forEach(a => {
      const cat = categorias.find(c => c.name === a.categoria);
      wsAtivos.addRow({
        id: a.id.slice(-6),
        name: a.name,
        categoria: a.categoria,
        tag: a.tag,
        codBaseBem: a.codBaseBem || '-',
        filial_nome: a.filial_nome || 'Sede / Matriz',
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
      { header: 'Patrimônio', key: 'tag', width: 15 },
      { header: 'Nome do Ativo', key: 'name', width: 30 },
      { header: 'Filial', key: 'filial_nome', width: 20 },
      { header: 'Valor Original', key: 'value', width: 15 },
      { header: 'Valor Residual', key: 'residual', width: 15 },
      { header: 'Vida Útil (Anos)', key: 'usefulLife', width: 15 },
      { header: 'Meses Decorridos', key: 'months', width: 15 },
      { header: 'Depreciação Mensal', key: 'monthly', width: 15 },
      { header: 'Depreciação Acumulada', key: 'accumulated', width: 20 },
      { header: 'Valor Atual', key: 'current', width: 15 }
    ];

    sortedAssets.forEach(a => {
      const cat = categorias.find(c => c.name === a.categoria);
      const usefulLifeMonths = (cat?.usefulLifeYears || 5) * 12;
      const purchase = new Date(a.purchaseDate);
      const now = new Date();
      const monthsElapsed = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth());
      const monthlyRate = a.value / usefulLifeMonths;

      wsDepr.addRow({
        tag: a.tag,
        name: a.name,
        filial_nome: a.filial_nome || 'Sede / Matriz',
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
      { header: 'Patrimônio', key: 'tag', width: 15 },
      { header: 'Nome do Ativo', key: 'name', width: 30 },
      { header: 'Filial', key: 'filial_nome', width: 20 },
      { header: 'Departamento Esperado', key: 'locExp', width: 25 },
      { header: 'Departamento Atual', key: 'locActual', width: 25 },
      { header: 'Status Conferência', key: 'status', width: 20 },
      { header: 'Data Última Verificação', key: 'date', width: 20 }
    ];

    const latestAuditsByFilial = new Map<string | null, AuditRecord>();
    audits.filter(a => a.isFinalized).forEach(audit => {
      const fid = audit.filial_id || null;
      const existing = latestAuditsByFilial.get(fid);
      if (!existing || new Date(audit.date).getTime() > new Date(existing.date).getTime()) {
        latestAuditsByFilial.set(fid, audit);
      }
    });

    const allLatestAuditItems: any[] = [];
    latestAuditsByFilial.forEach((audit) => {
      audit.allAssetsSnapshot.forEach(item => {
        const found = audit.verifiedIds.includes(item.id);
        const originalAsset = assets.find(a => a.id === item.id);
        allLatestAuditItems.push({
          tag: item.tag,
          name: item.name,
          filial_nome: originalAsset?.filial_nome || 'Sede / Matriz',
          locExp: item.location,
          locActual: found ? item.location : 'NÃO LOCALIZADO',
          status: found ? 'ENCONTRADO' : 'NÃO ENCONTRADO',
          date: new Date(audit.date)
        });
      });
    });

    // Ordenar itens do inventário por filial
    allLatestAuditItems.sort((a, b) => a.filial_nome.localeCompare(b.filial_nome)).forEach(row => {
      wsInv.addRow(row);
    });

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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedFilial('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider",
              selectedFilial === 'all' 
                ? "bg-slate-800 text-white shadow-md" 
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
            )}
          >
            Toda Empresa
          </button>
          <button
            onClick={() => setSelectedFilial('hq')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider",
              selectedFilial === 'hq' 
                ? "bg-indigo-600 text-white shadow-md" 
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
            )}
          >
            Sede
          </button>
          {filiais.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFilial(f.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider",
                selectedFilial === f.id 
                  ? "bg-blue-600 text-white shadow-md" 
                  : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
              )}
            >
              {f.nome}
            </button>
          ))}
        </div>
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
                <Pie data={categoriaData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                  {categoriaData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
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
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} width={120} />
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

interface CategoryItemProps {
  cat: Categoria;
  onUpdate: (id: string, updates: Partial<Categoria>) => void;
  onRemove: (id: string) => void;
}

const CategoryItem: React.FC<CategoryItemProps> = ({ cat, onUpdate, onRemove }) => {
  const [localLife, setLocalLife] = React.useState(cat.usefulLifeYears.toString());
  
  React.useEffect(() => {
    setLocalLife(cat.usefulLifeYears.toString());
  }, [cat.usefulLifeYears]);

  const handleBlur = () => {
    const val = Number(localLife);
    if (!isNaN(val) && val > 0 && val !== cat.usefulLifeYears) {
      onUpdate(cat.id, { usefulLifeYears: val });
    } else {
      setLocalLife(cat.usefulLifeYears.toString());
    }
  };

  const annualDepreciation = cat.usefulLifeYears > 0 ? (100 / cat.usefulLifeYears).toFixed(0) : '0';

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
      <div className="flex items-center gap-8 flex-1">
        <span className="text-sm font-black text-slate-900 min-w-[180px] tracking-tight">{cat.name}</span>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest px-1">Vida Útil</span>
            <div className="flex items-center gap-1.5">
              <input 
                type="number"
                min="1"
                value={localLife}
                onChange={(e) => setLocalLife(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
                className="w-16 px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none text-center shadow-sm"
              />
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Anos</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest px-1">Depreciação Anual</span>
            <span className="text-sm font-black text-blue-600 px-1">{annualDepreciation}%</span>
          </div>
        </div>
      </div>
      <button 
        onClick={() => onRemove(cat.id)}
        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-95"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

const CategoriasView = ({ categorias, onAdd, onUpdate, onRemove, error, clearError, onSync, loading }: { categorias: Categoria[], onAdd: (name: string, life: number) => void, onUpdate: (id: string, updates: Partial<Categoria>) => void, onRemove: (id: string) => void, error: string | null, clearError: () => void, onSync: () => void, loading: boolean }) => {
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
  };

  const handleAdd = () => {
    if (newCat.trim()) {
      const lifeValue = Number(newLife) || 10;
      onAdd(newCat.trim(), lifeValue);
      setNewCat('');
      setNewLife(10);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 animate-in zoom-in-95 duration-500 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-800">Gerenciar Categorias</h3>
          <p className="text-[10px] text-slate-400 font-medium">Configure a vida útil dos ativos para cálculo de depreciação</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onSync}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${loading ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
            disabled={loading}
            title="Forçar sincronização com o servidor"
          >
            {loading ? <History size={14} className="animate-spin" /> : <History size={14} />}
            {loading ? 'SINCRONIZANDO...' : 'SINCRONIZAR'}
          </button>
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
                CONCLUÍDO
              </>
            ) : (
              <>
                <Box size={14} />
                APLICAR ALTERAÇÕES
              </>
            )}
          </button>
        </div>
      </div>

      {categorias.length > 0 && categorias.some(c => c.id.startsWith('local-') || c.id.startsWith('offline-')) && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-[10px] font-bold flex items-center gap-2">
          <AlertTriangle size={14} />
          MODO DE SEGURANÇA: Categorias carregadas localmente. Verifique sua conexão ou vínculo de empresa.
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-start gap-3 relative group">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold underline mb-1">Erro ao salvar</p>
            <p className="text-xs leading-relaxed opacity-90">{error}</p>
          </div>
          <button 
            onClick={clearError}
            className="p-1 hover:bg-red-100 rounded-lg transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed font-medium">
          A depreciação é calculada automaticamente com base na vida útil definida para cada categoria. 
          A fórmula utilizada é: <span className="font-bold underline">Valor do Bem / (Anos de Vida Útil × 12)</span> por mês decorrido desde a compra.
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2 mb-10">
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
            className="w-full sm:w-auto px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all active:scale-[0.98] h-[38px] flex items-center justify-center gap-2"
          >
            <Plus size={18} /> ADICIONAR
          </button>
        </div>
      </div>

      <div className="hidden sm:grid grid-cols-12 px-4 mb-2">
        <span className="col-span-6 text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</span>
        <span className="col-span-3 text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 text-center">Vida Útil</span>
        <span className="col-span-3 text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Taxa Anual</span>
      </div>

      <div className="space-y-3">
        {loading && categorias.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-xs font-medium italic">Sincronizando categorias...</p>
            </div>
          </div>
        ) : categorias.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-xs font-medium italic">Nenhuma categoria encontrada. Adicione uma acima.</p>
          </div>
        ) : (
          categorias.map(cat => (
            <CategoryItem 
              key={cat.id} 
              cat={cat} 
              onUpdate={onUpdate} 
              onRemove={onRemove} 
            />
          ))
        )}
      </div>
    </div>
  );
};

const Scanner = ({ onScan }: { onScan: (decodedText: string) => void }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(false);

  React.useEffect(() => {
    if (!isActive) return;

    const html5QrCode = new Html5Qrcode("reader");
    const config = { 
      fps: 15, 
      qrbox: (viewWidth: number, viewHeight: number) => {
        const size = Math.min(viewWidth, viewHeight) * 0.7;
        return { width: size, height: size };
      } 
    };

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            onScan(decodedText);
          },
          () => {}
        );
        setError(null);
      } catch (err) {
        console.error("Erro ao iniciar câmera:", err);
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
        setIsActive(false);
      }
    };

    startScanner();

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Erro ao parar scanner:", err));
      }
    };
  }, [onScan, isActive]);

  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative min-h-[360px] flex flex-col items-center justify-center border-2 border-slate-800">
      {!isActive ? (
        <div className="p-8 text-center space-y-6">
          <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
            <Camera size={48} className="text-blue-400 opacity-60" />
          </div>
          <div className="space-y-2">
            <h4 className="text-white font-bold text-xl">Câmera Desligada</h4>
            <p className="text-slate-400 text-sm max-w-[240px] mx-auto">
              A câmera está desativada para economizar energia. Ative-a para ler as tags.
            </p>
          </div>
          <button 
            onClick={() => setIsActive(true)}
            className="w-full max-w-[220px] py-4 bg-blue-600 text-white rounded-2xl font-bold text-base hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3 mx-auto shadow-xl shadow-blue-900/40"
          >
            <Camera size={22} /> LIGAR CÂMERA
          </button>
        </div>
      ) : (
        <>
          <div id="reader" className="w-full h-full flex-1"></div>
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center z-20">
              <Camera size={40} className="text-red-500 mb-4" />
              <p className="text-white font-medium mb-4">{error}</p>
              <button 
                onClick={() => setIsActive(false)}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold border border-slate-700"
              >
                VOLTAR
              </button>
            </div>
          )}
          <div className="absolute top-4 right-4 z-30">
            <button 
              onClick={() => setIsActive(false)}
              className="p-3 bg-red-600/20 text-red-500 rounded-full hover:bg-red-600/40 transition-colors backdrop-blur-md border border-red-500/30"
              title="Desligar Câmera"
            >
              <Power size={20} />
            </button>
          </div>
          <div className="p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800 w-full z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400 flex items-center justify-center gap-3">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
              Escaneando Agora...
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const AuditView = ({ audits, filiais, startAudit, toggleAssetAudit, finalizeAudit, deleteAudit, error, clearError }: { audits: AuditRecord[], filiais: Filial[], startAudit: (name: string, filterType?: string) => Promise<boolean>, toggleAssetAudit: (auditId: string, assetId: string) => void, finalizeAudit: (auditId: string) => void, deleteAudit: (id: string) => void, error: string | null, clearError: () => void }) => {
  const activeAudit = audits.find(a => !a.isFinalized);
  const [showStartModal, setShowStartModal] = React.useState(false);
  const [auditorName, setAuditorName] = React.useState('');
  const [selectedFilial, setSelectedFilial] = React.useState('TOTAL');
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
        playBeep('success');
        toggleAssetAudit(activeAudit.id, asset.id);
      } else {
        playBeep('neutral');
      }
    } else {
      playBeep('error');
    }
  }, [activeAudit, toggleAssetAudit]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auditorName.trim()) {
      const success = await startAudit(auditorName.trim(), selectedFilial);
      if (success) {
        setAuditorName('');
        setSelectedFilial('TOTAL');
        setShowStartModal(false);
      }
    }
  };

  const exportToExcel = async (audit: AuditRecord) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Conferencia');

    worksheet.columns = [
      { header: 'Codigo Patrimonio', key: 'tag', width: 20 },
      { header: 'Localizado', key: 'status', width: 20 },
      { header: 'Item', key: 'name', width: 30 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Unidade / Filial', key: 'filial', width: 25 },
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
        categoria: item.categoria,
        filial: audit.filial_id ? `Filial: ${audit.filial_nome}` : (audit.filial_nome || 'Sede'),
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
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-left">
          <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={18} />
          <div className="flex-1">
            <p className="text-sm text-red-800 font-bold">Aviso do Sistema</p>
            <p className="text-xs text-red-700 leading-relaxed font-medium mt-0.5">{error}</p>
          </div>
          <button onClick={clearError} className="p-1 hover:bg-red-100 rounded">
            <X size={14} className="text-red-800" />
          </button>
        </div>
      )}
      {activeAudit ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-slate-100 bg-blue-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="p-2 lg:p-3 bg-white rounded-lg shadow-sm shrink-0">
                <UserCheck size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base lg:text-lg font-bold text-slate-800 truncate">Controle: {activeAudit.auditorName}</h3>
                <p className="text-[10px] lg:text-xs text-slate-500">
                  Iniciada em {formatDate(activeAudit.date)} 
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold uppercase text-[9px]">
                    {activeAudit.filial_id ? `Filial: ${activeAudit.filial_nome}` : (activeAudit.filial_nome || 'Sede')}
                  </span>
                </p>
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
                <div className="max-w-md mx-auto space-y-4">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3 text-left">
                    <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                      A leitura via Scan deve ser feita pelo celular. Acesse o site, faça seu login e inicie as leituras.
                    </p>
                  </div>
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
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 px-6">
           <ClipboardCheck size={48} className="text-slate-300 mb-4" />
           <h3 className="text-lg font-bold text-slate-800">Pronto para conferência?</h3>
           <p className="text-slate-500 text-sm mb-4">Inicie uma nova verificação para conferir seus ativos fisicamente.</p>
           
           <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3 text-left mb-6 max-w-sm">
             <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
             <p className="text-xs text-blue-800 leading-relaxed">
               A leitura via Scan deve ser feita pelo celular. Acesse o site, faça seu login e inicie as leituras.
             </p>
           </div>

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
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                        Resp: {audit.auditorName}
                      </p>
                      <p className="text-[10px] text-blue-600 uppercase font-bold tracking-tighter">
                        {audit.filial_id ? `Filial: ${audit.filial_nome}` : (audit.filial_nome || 'Sede')}
                      </p>
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
        title="Iniciar Verificação"
      >
        <form onSubmit={handleStart} className="space-y-5">
          <p className="text-sm text-slate-500 font-medium">Informe os dados abaixo para começar a contagem física dos ativos.</p>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Nome do Auditor / Responsável</label>
            <input 
              autoFocus
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Ex: João Silva"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Filial / Unidade de Leitura</label>
            <select 
              value={selectedFilial}
              onChange={(e) => setSelectedFilial(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
            >
              <option value="TOTAL">Toda a Empresa (Geral)</option>
              <option value="MATRIZ">Sede / Matriz</option>
              {filiais.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[9px] text-slate-400 font-medium px-0.5 italic">
              {selectedFilial === 'TOTAL' ? 'Serão listados TODOS os ativos cadastrados.' : 
               selectedFilial === 'MATRIZ' ? 'Serão listados apenas ativos sem filial vinculada.' : 
               'Serão listados apenas os ativos vinculados a esta unidade.'}
            </p>
          </div>

          <button 
            type="submit"
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            Começar Agora <Check size={18} />
          </button>
        </form>
      </Modal>
    </div>
  );
};

const PlansView = () => {
  const plans = [
    {
      name: 'Básico',
      price: 'R$ 37,50',
      period: '/mês',
      description: 'Ideal para pequenas empresas que estão começando o controle patrimonial.',
      features: [
        'Até 500 ativos',
        'Cadastro Sede e Filiais',
        'Importação Relatórios',
        'Exportação Relatórios',
        'Relatório Contábil',
        'Acesso Mobile / PC',
        'Resumo de Inventário',
        'Leitura Cód. de Barras / QR Code',
        'Baixa Manual',
        'Alertas de Garantia e Manutenção',
        'Cálculo de Depreciação',
        'Categorias Personalizadas',
        'Suporte via E-mail'
      ],
      icon: Box,
      color: 'bg-slate-50 text-slate-600',
      buttonVariant: 'outline'
    },
    {
      name: 'Profissional',
      price: 'R$ 59,90',
      period: '/mês',
      description: 'A solução completa para empresas em crescimento com múltiplas unidades.',
      features: [
        'Até 3.000 ativos',
        'Cadastro Sede e Filiais',
        'Importação Relatórios',
        'Exportação Relatórios',
        'Relatório Contábil',
        'Acesso Mobile / PC',
        'Resumo de Inventário',
        'Leitura Cód. de Barras / QR Code',
        'Baixa Manual',
        'Alertas de Garantia e Manutenção',
        'Cálculo de Depreciação',
        'Categorias Personalizadas',
        'Suporte via E-mail'
      ],
      icon: Zap,
      color: 'bg-blue-50 text-blue-600',
      featured: true,
      buttonVariant: 'primary'
    },
    {
      name: 'Enterprise',
      price: 'R$ 107,90',
      period: '/mês',
      description: 'Customização total e segurança máxima para grandes corporações.',
      features: [
        'Até 10.000 ativos',
        'Cadastro Sede e Filiais',
        'Importação Relatórios',
        'Exportação Relatórios',
        'Relatório Contábil',
        'Acesso Mobile / PC',
        'Resumo de Inventário',
        'Leitura Cód. de Barras / QR Code',
        'Baixa Manual',
        'Alertas de Garantia e Manutenção',
        'Cálculo de Depreciação',
        'Categorias Personalizadas',
        'Suporte via E-mail'
      ],
      icon: ShieldCheck,
      color: 'bg-indigo-50 text-indigo-600',
      buttonVariant: 'outline'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Escolha o plano ideal para seu negócio</h2>
        <p className="text-blue-600 font-bold mb-4 tracking-wide uppercase text-xs">
          plano free para testar: cadastre até 20 ativos para testar o sistema
        </p>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
          Gerencie seu patrimônio com eficiência, transparência e controle total. Sem taxas escondidas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div 
            key={plan.name}
            className={cn(
              "relative bg-white rounded-3xl p-8 border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
              plan.featured ? "border-blue-200 shadow-xl shadow-blue-100/50 scale-105 z-10" : "border-slate-100 shadow-lg shadow-slate-200/50"
            )}
          >
            {plan.featured && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                MAIS POPULAR
              </div>
            )}
            
            <div className="flex items-center gap-4 mb-6">
              <div className={cn("p-3 rounded-2xl", plan.color)}>
                <plan.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                <span className="text-slate-400 font-medium">{plan.period}</span>
              </div>
              <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                {plan.description}
              </p>
            </div>

            <hr className="border-slate-100 mb-8" />

            <ul className="space-y-4 mb-10">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="mt-1 shrink-0 w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Check size={10} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>

            <button 
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]",
                plan.buttonVariant === 'primary' 
                  ? "bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              Começar {plan.name}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-20 p-10 bg-slate-900 rounded-[3rem] text-center text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-600/30 transition-all duration-700" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h3 className="text-3xl font-black mb-4">Precisa de uma solução sob medida?</h3>
          <p className="text-slate-400 mb-8 font-medium">
            Fale com nossos especialistas em gestão patrimonial e descubra como podemos ajudar sua empresa a economizar e ter mais controle.
          </p>
          <button className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl">
            Falar com Consultor
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const { 
    assets, categorias, filiais, audits, loading, addCategoria, updateCategoria, removeCategoria, addFilial, removeFilial, stats, 
    addAsset, updateAsset, deleteAsset, bulkAddAssets, startAudit, toggleAssetAudit, finalizeAudit, deleteAudit,
    error: categoriaErro, setError: setCategoriaErro, empresaId, empresaNome, updateEmpresaNome, refresh
  } = useAssets();
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [view, setView] = React.useState<'dashboard' | 'list' | 'reports' | 'categorias' | 'audit' | 'configuracoes' | 'plans'>('dashboard');
  const [tempCompanyName, setTempCompanyName] = React.useState<string | null>(null);
  const [isSavingCompany, setIsSavingCompany] = React.useState(false);
  const [newFilialName, setNewFilialName] = React.useState('');
  const [isAddingFilial, setIsAddingFilial] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);
  const [passwordFeedback, setPasswordFeedback] = React.useState<{type: 'success' | 'error', msg: string} | null>(null);
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', msg: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', msg: 'As senhas não coincidem.' });
      return;
    }
    
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setPasswordFeedback({ type: 'success', msg: 'Senha atualizada com sucesso!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setPasswordFeedback({ type: 'error', msg: error.message || 'Erro ao atualizar senha.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
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

  // Redirecionar para configurações se a empresa ou o nome não existir
  React.useEffect(() => {
    if (isAuthenticated && !loading) {
      if ((!empresaId || !empresaNome) && view !== 'configuracoes') {
        setView('configuracoes');
      }
    }
  }, [isAuthenticated, loading, empresaId, empresaNome, view]);

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
  const [showAlertsModal, setShowAlertsModal] = React.useState(false);
  const [activeFormSection, setActiveFormSection] = React.useState<'basics' | 'specs' | 'location' | 'maintenance' | 'notes'>('basics');

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
      setActiveFormSection('basics');
    } else {
      setSelectedStatus('Ativo');
      setHasWarranty(false);
      setHasPreventiveMaintenance(false);
      setActiveFormSection('basics');
    }
  }, [editingAsset, isModalOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const status = formData.get('status') as AssetStatus;
    const maintenanceValue = Number(formData.get('maintenanceValue') || 0);
    const maintenanceNotes = formData.get('maintenanceNotes') as string || '';
    const hasWarrantyValue = formData.get('hasWarranty') === 'on';
    const hasPreventiveValue = formData.get('hasPreventiveMaintenance') === 'on';
    
    let maintenanceHistory = editingAsset?.maintenanceHistory || [];
    
    // Se houve mudança significativa ou se é uma nova entrada
    if (status === 'Em Manutenção' && maintenanceValue > 0) {
      // Para manter a compatibilidade com a lógica anterior que adicionava ao histórico
      // Mas evitando duplicar se for apenas uma edição do mesmo valor/notas (simplificado)
      const lastSession = maintenanceHistory[maintenanceHistory.length - 1];
      if (!lastSession || lastSession.cost !== maintenanceValue || lastSession.notes !== maintenanceNotes) {
         maintenanceHistory = [
          ...maintenanceHistory,
          {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            cost: maintenanceValue,
            notes: maintenanceNotes,
          }
        ];
      }
    }

    const data = {
      codBaseBem: formData.get('codBaseBem') as string || '',
      name: formData.get('name') as string,
      tag: formData.get('tag') as string,
      brand: formData.get('brand') as string || '',
      model: formData.get('model') as string || '',
      serialNumber: formData.get('serialNumber') as string || '',
      description: formData.get('description') as string || '',
      categoria: formData.get('categoria') as CategoriaAtivo,
      filial_id: formData.get('filial_id') as string || null,
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
      maintenanceValue: status === 'Em Manutenção' ? maintenanceValue : 0,
      assignedTo: formData.get('assignedTo') as string || '',
      inactiveReason: formData.get('inactiveReason') as string || '',
      maintenanceHistory,
    };

    if (editingAsset) {
      updateAsset(editingAsset.id, data).then((success) => {
        if (success) {
          setIsModalOpen(false);
          setEditingAsset(null);
        }
      });
    } else {
      addAsset(data).then((success) => {
        if (success) {
          setIsModalOpen(false);
          setEditingAsset(null);
        }
      });
    }
  };

  const [syncTimeout, setSyncTimeout] = useState(false);

  useEffect(() => {
    let timer: any;
    if (loading && isAuthenticated) {
      timer = setTimeout(() => setSyncTimeout(true), 15000);
    } else {
      setSyncTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [loading, isAuthenticated]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (loading && !empresaId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-6 max-w-xs text-center px-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-slate-700 font-bold uppercase tracking-[0.2em] text-[10px]">Sincronizando Empresa</p>
            <p className="text-slate-500 text-xs leading-relaxed">
              {syncTimeout 
                ? "A sincronização está demorando mais que o esperado. Verifique se o SQL foi executado corretamente no console do Supabase." 
                : "Estamos preparando seu ambiente de gestão de ativos."}
            </p>
          </div>

          {syncTimeout && (
            <div className="flex flex-col gap-2 w-full">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-2 px-4 bg-white border border-slate-200 text-slate-700 text-[10px] font-bold uppercase rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                Tentar Novamente
              </button>
              <button 
                onClick={async () => {
                   await supabase.auth.signOut();
                   window.location.reload();
                }}
                className="w-full py-2 px-4 text-rose-500 text-[10px] font-bold uppercase hover:underline"
              >
                Sair / Logout
              </button>
            </div>
          )}
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
            <SidebarItem icon={Settings} label="Categorias" active={view === 'categorias'} onClick={() => { setView('categorias'); setIsSidebarOpen(false); }} />
            <SidebarItem icon={Building2} label="Configurações" active={view === 'configuracoes'} onClick={() => { setView('configuracoes'); setIsSidebarOpen(false); }} />
            <a 
              href="https://mkt-solutions.com.br/placas-de-patrimonio/#cotacao" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <ExternalLink size={18} className="transition-transform duration-200 group-hover:scale-110" />
              <span>Pedir novas placas</span>
            </a>
            <SidebarItem icon={CreditCard} label="Plano" active={view === 'plans'} onClick={() => { setView('plans'); setIsSidebarOpen(false); }} />
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
              {view === 'dashboard' ? 'Painel Geral' : view === 'list' ? 'Inventário' : view === 'reports' ? 'Relatórios' : view === 'audit' ? 'Controle Físico' : view === 'plans' ? 'Nossos Planos' : 'Configurações'}
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
            {view !== 'categorias' && view !== 'audit' && (
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

        {/* Global Error Banner */}
        <AnimatePresence>
          {categoriaErro && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between gap-6 shadow-xl overflow-hidden shrink-0 relative z-20 border-b border-amber-500"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-xl">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black tracking-widest opacity-80 leading-none mb-1">Ação Necessária</p>
                  <p className="text-xs font-bold leading-tight">{categoriaErro}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setView('configuracoes'); setCategoriaErro(null); }}
                  className="px-5 py-2 bg-white text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-50 transition-all shadow-sm whitespace-nowrap"
                >
                  Resolver Agora
                </button>
                <button onClick={() => setCategoriaErro(null)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable Region */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {view === 'dashboard' && (
            <DashboardView 
              stats={stats} 
              onMaintenanceClick={() => navigateToFilteredList('Em Manutenção')} 
              onAlertsClick={() => setShowAlertsModal(true)}
              onViewAll={() => setView('list')}
            />
          )}
          {view === 'list' && (
            <AssetListView 
              assets={assets.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.tag.toLowerCase().includes(searchTerm.toLowerCase()))} 
              categorias={categorias}
              filiais={filiais}
              initialStatusFilter={initialListStatus}
              onDelete={deleteAsset} 
              onEdit={handleEdit} 
              onBulkUpload={bulkAddAssets}
            />
          )}
          {view === 'reports' && <ReportsView assets={assets} categorias={categorias} audits={audits} filiais={filiais} />}
          {view === 'categorias' && (
            <CategoriasView 
              categorias={categorias} 
              onAdd={addCategoria} 
              onUpdate={updateCategoria} 
              onRemove={removeCategoria} 
              error={categoriaErro}
              clearError={() => setCategoriaErro(null)}
              onSync={refresh}
              loading={loading}
            />
          )}
          {view === 'audit' && (
            <AuditView 
              audits={audits} 
              filiais={filiais}
              startAudit={startAudit} 
              toggleAssetAudit={toggleAssetAudit} 
              finalizeAudit={finalizeAudit} 
              deleteAudit={deleteAudit} 
              error={categoriaErro}
              clearError={() => setCategoriaErro(null)}
            />
          )}
          {view === 'plans' && <PlansView />}
          {view === 'configuracoes' && (
            <div className="max-w-2xl mx-auto py-8">
              <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-5 mb-10">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                    <Building2 size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Configuração da Empresa</h2>
                    <p className="text-slate-500 font-medium">Configure sua organização para gerenciar ativos.</p>
                  </div>
                </div>

                {(!empresaId || !empresaNome) ? (
                  <div className="space-y-8">
                    <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-5">
                      <AlertTriangle className="text-amber-600 shrink-0 mt-1" size={24} />
                      <div>
                        <h4 className="text-amber-900 font-bold text-base">Empresa Necessária</h4>
                        <p className="text-amber-700 font-medium text-sm mt-1 leading-relaxed">
                          Para começar a usar o sistema, você precisa cadastrar o nome da sua empresa. Isso criará seu espaço de trabalho exclusivo.
                        </p>
                      </div>
                    </div>
                    <SetupCompany user={currentUser} onComplete={() => refresh()} embedded={true} />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* SQL REPAIR SECTION FOR FILIAIS AND AUDITS */}
                    {(categoriaErro && (
                      categoriaErro.includes('filiais') || 
                      categoriaErro.includes('Permissão') || 
                      categoriaErro.includes('cod_base_bem') || 
                      categoriaErro.includes('brand') || 
                      categoriaErro.includes('model') || 
                      categoriaErro.includes('serial_number') || 
                      categoriaErro.includes('audits') || 
                      categoriaErro.includes('conferência')
                    )) && (
                      <div className="p-8 bg-amber-50 rounded-3xl border border-amber-200 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200">
                            <AlertTriangle size={24} />
                          </div>
                          <div className="space-y-4 flex-1">
                            <div>
                              <h3 className="text-xl font-black text-amber-900 tracking-tight">Correção de Banco de Dados Necessária</h3>
                              <p className="text-amber-700 text-sm font-bold mt-1">Detectamos colunas ou permissões faltando no seu Supabase. Para resolver, execute o código abaixo no seu SQL Editor:</p>
                            </div>
                            
                            <div className="relative group">
                              <pre className="p-6 bg-slate-900 text-blue-400 rounded-2xl text-[11px] font-mono overflow-x-auto border-2 border-slate-800 shadow-xl leading-relaxed whitespace-pre-wrap select-all">
{`CREATE TABLE IF NOT EXISTS filiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

GRANT ALL ON filiais TO authenticated;
GRANT ALL ON filiais TO anon;

ALTER TABLE filiais DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permit_all" ON filiais;
ALTER TABLE filiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permit_all" ON filiais FOR ALL TO public USING (true) WITH CHECK (true);

-- Atualização da tabela de ativos
ALTER TABLE assets ADD COLUMN IF NOT EXISTS filial_id uuid REFERENCES filiais(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS cod_base_bem text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS filial_id uuid REFERENCES filiais(id) ON DELETE SET NULL;

GRANT ALL ON assets TO authenticated;
GRANT ALL ON audits TO authenticated;

-- Recarregar cache do esquema (Importante para que o Supabase reconheça as colunas novas)
NOTIFY pgrst, 'reload schema';`}
                              </pre>
                              <div className="absolute top-4 right-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800 px-2 py-1 rounded-lg">Clique para selecionar tudo</div>
                            </div>
                            
                            <button 
                              onClick={() => setCategoriaErro(null)}
                              className="px-6 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-black hover:bg-amber-200 transition-all uppercase tracking-widest"
                            >
                              Já executei o comando
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-8 bg-emerald-50 rounded-3xl border border-emerald-100 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200">
                            <Check size={24} />
                          </div>
                          <div>
                            <p className="text-emerald-700 font-black text-[10px] uppercase tracking-widest">Status: Licença Ativa</p>
                            <h3 className="text-xl font-black text-emerald-900 tracking-tight">Sua organização está vinculada</h3>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                      <h4 className="text-slate-900 font-black text-sm uppercase tracking-widest mb-6 px-1 flex items-center gap-2">
                        <Edit3 size={16} className="text-blue-600" /> Detalhes da Empresa
                      </h4>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Organização</label>
                          <div className="flex gap-3">
                            <input
                              type="text"
                              className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-base focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                              value={tempCompanyName !== null ? tempCompanyName : (empresaNome || '')}
                              onChange={(e) => setTempCompanyName(e.target.value)}
                              placeholder="Nome da sua empresa"
                            />
                            <button
                              onClick={async () => {
                                if (!tempCompanyName) return;
                                setIsSavingCompany(true);
                                const success = await updateEmpresaNome(tempCompanyName);
                                if (success) {
                                  setTempCompanyName(null);
                                }
                                setIsSavingCompany(false);
                              }}
                              disabled={isSavingCompany || tempCompanyName === null || tempCompanyName === empresaNome}
                              className="px-8 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg active:scale-95"
                            >
                              {isSavingCompany ? 'SALVANDO...' : 'SALVAR'}
                            </button>
                          </div>
                          {tempCompanyName !== null && tempCompanyName !== empresaNome && (
                            <p className="text-[10px] text-amber-600 font-bold ml-1 mt-2 flex items-center gap-1">
                              <AlertTriangle size={12} /> Alteração pendente. Clique em salvar para confirmar.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                      <h4 className="text-slate-900 font-black text-sm uppercase tracking-widest mb-6 px-1 flex items-center gap-2">
                        <MapIcon size={16} className="text-blue-600" /> Filiais e Unidades
                      </h4>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adicionar Nova Filial</label>
                          <div className="flex gap-3">
                            <input
                              type="text"
                              className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-base focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                              value={newFilialName}
                              onChange={(e) => setNewFilialName(e.target.value)}
                              placeholder="Ex: Filial Sul, Unidade II..."
                            />
                            <button
                              onClick={async () => {
                                if (!newFilialName) return;
                                setIsAddingFilial(true);
                                const success = await addFilial(newFilialName);
                                if (success) setNewFilialName('');
                                setIsAddingFilial(false);
                              }}
                              disabled={isAddingFilial || !newFilialName}
                              className="px-8 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg active:scale-95"
                            >
                              {isAddingFilial ? '...' : 'ADICIONAR'}
                            </button>
                          </div>
                        </div>

                        {filiais.length > 0 && (
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Filiais Cadastradas</label>
                            <div className="grid grid-cols-1 gap-2">
                              {filiais.map(filial => (
                                <div key={filial.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl mix-blend-multiply">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                                      <MapPin size={16} />
                                    </div>
                                    <span className="font-bold text-slate-700">{filial.nome}</span>
                                  </div>
                                  <button 
                                    onClick={() => removeFilial(filial.id)}
                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                      <h4 className="text-slate-900 font-black text-sm uppercase tracking-widest mb-6 px-1 flex items-center gap-2">
                        <Lock size={16} className="text-blue-600" /> Segurança da Conta
                      </h4>
                      <form onSubmit={handleUpdatePassword} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Senha</label>
                            <input
                              type="password"
                              required
                              className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-base focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Senha</label>
                            <input
                              type="password"
                              required
                              className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-base focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                            />
                          </div>
                        </div>
                        
                        {passwordFeedback && (
                          <div className={cn(
                            "p-4 rounded-2xl text-sm font-bold border flex items-center gap-3 animate-in fade-in slide-in-from-top-1",
                            passwordFeedback.type === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                          )}>
                            {passwordFeedback.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                            {passwordFeedback.msg}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isUpdatingPassword || !newPassword}
                          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                          {isUpdatingPassword ? 'ATUALIZANDO...' : <>ATUALIZAR SENHA <Lock size={18} /></>}
                        </button>
                      </form>
                    </div>

                    <div className="p-6 text-center">
                      <p className="text-slate-400 text-xs font-medium italic">
                        Para transferir a titularidade da conta ou excluir a organização, entre em contato com o administrador global do sistema.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal Form */}
      {/* Alerts Modal */}
      <Modal
        isOpen={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
        title="Alertas Próximos"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Abaixo estão os ativos que necessitam de atenção imediata devido a manutenções ou garantias próximas.
          </p>
          <div className="max-h-[60vh] overflow-y-auto px-1 custom-scrollbar space-y-3">
            {stats.alerts && stats.alerts.length > 0 ? (
              stats.alerts.map((alert: any) => (
                <div 
                  key={`${alert.id}-${alert.type}-${alert.date}`} 
                  className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2.5 rounded-xl", 
                      alert.type === 'Garantia' ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {alert.type === 'Garantia' ? <Search size={20} /> : <Clock size={20} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{alert.name}</h4>
                      <p className="text-xs text-slate-500">{alert.type}: {alert.date.split('-').reverse().join('/')}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const asset = assets.find(a => a.id === alert.id);
                      if (asset) {
                        setEditingAsset(asset);
                        setIsModalOpen(true);
                      }
                      setShowAlertsModal(false);
                    }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Check size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-slate-500">Tudo em dia! Nenhum alerta crítico.</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowAlertsModal(false)}
            className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
          >
            FECHAR
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingAsset(null); setCategoriaErro(null); }} 
        title={editingAsset ? "Editar Ativo" : "Cadastrar Ativo"}
      >
        {categoriaErro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{categoriaErro}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3 pb-2">
          <div className="space-y-2.5">
            <AccordionItem 
              id="basics" 
              title="Informações Básicas" 
              icon={Box} 
              isActive={activeFormSection === 'basics'} 
              onClick={() => setActiveFormSection('basics')}
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Nome do Ativo</label>
                <input name="name" defaultValue={editingAsset?.name} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Notebook Dell Latitude" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Tag de Patrimônio</label>
                  <input name="tag" defaultValue={editingAsset?.tag} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="000001" />
                  <p className="mt-1 text-[9px] text-amber-600 font-medium leading-tight">Use exatamente o que consta na etiqueta física.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Categoria</label>
                  <select name="categoria" defaultValue={editingAsset?.categoria} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Status do Bem</label>
                <select 
                  name="status" 
                  defaultValue={editingAsset?.status} 
                  onChange={(e) => setSelectedStatus(e.target.value as AssetStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Ativo">🟢 Ativo (Em uso)</option>
                  <option value="Em Manutenção">🟠 Em Manutenção / Reparo</option>
                  <option value="Em andamento">🟣 Em andamento / Processamento</option>
                  <option value="Emprestado">🔵 Emprestado / Com Terceiros</option>
                  <option value="Inativo">🔴 Inativo / Baixado</option>
                </select>
              </div>
            </AccordionItem>

            <AccordionItem 
              id="specs" 
              title="Especificações Técnicas" 
              icon={Settings} 
              isActive={activeFormSection === 'specs'} 
              onClick={() => setActiveFormSection('specs')}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Marca</label>
                  <input name="brand" defaultValue={editingAsset?.brand} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Dell, HP, Apple..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Modelo</label>
                  <input name="model" defaultValue={editingAsset?.model} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Vostro 3500, iPhone 13..." />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Nº de Série</label>
                <input name="serialNumber" defaultValue={editingAsset?.serialNumber} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="SN123456789" />
              </div>
            </AccordionItem>

            <AccordionItem 
              id="location" 
              title="Departamento e Financeiro" 
              icon={MapPin} 
              isActive={activeFormSection === 'location'} 
              onClick={() => setActiveFormSection('location')}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Departamento / Sala</label>
                  <input name="location" defaultValue={editingAsset?.location} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="TI, Recepção, Copa..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Cód. Contábil</label>
                  <input name="codBaseBem" defaultValue={editingAsset?.codBaseBem} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Opcional" />
                </div>
              </div>
              {filiais.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Unidade Responsável</label>
                  <select 
                    name="filial_id" 
                    defaultValue={editingAsset?.filial_id} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Sede / Matriz</option>
                    {filiais.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Data de Compra</label>
                  <input name="purchaseDate" type="date" defaultValue={editingAsset?.purchaseDate || new Date().toISOString().split('T')[0]} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Valor do Bem (BRL)</label>
                  <input name="value" type="number" step="0.01" defaultValue={editingAsset?.value} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
              </div>
            </AccordionItem>

            <AccordionItem 
              id="maintenance" 
              title="Garantia e Manutenção" 
              icon={ShieldCheck} 
              isActive={activeFormSection === 'maintenance'} 
              onClick={() => setActiveFormSection('maintenance')}
            >
              <div className="grid grid-cols-2 gap-3 mb-1">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:bg-blue-50 hover:border-blue-200">
                  <input 
                    name="hasPreventiveMaintenance" 
                    type="checkbox" 
                    checked={hasPreventiveMaintenance}
                    onChange={(e) => setHasPreventiveMaintenance(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" 
                  />
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Manutenção</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:bg-blue-50 hover:border-blue-200">
                  <input 
                    name="hasWarranty" 
                    type="checkbox" 
                    checked={hasWarranty}
                    onChange={(e) => setHasWarranty(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4" 
                  />
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Possui Garantia</span>
                </label>
              </div>

              <AnimatePresence>
                {(hasPreventiveMaintenance || hasWarranty) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-4 pt-2"
                  >
                    {hasPreventiveMaintenance && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <div>
                          <label className="block text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5">Próxima Revisão</label>
                          <input 
                            name="nextMaintenanceDate" 
                            type="date" 
                            defaultValue={editingAsset?.nextMaintenanceDate} 
                            required={hasPreventiveMaintenance}
                            className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light]" 
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5">Intervalo (meses)</label>
                          <input 
                            name="maintenanceIntervalMonths" 
                            type="number" 
                            min="1"
                            defaultValue={editingAsset?.maintenanceIntervalMonths} 
                            className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Ex: 6"
                          />
                        </div>
                      </div>
                    )}
                    {hasWarranty && (
                      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                        <label className="block text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1.5">Vencimento da Garantia</label>
                        <input 
                          name="warrantyExpirationDate" 
                          type="date" 
                          defaultValue={editingAsset?.warrantyExpirationDate} 
                          required={hasWarranty}
                          className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:light]" 
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {selectedStatus === 'Em Manutenção' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3 pt-2"
                  >
                    <div className="flex items-center gap-2 text-amber-700 mb-1">
                      <AlertTriangle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Registrar Gasto de Manutenção</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-amber-600 uppercase mb-1">Custo (BRL)</label>
                        <input name="maintenanceValue" type="number" step="0.01" defaultValue={editingAsset?.maintenanceValue} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-amber-600 uppercase mb-1">Empresa / Notas</label>
                        <input name="maintenanceNotes" type="text" defaultValue={editingAsset?.maintenanceNotes} className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500" placeholder="Ex: Oficina X" />
                      </div>
                    </div>
                  </motion.div>
                )}
                {selectedStatus === 'Emprestado' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden pt-2"
                  >
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Responsável pelo Empréstimo</label>
                    <input 
                      name="assignedTo" 
                      defaultValue={editingAsset?.assignedTo} 
                      required={selectedStatus === 'Emprestado'}
                      placeholder="Ex: Nome do Funcionário ou Tercerizado"
                      className="w-full px-3 py-2 bg-slate-50 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </motion.div>
                )}
                {selectedStatus === 'Inativo' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden pt-2"
                  >
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Motivo da Inativação (Obrigatório)</label>
                    <textarea 
                      name="inactiveReason" 
                      defaultValue={editingAsset?.inactiveReason} 
                      required={selectedStatus === 'Inativo'}
                      placeholder="Descreva o motivo da baixa (Danos, obsolescência, perda...)"
                      className="w-full px-3 py-2 bg-slate-50 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none min-h-[80px] resize-none" 
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </AccordionItem>

            <AccordionItem 
              id="notes" 
              title="Observações Gerais" 
              icon={FileText} 
              isActive={activeFormSection === 'notes'} 
              onClick={() => setActiveFormSection('notes')}
            >
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">Notas e detalhes</label>
                <textarea 
                  name="description" 
                  defaultValue={editingAsset?.description} 
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                  placeholder="Detalhes sobre o estado físico, especificações extras ou qualquer observação relevante..."
                />
              </div>
            </AccordionItem>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={() => { setIsModalOpen(false); setEditingAsset(null); }}
              className="flex-1 py-3.5 border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm tracking-wide hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              CANCELAR
            </button>
            <button 
              type="submit"
              className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              {editingAsset ? "Atualizar" : "Salvar Ativo"}
              <Check size={18} />
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
