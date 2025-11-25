import { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext'; // Import useAuth
import CompoundInterestCalculator from '../pages/CompoundInterestCalculator.jsx';
import ReverseImpactCalculator from '../pages/ReverseImpactCalculator.jsx';
import FiiHistoricalChecker from '../pages/FiiHistoricalChecker.jsx';
import FiiSimulator from '../pages/FiiSimulator.jsx';
import RentabilityComparisonCalculator from '../pages/RentabilityComparisonCalculator.jsx';
import IpcaCalculator from '../pages/IpcaCalculator.jsx';
import PricePositionCalculator from '../pages/PricePositionCalculator.jsx';

// ... (keep menuItems and defaultCalculator definitions exactly as they were) ...
const menuItems = [
  {
    id: 'fii-historical-checker',
    label: 'Histórico de FIIs (HG Brasil)',
    icon: '🏠',
    component: FiiHistoricalChecker,
  },
  {
    id: 'fii-simulator',
    label: 'Simulador de Investimento (FIIs)',
    icon: '📈',
    component: FiiSimulator,
  },
  {
    id: 'rentability-comparison',
    label: 'Comparação de Rentabilidade (LCI/LCAs vs CDB)',
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
  {
    id: 'price-analyzer',
    label: 'Analisador de Preço (Ações)',
    icon: '💹',
    component: PricePositionCalculator,
  },
];

export const defaultCalculator = menuItems[0];

function Sidebar({ onSelectCalculator, isMobileOpen, onClose }) {
  const [activeItem, setActiveItem] = useState(defaultCalculator.id);
  const { signOut, user } = useAuth(); // Get signOut function and user

  const handleItemClick = (item) => {
    setActiveItem(item.id);
    onSelectCalculator(item.component);

    if (onClose) {
      onClose();
    }
  };

  const sidebarContent = (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-center">Calculadora de Investimentos</h1>
        <p className="text-xs text-gray-400 text-center mt-2 truncate px-2">
          {user?.email}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleItemClick(item)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 flex items-center space-x-3 ${
                  activeItem === item.id ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-gray-700'
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="pt-4 mt-2 border-t border-gray-700 space-y-4">
        <button
          onClick={signOut}
          className="w-full text-left px-4 py-2 rounded-lg hover:bg-red-600/20 text-red-300 hover:text-red-100 transition-colors duration-200 flex items-center space-x-3"
        >
          <span>🚪</span>
          <span className="text-sm">Sair</span>
        </button>
        <p className="text-xs text-gray-500 text-center">© 2024 Ferramentas de Investimento</p>
      </div>
    </>
  );

  return (
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity md:hidden ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      ></div>
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-gray-800 text-white p-4 flex flex-col z-40 transform transition-transform md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
      <div className="hidden md:flex md:flex-col md:w-64 bg-gray-800 text-white h-screen p-4">
        {sidebarContent}
      </div>
    </>
  );
}

export default Sidebar;