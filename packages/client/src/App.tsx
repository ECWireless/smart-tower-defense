import { BrowserRouter as Router } from 'react-router-dom';

import { Toaster } from './components/ui/toaster';
import AppRoutes from './Routes';

export const App = (): JSX.Element => {
  return (
    <Router>
      <AppRoutes />
      <Toaster />
    </Router>
  );
};

export default App;
