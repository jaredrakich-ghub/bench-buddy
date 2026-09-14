import React from "react";
import SubRotationPlanner from "./components/SubRotationPlanner.jsx";
import AuthGate from "./components/AuthGate.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";

// Debt ledger, bundle-size pass — real data (a build with
// vite-bundle-visualizer), not a guess: MatchClaimPage/ParentMatchSession/
// AvailabilityClaimPage (the screens a PARENT sees opening a shared link)
// were padding out the exact same bundle every coach downloads too, even
// though the coach's own normal use of this app — the overwhelming
// majority of real visits — never touches any of them at all. Same
// React.lazy pattern as SubRotationPlanner.jsx's own "Later lane" split
// (see its comment for the fuller reasoning), applied at this file's own
// routing boundary instead — the two are mutually exclusive with the main
// app on every load, so lazy-loading them costs the coach's path nothing.
//
// fallback isn't null here the way that lane's own takeover screens use —
// there's no surrounding shell already on screen to show through while
// this loads (this component's own return IS the whole page), so a blank
// fallback would just be a blank white flash, precisely the kind of thing
// already fixed once this session. LoadingScreen instead — the exact same
// spinner AuthGate already shows while checking the session, so this reads
// as one continuous load, not a new, separate-looking pause.
const MatchClaimPage = React.lazy(() => import("./components/MatchClaimPage.jsx"));
const AvailabilityClaimPage = React.lazy(() => import("./components/AvailabilityClaimPage.jsx"));

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
      <AuthGate>
        {(user) => (
          <React.Suspense fallback={<LoadingScreen message="Loading…" />}>
            <MatchClaimPage teamId={claimTeamId} token={claimToken} user={user} />
          </React.Suspense>
        )}
      </AuthGate>
    );
  }
  if (claimTeamId && availabilityToken) {
    return (
      <AuthGate>
        {() => (
          <React.Suspense fallback={<LoadingScreen message="Loading…" />}>
            <AvailabilityClaimPage teamId={claimTeamId} token={availabilityToken} />
          </React.Suspense>
        )}
      </AuthGate>
    );
  }

  return <AuthGate>{(user) => <SubRotationPlanner user={user} />}</AuthGate>;
}

export default App;
