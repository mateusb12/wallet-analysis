import { useState } from 'react';
import Sidebar, { defaultCalculator } from './features/navbars/Sidebar.jsx';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import TopBar from './features/navbars/Topbar.jsx';

function AppContent() {
  const { session, loading } = useAuth();
  const [ActiveCalculator, setActiveCalculator] = useState(() => defaultCalculator.component);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authView, setAuthView] = useState('login');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    if (authView === 'register') {
      return <Register onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <Login onSwitchToRegister={() => setAuthView('register')} />;
  }

  const handleSelectCalculator = (component) => {
    setActiveCalculator(() => component);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {}
      <Sidebar
        onSelectCalculator={handleSelectCalculator}
        isMobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {}
      <div className="flex-1 flex flex-col min-w-0">
        {}
        <TopBar onMobileMenuOpen={() => setIsMobileMenuOpen(true)} />

        {}
        <div className="flex-1 overflow-auto p-4 md:p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            <ActiveCalculator />
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
