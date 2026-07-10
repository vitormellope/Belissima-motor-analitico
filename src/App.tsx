import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { RadarVariacao } from './pages/RadarVariacao';
import { DrePage } from './pages/DrePage';
import { RadarMargens } from './pages/RadarMargens';
import { ResumoVendasPage } from './pages/ResumoVendasPage';
import { ConciliacaoPage } from './pages/ConciliacaoPage';
import { LoginPage } from './pages/LoginPage';
import { useSupabaseData } from './hooks/useSupabaseData';
import {
  LayoutDashboard, BarChart3, Radar, TrendingUp,
  LogOut, ChevronRight, ChevronLeft, CreditCard, RefreshCw, AlertTriangle, Scale,
} from 'lucide-react';

type Page = 'dashboard' | 'dre' | 'radar' | 'margens' | 'resumo-vendas' | 'conciliacao';

const NAV_TABS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',      label: 'Visão Geral',                  icon: <LayoutDashboard size={15} /> },
  { id: 'dre',            label: 'DRE',                          icon: <BarChart3 size={15} /> },
  { id: 'radar',          label: 'Radar de Saídas',              icon: <Radar size={15} /> },
  { id: 'margens',        label: 'Radar de Margens',             icon: <TrendingUp size={15} /> },
  { id: 'resumo-vendas',  label: 'Resumo de Vendas',             icon: <CreditCard size={15} /> },
  { id: 'conciliacao',    label: 'Conciliação',                  icon: <Scale size={15} /> },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('belissima_auth') === 'true',
  );
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  const { saidas, entradas, paymentSummary, bankBalances, lastImportedAt, loading, error, refresh } = useSupabaseData();

  const handleLogout = () => {
    sessionStorage.removeItem('belissima_auth');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  const totalLancamentos = saidas.length + entradas.length;

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`${collapsed ? 'w-14' : 'w-60'} bg-white border-r border-slate-100 shadow-sm fixed top-0 left-0 h-screen flex flex-col z-40 transition-all duration-200`}>

        {/* Logo */}
        <div className={`${collapsed ? 'px-2 pt-4 pb-4 justify-center' : 'px-5 pt-6 pb-5'} border-b border-slate-100 flex items-center gap-3`}>
          <img src="/bybrain-logo.svg" alt="ByBrain" className="w-9 h-9 shrink-0" />
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-slate-800 leading-tight">Audit</p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">Belíssima Bonsucesso</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`${collapsed ? 'px-2' : 'px-3'} pt-5 pb-3`}>
          {!collapsed && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Navegação</p>}
          <div className="space-y-0.5">
            {NAV_TABS.map((tab) => {
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActivePage(tab.id)}
                  title={collapsed ? tab.label : undefined}
                  className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left group ${
                    isActive
                      ? 'bg-rose-50 text-rose-600'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <span className={`shrink-0 transition-colors ${isActive ? 'text-rose-500' : 'text-slate-400 group-hover:text-slate-500'}`}>
                    {tab.icon}
                  </span>
                  {!collapsed && <span className="flex-1">{tab.label}</span>}
                  {!collapsed && isActive && <ChevronRight size={12} className="text-rose-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mx-3 border-t border-slate-100 my-2" />

        {/* Status dos dados — substitui o antigo upload manual */}
        {!collapsed && (
          <div className="px-3 pb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Dados</p>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-2">
                <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-600">Falha ao carregar dados: {error}</p>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-600">
                  {loading ? 'Carregando…' : `${totalLancamentos.toLocaleString('pt-BR')} lançamentos`}
                </p>
                <button
                  onClick={() => refresh()}
                  title="Atualizar dados"
                  disabled={loading}
                  className="text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
              {!loading && (
                <p className="text-[10px] text-slate-400">
                  {saidas.length > 0 && `${saidas.length} saídas`}
                  {saidas.length > 0 && entradas.length > 0 && ' · '}
                  {entradas.length > 0 && `${entradas.length} entradas`}
                </p>
              )}
              {lastImportedAt && (
                <p className="text-[10px] text-slate-400">
                  Atualizado em {lastImportedAt.toLocaleDateString('pt-BR')} às {lastImportedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Collapse toggle + Logout */}
        <div className={`${collapsed ? 'px-2' : 'px-3'} py-4 border-t border-slate-100 space-y-1`}>
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all`}
          >
            {collapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronLeft size={14} className="shrink-0" />}
            {!collapsed && 'Recolher menu'}
          </button>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sair do sistema' : undefined}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all`}
          >
            <LogOut size={14} className="shrink-0" />
            {!collapsed && 'Sair do sistema'}
          </button>
          {!collapsed && (
            <p className="text-center text-[10px] text-slate-300 mt-1">
              © {new Date().getFullYear()} Belíssima Bonsucesso
            </p>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className={`${collapsed ? 'ml-14' : 'ml-60'} flex-1 min-h-screen flex flex-col transition-all duration-200`}>
        <main className="flex-1 px-6 py-6 space-y-5">
          {activePage === 'dashboard'     && <Dashboard saidas={saidas} entradas={entradas} />}
          {activePage === 'radar'         && <RadarVariacao saidas={saidas} />}
          {activePage === 'dre'           && <DrePage saidas={saidas} entradas={entradas} />}
          {activePage === 'margens'       && <RadarMargens saidas={saidas} entradas={entradas} />}
          {activePage === 'resumo-vendas' && <ResumoVendasPage paymentSummary={paymentSummary} />}
          {activePage === 'conciliacao'   && <ConciliacaoPage saidas={saidas} entradas={entradas} bankBalances={bankBalances} />}
        </main>
      </div>
    </div>
  );
}
