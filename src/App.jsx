import SubRotationPlanner from "./components/SubRotationPlanner.jsx";
import MatchClaimPage from "./components/MatchClaimPage.jsx";
import AuthGate from "./components/AuthGate.jsx";

// Match Link, Step 4 — the only "routing" this app has: a claim link
// (MatchLinkScreen.jsx's own Share/Copy) is a query string on this exact
// root, ?team=<teamId>&t=<claimToken>, not a path — see that file's own
// comment for why (GitHub Pages needs no extra config for a query string on
// "/", where a real path would need a 404.html SPA-redirect shim). Reading
// window.location.search once here, outside any component, is enough: this
// is a hard page load every time (an emailed/shared link, never an in-app
// navigation), so there's nothing to keep in sync after mount.
//
// Still wrapped in the same AuthGate as the normal app — a parent with no
// Bench Buddy account gets exactly the same anonymous-auth bootstrap a
// first-time coach gets, nothing new to build there.
function App() {
  const params = new URLSearchParams(window.location.search);
  const claimTeamId = params.get("team");
  const claimToken = params.get("t");

  if (claimTeamId && claimToken) {
    return (
      <AuthGate>{(user) => <MatchClaimPage teamId={claimTeamId} token={claimToken} user={user} />}</AuthGate>
    );
  }

  return <AuthGate>{(user) => <SubRotationPlanner user={user} />}</AuthGate>;
}

export default App;
