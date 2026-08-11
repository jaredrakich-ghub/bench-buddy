import SubRotationPlanner from "./components/SubRotationPlanner.jsx";
import AuthGate from "./components/AuthGate.jsx";

function App() {
  return <AuthGate>{(user) => <SubRotationPlanner user={user} />}</AuthGate>;
}

export default App;
