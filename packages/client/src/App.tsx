import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./Routes";

export const App = (): JSX.Element => {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
};

export default App;
