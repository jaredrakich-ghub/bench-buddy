import SubRotationPlanner from "./components/SubRotationPlanner.jsx";
import MatchClaimPage from "./components/MatchClaimPage.jsx";
import AvailabilityClaimPage from "./components/AvailabilityClaimPage.jsx";
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
  // Availability link, Step 4 — a second, sibling query-string route on
  // this same root: ?team=<teamId>&a=<availability token>, distinct param
  // name from Match Link's own &t= so the two can never collide if a URL
  // somehow carried both. Same reasoning as Match Link's own routing
  // comment otherwise (no path, no server config needed).
  const availabilityToken = params.get("a");

  if (claimTeamId && claimToken) {
    return (
      <AuthGate>{(user) => <MatchClaimPage teamId={claimTeamId} token={claimToken} user={user} />}</AuthGate>
    );
  }
  if (claimTeamId && availabilityToken) {
    return (
      <AuthGate>{() => <AvailabilityClaimPage teamId={claimTeamId} token={availabilityToken} />}</AuthGate>
    );
  }

  return <AuthGate>{(user) => <SubRotationPlanner user={user} />}</AuthGate>;
}

export default App;
