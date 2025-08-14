import { Dashboard } from './pages/Dashboard';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  // No authentication needed - just show the dashboard
  return (
    <ThemeProvider>
      <Dashboard onLogout={() => {}} />
    </ThemeProvider>
  );
}

export default App;