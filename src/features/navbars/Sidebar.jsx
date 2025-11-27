import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

import FiiHistoricalChecker from '../fiiHistoricData/FiiHistoricalChecker.jsx';
import FiiSimulator from '../../pages/FiiSimulator.jsx';
import RentabilityComparisonCalculator from '../../pages/RentabilityComparisonCalculator.jsx';
import ReverseImpactCalculator from '../../pages/ReverseImpactCalculator.jsx';
import IpcaCalculator from '../../pages/IpcaCalculator.jsx';
import PricePositionCalculator from '../stockHistoricData/PricePositionCalculator.jsx';
import WalletDashboard from '../wallet/WalletDashboard.jsx';

const menuItems = [
  {
    id: 'wallet-dashboard',
    label: 'Minha Carteira',
    icon: '💼',
    component: WalletDashboard,
  },
  {
    id: 'fii-historical-checker',
    label: 'Histórico de FIIs (HG Brasil)',
    icon: '🏠',
    component: FiiHistoricalChecker,
  },
  {
    id: 'price-analyzer',
    label: 'Analisador de Preço (Ações)',
    icon: '💹',
    component: PricePositionCalculator,
  },
  {
    id: 'fii-simulator',
    label: 'Simulador de Investimento (FIIs)',
    icon: '📈',
    component: FiiSimulator,
  },
  {
    id: 'rentability-comparison',
    label: 'Comparação (LCI/LCA vs CDB)',
    icon: '💰',
    component: RentabilityComparisonCalculator,
  },
  {
    id: 'reverse-impact',
    label: 'Calculadora de Impacto Reverso',
    icon: '⏱️',
    component: ReverseImpactCalculator,
  },
  {
    id: 'ipca-calculator',
    label: 'Calculadora de Correção (IPCA)',
    icon: '📊',
    component: IpcaCalculator,
  },
];

export const defaultCalculator = menuItems[0];

function Sidebar({ onSelectCalculator, isMobileOpen, onClose }) {
  const [activeItem, setActiveItem] = useState(defaultCalculator.id);
  const { user, signOut } = useAuth();

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const userName = user?.email ? user.email.split('@')[0] : 'Visitante';
  const userEmail = user?.email || '';

  const handleItemClick = (item) => {
    setActiveItem(item.id);
    onSelectCalculator(item.component);
    if (onClose) onClose();
  };

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
              <button
                onClick={() => handleItemClick(item)}
                className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-200 flex items-center space-x-3 group border ${
                  activeItem === item.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border-transparent'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white border-transparent'
                }`}
              >
                <span
                  className={`text-xl transition-transform duration-200 ${activeItem === item.id ? 'scale-110' : 'group-hover:scale-110'}`}
                >
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {}
      <div className="p-4 border-t border-gray-300 dark:border-gray-700 mt-auto bg-gray-100 dark:bg-gray-800/50">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-sm mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white dark:ring-gray-600 shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{userName}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-medium">
              {userEmail}
            </p>
          </div>
          <button
            onClick={signOut}
            title="Sair"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
          </button>
        </div>

        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center font-medium">
          Version 1.1.0
        </p>
      </div>
    </>
  );

  return (
    <>
      {}
      <div
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 transition-opacity md:hidden ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 flex flex-col z-50 transform transition-transform shadow-2xl md:hidden border-r border-gray-300 dark:border-gray-700 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {}
      <div className="hidden md:flex md:flex-col md:w-72 bg-white dark:bg-gray-800 h-screen shadow-xl border-r border-gray-300 dark:border-gray-700 z-20 transition-colors duration-200">
        {sidebarContent}
      </div>
    </>
  );
}

export default Sidebar;
