import { useState } from 'react';

// 1. Import all your calculator components HERE
import CompoundInterestCalculator from './CompoundInterestCalculator';
import RentabilityComparisonCalculator from './RentabilityComparisonCalculator';
import ReverseImpactCalculator from "./ReverseImpactCalculator.jsx";
import FiiHistoricalChecker from "./FiiHistoricalChecker.jsx";
// --- ADICIONADO ---
import FiiSimulator from "./FiiSimulator.jsx";

// 2. This is now the SINGLE SOURCE OF TRUTH
// We've added a 'component' key to hold the actual component
const menuItems = [
    {
        id: 'fii-historical-checker',
        label: 'Histórico de FIIs (HG Brasil)',
        icon: '🏠',
        component: FiiHistoricalChecker
    },
    // --- ADICIONADO COMO SEGUNDA OPÇÃO ---
    {
        id: 'fii-simulator',
        label: 'Simulador de Investimento (FIIs)',
        icon: '📈',
        component: FiiSimulator
    },
    // ------------------------------------
    {
        id: 'rentability-comparison',
        label: 'Comparação de Rentabilidade (LCI/LCAs vs CDB)',
        icon: '💰',
        component: RentabilityComparisonCalculator
    },
    {
        id: 'reverse-impact',
        label: 'Calculadora de Impacto Reverso',
        icon: '⏱️',
        component: ReverseImpactCalculator
    }
];

// 3. Export the default calculator for App.jsx to use
export const defaultCalculator = menuItems[0];


// 4. The Sidebar component
function Sidebar({ onSelectCalculator }) {
    // Set the initial active item from our default export
    const [activeItem, setActiveItem] = useState(defaultCalculator.id);

    const handleItemClick = (item) => {
        setActiveItem(item.id);
        // 5. Pass the ENTIRE component up to App.jsx, not just a string ID
        onSelectCalculator(() => item.component);
    };

    return (
        <div className="w-64 bg-gray-800 text-white h-screen p-4 flex flex-col">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-center">Calculadora de Investimentos</h1>
            </div>

            <nav className="flex-1">
                <ul className="space-y-2">
                    {menuItems.map((item) => (
                        <li key={item.id}>
                            <button
                                // Pass the whole item object
                                onClick={() => handleItemClick(item)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-colors duration-200 flex items-center space-x-3 ${
                                    activeItem === item.id
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'hover:bg-gray-700'
                                }`}
                            >
                                <span className="text-2xl">{item.icon}</span>
                                <span className="text-sm">{item.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400 text-center">© 2024 Ferramentas de Investimento</p>
            </div>
        </div>
    );
}

export default Sidebar;