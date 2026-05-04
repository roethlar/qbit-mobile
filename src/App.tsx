import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';

type CurrentPage = 'dashboard' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<CurrentPage>('dashboard');

  const showDashboard = () => setCurrentPage('dashboard');
  const showSettings = () => setCurrentPage('settings');

  return (
    <ErrorBoundary>
      <ThemeProvider>
        {currentPage === 'dashboard' && (
          <Dashboard onShowSettings={showSettings} />
        )}
        {currentPage === 'settings' && (
          <Settings onBack={showDashboard} />
        )}
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;