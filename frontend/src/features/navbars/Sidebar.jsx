import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { NavLink } from 'react-router-dom';

import FiiSimulator from '../../pages/FiiSimulator.jsx';
import IpcaCalculator from '../../pages/IpcaCalculator.jsx';
import PricePositionCalculator from '../stockHistoricData/PricePositionCalculator.jsx';
import WalletDashboard from '../wallet/WalletDashboard.jsx';
import Settings from '../settings/Settings.jsx';
import Contributions from '../contributions/Contributions.jsx';
import WhereToInvest from '../guidance/WhereToInvest.jsx';
import WalletBalancer from '../balancing/WalletBalancer.jsx';
import AssetsManager from '../importer/AssetsManager.jsx';

import { Settings as SettingsIcon, LogOut, Database } from 'lucide-react';

export const menuItems = [
  {
    id: 'wallet-dashboard',
    label: 'Minha Carteira',
    icon: '💼',
    path: '/',
    component: WalletDashboard,
  },
  {
    id: 'contributions',
    label: 'Meus Aportes',
    icon: '📝',
    path: '/aportes',
    component: Contributions,
  },
  {
    id: 'where-to-invest',
    label: 'Onde aportar?',
    icon: '🧭',
    path: '/recomendacao',
    component: WhereToInvest,
  },
  {
    id: 'wallet-balancer',
    label: 'Balanceador Inteligente',
    icon: '⚖️',
    path: '/balanceador',
    component: WalletBalancer,
  },
  {
    id: 'data-management',
    label: 'Gerenciar ativos',
    icon: '🗄️',
    path: '/gerenciar-ativos',
    component: AssetsManager,
  },
  {
    id: 'price-analyzer',
    label: 'Analisador de Preço (Ações)',
    icon: '💹',
    path: '/analise-preco',
    component: PricePositionCalculator,
  },
  {
    id: 'fii-simulator',
    label: 'Simulador de Investimento (FIIs)',
    icon: '📈',
    path: '/simulador-fii',
    component: FiiSimulator,
  },
  {
    id: 'ipca-calculator',
    label: 'Calculadora de Correção (IPCA)',
    icon: '📊',
    path: '/calculadora-ipca',
    component: IpcaCalculator,
  },
];

export const SettingsComponent = Settings;

function Sidebar({ isMobileOpen, onClose }) {
  const { user, profile } = useAuth();

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split('@')[0] : 'Visitante');

  const userEmail = user?.email || '';

  const userAvatarUrl =
    profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const getLinkClass = ({ isActive }) => `
    w-full text-left px-3 py-3 rounded-lg transition-all duration-200 flex items-center space-x-3 group border
    ${
      isActive
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border-transparent'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white border-transparent'
    }
  `;

  const sidebarContent = (
    <>
      {}
      <div className="h-20 flex items-center justify-center border-b border-gray-300 dark:border-gray-700 mb-4 transition-colors duration-200 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white tracking-wide transition-colors duration-200">
            CALC<span className="text-blue-600 dark:text-blue-400">INVEST</span>
          </h1>
        </div>
      </div>

      {}
      <nav className="flex-1 overflow-y-auto px-3 custom-scrollbar">
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 mt-2 pl-2 transition-colors duration-200">
          Menu Principal
        </p>
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <NavLink to={item.path} className={getLinkClass} onClick={() => onClose && onClose()}>
                {({ isActive }) => (
                  <>
                    <span
                      className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-sm font-medium">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {}
      <div className="p-4 border-t border-gray-300 dark:border-gray-700 mt-auto bg-gray-100 dark:bg-gray-800/50">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm mb-3">
          {userAvatarUrl ? (
            <img
              src={userAvatarUrl}
              alt={userName}
              className="w-10 h-10 rounded-full object-cover shadow-md ring-2 ring-white dark:ring-gray-600 shrink-0"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white dark:ring-gray-600 shrink-0">
              {userInitial}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{userName}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-medium">
              {userEmail}
            </p>
          </div>

          <NavLink
            to="/configuracoes"
            onClick={() => onClose && onClose()}
            className={({ isActive }) =>
              `p-1.5 rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`
            }
          >
            <SettingsIcon className="w-5 h-5" strokeWidth={1.75} />
          </NavLink>
        </div>

        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center font-medium">
          Version 1.1.0
        </p>
      </div>
    </>
  );

  return (
    <>
      <div
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 transition-opacity md:hidden ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 flex flex-col z-50 transform transition-transform shadow-2xl md:hidden border-r border-gray-300 dark:border-gray-700 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      <div className="hidden md:flex md:flex-col md:w-72 bg-white dark:bg-gray-800 h-screen shadow-xl border-r border-gray-300 dark:border-gray-700 z-20 transition-colors duration-200">
        {sidebarContent}
      </div>
    </>
  );
}

export default Sidebar;
