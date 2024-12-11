import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./Routes";
import { Toaster } from "./components/ui/toaster";

export const App = (): JSX.Element => {
  return (
    <Router>
      <AppRoutes />
      <Toaster />
    </Router>
  );
};

export default App;
