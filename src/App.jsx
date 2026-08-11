import SubRotationPlanner from "./components/SubRotationPlanner.jsx";
import AuthGate from "./components/AuthGate.jsx";

function App() {
  return (
    <AuthGate>
      <SubRotationPlanner />
    </AuthGate>
  );
}

export default App;
