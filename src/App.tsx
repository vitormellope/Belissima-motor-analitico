import { useState, useCallback } from 'react';
import type { Transaction } from './types';
import { parseExcelFile } from './utils/parseExcel';
import { UploadZone } from './components/UploadZone';
import { Dashboard } from './pages/Dashboard';
import { RadarVariacao } from './pages/RadarVariacao';
import { DrePage } from './pages/DrePage';
import { RadarMargens } from './pages/RadarMargens';
import { InsightsPage } from './pages/InsightsPage';
import { LoginPage } from './pages/LoginPage';
import {
  LayoutDashboard, BarChart3, Radar, TrendingUp,
  LogOut, Store, FileSpreadsheet, ChevronRight, ChevronLeft, Brain,
} from 'lucide-react';

type Page = 'dashboard' | 'dre' | 'radar' | 'margens' | 'insights';

const NAV_TABS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard',                    icon: <LayoutDashboard size={15} /> },
  { id: 'dre',       label: 'DRE',                          icon: <BarChart3 size={15} /> },
  { id: 'radar',     label: 'Radar de Despesas',            icon: <Radar size={15} /> },
  { id: 'margens',   label: 'Radar de Margens',             icon: <TrendingUp size={15} /> },
  { id: 'insights',  label: 'Insights Test',                icon: <Brain size={15} /> },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('belissima_auth') === 'true',
  );

  const [saidas, setSaidas]               = useState<Transaction[]>([]);
  const [entradas, setEntradas]           = useState<Transaction[]>([]);
  const [saidasFile, setSaidasFile]       = useState<string>();
  const [entradasFile, setEntradasFile]   = useState<string>();
  const [loadingSaidas, setLoadingSaidas]     = useState(false);
  const [loadingEntradas, setLoadingEntradas] = useState(false);
  const [error, setError]                 = useState<string>();
  const [activePage, setActivePage]       = useState<Page>('dashboard');
  const [collapsed, setCollapsed]         = useState(false);

  const handleSaidasFile = useCallback(async (file: File) => {
    setLoadingSaidas(true);
    setError(undefined);
    try {
      const result = await parseExcelFile(file, 'saidas');
      setSaidas(result);
      setSaidasFile(file.name);
    } catch (err) {
      console.error('Erro ao processar saídas:', err);
      setError(`Erro ao processar o arquivo de saídas: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingSaidas(false);
    }
  }, []);

  const handleEntradasFile = useCallback(async (file: File) => {
    setLoadingEntradas(true);
    setError(undefined);
    try {
      const result = await parseExcelFile(file, 'entradas');
      setEntradas(result);
      setEntradasFile(file.name);
    } catch (err) {
      console.error('Erro ao processar entradas:', err);
      setError(`Erro ao processar o arquivo de entradas: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingEntradas(false);
    }
  }, []);

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
          <div className="w-9 h-9 bg-rose-500 rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <Store size={17} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-slate-800 leading-tight">Motor Analítico</p>
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

        {/* Upload zones — hidden when collapsed */}
        {!collapsed && (
          <div className="px-3 pb-3 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Importar Planilhas</p>
            <div className="space-y-2">
              <UploadZone
                label="Saídas"
                sublabel="Contas a Pagar (.xlsx)"
                accent="text-rose-500"
                bgAccent="bg-rose-50"
                borderAccent="border-rose-300"
                fileName={saidasFile}
                onFile={handleSaidasFile}
                onClear={() => { setSaidas([]); setSaidasFile(undefined); }}
                loading={loadingSaidas}
              />
              <UploadZone
                label="Entradas"
                sublabel="Quadro de Vendas (.xlsx)"
                accent="text-emerald-500"
                bgAccent="bg-emerald-50"
                borderAccent="border-emerald-300"
                fileName={entradasFile}
                onFile={handleEntradasFile}
                onClear={() => { setEntradas([]); setEntradasFile(undefined); }}
                loading={loadingEntradas}
              />
            </div>

            {error && (
              <p className="mt-2 text-[11px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            {/* Contador de lançamentos */}
            {totalLancamentos > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                <FileSpreadsheet size={13} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-600">{totalLancamentos.toLocaleString('pt-BR')} lançamentos</p>
                  <p className="text-[10px] text-slate-400">
                    {saidas.length > 0 && `${saidas.length} saídas`}
                    {saidas.length > 0 && entradas.length > 0 && ' · '}
                    {entradas.length > 0 && `${entradas.length} entradas`}
                  </p>
                </div>
              </div>
            )}
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
          {activePage === 'dashboard' && <Dashboard saidas={saidas} entradas={entradas} />}
          {activePage === 'radar'     && <RadarVariacao saidas={saidas} />}
          {activePage === 'dre'       && <DrePage saidas={saidas} entradas={entradas} />}
          {activePage === 'margens'   && <RadarMargens saidas={saidas} entradas={entradas} />}
          {activePage === 'insights'  && <InsightsPage saidas={saidas} entradas={entradas} />}
        </main>
      </div>
    </div>
  );
}
