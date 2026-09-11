// All visual styling for Bench Buddy. Split (real-use feedback: this was
// one 2774-line file, touched in nearly every feature commit) into
// src/components/styles/ by feature area — see that folder's own files
// for the actual style objects. This file just re-exports the same
// `styles`/`tokens`/`colors`/`fontStyle`/`paperTexture` shape as
// before, merged back into one object, so every existing
// `import { styles, tokens } from "./styles.js"` elsewhere in the app
// keeps working completely unchanged — this split touched no import path
// outside this file and styles/ itself.
export { tokens, colors, fontStyle, paperTexture } from "./styles/tokens.js";
import { sharedStyles } from "./styles/shared.js";
import { matchViewStyles } from "./styles/matchView.js";
import { final60Styles } from "./styles/final60.js";
import { setupStyles } from "./styles/setup.js";
import { linksStyles } from "./styles/links.js";
import { accountStyles } from "./styles/account.js";
import { summaryStyles } from "./styles/summary.js";

export const styles = {
  ...sharedStyles,
  ...matchViewStyles,
  ...final60Styles,
  ...setupStyles,
  ...linksStyles,
  ...accountStyles,
  ...summaryStyles,
};
