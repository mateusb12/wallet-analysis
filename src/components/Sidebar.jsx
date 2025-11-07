import { useState } from 'react';

function Sidebar({ onSelectCalculator }) {
  const [activeItem, setActiveItem] = useState('compound-interest');

  const menuItems = [
    { id: 'compound-interest', label: 'Compound Interest Calculator', icon: '📊' },
    { id: 'rentability-comparison', label: 'Rentability Comparison (LCI/LCAs vs CDB)', icon: '💰' }
  ];

  const handleItemClick = (itemId) => {
    setActiveItem(itemId);
    onSelectCalculator(itemId);
  };

  return (
    <div className="w-64 bg-gray-800 text-white h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-center">Investment Calculator</h1>
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleItemClick(item.id)}
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
        <p className="text-xs text-gray-400 text-center">© 2024 Investment Tools</p>
      </div>
    </div>
  );
}

export default Sidebar;
