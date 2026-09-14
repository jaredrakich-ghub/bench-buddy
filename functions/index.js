// Bench Buddy's first Cloud Function: sends the actual email Match Link's
// "Ask for an email first" flow always promised but, until now, never
// delivered. src/lib/matchHandoverIo.js's own submitClaimEmail comment has
// the fuller story — the client-side Firestore write (a pendingClaim with a
// fresh, single-use deviceToken) always worked; nothing ever sent that
// token anywhere. This is that missing piece.
//
// Firestore-triggered rather than called directly from the client:
// submitClaimEmail already writes exactly the condition that means "send an
// email now" (pendingClaim appearing on the handover doc), so this just
// watches for that instead of the client needing a second, separate call
// (and a second way for that call to fail independently of the write it's
// describing).
//
// sendEmail (below) is deliberately small and dependency-free — plain
// fetch against Resend's REST API, no @resend SDK — written to be easy to
// lift into another Firebase project as-is; nothing about it is specific
// to Match Link beyond its one caller below.
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";

const resendApiKey = defineSecret("RESEND_API_KEY");

// The sending address — must be on the domain actually verified in Resend.
// mail.benchbuddysports.com is a SUBDOMAIN (Resend's own recommendation —
// see its docs — is to verify a subdomain, not the root domain), so the
// address has to be @mail.benchbuddysports.com specifically; an address at
// the bare root domain would fail SPF/DKIM (those records were only ever
// added for the subdomain). Update this if that subdomain ever changes.
const FROM_ADDRESS = "Bench Buddy <hello@mail.benchbuddysports.com>";

// A minimal, portable Resend client — just enough to send one email.
// Throws on any non-2xx response so the caller's own error handling
// applies without anything extra here; nothing here is Bench-Buddy-
// specific except the FROM_ADDRESS default.
async function sendEmail({ apiKey, to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

// Watches teams/{teamId}/matchHandover/current for a pendingClaim that's
// new — or changed, since a "Send it again" resubmission (MatchClaimPage.
// jsx) mints a fresh deviceToken every time (matchHandover.js's own top
// comment explains why: a single-use token per email sent, not one shared
// value). Fires on every write to this doc, not just ones that touch
// pendingClaim — Firestore triggers can't filter on which field changed —
// so the deviceToken comparison below is what actually decides whether to
// send; an unrelated settings toggle (stopsAtFullTime, requireEmailClaim)
// is a genuine no-op here, not a duplicate email.
export const sendMatchLinkClaimEmail = onDocumentWritten(
  { document: "teams/{teamId}/matchHandover/current", secrets: [resendApiKey] },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const pendingClaim = after?.pendingClaim;
    if (!pendingClaim) return; // no pending claim right now — nothing to send
    if (before?.pendingClaim?.deviceToken === pendingClaim.deviceToken) return; // already sent for this exact request

    const teamId = event.params.teamId;
    const claimUrl = `https://app.benchbuddysports.com/?team=${encodeURIComponent(teamId)}&t=${encodeURIComponent(pendingClaim.deviceToken)}`;

    try {
      await sendEmail({
        apiKey: resendApiKey.value(),
        to: pendingClaim.email,
        subject: "Your Bench Buddy match link",
        html: `
          <p>Your coach has asked you to help out today.</p>
          <p><a href="${claimUrl}">${claimUrl}</a></p>
          <p>No password, no app to install — just tap the link when you're ready.</p>
        `,
      });
    } catch (err) {
      // Logged, not rethrown — neither MatchLinkScreen nor MatchClaimPage
      // has any way to observe a Cloud Function's own success/failure
      // after the fact (the client-side write this trigger fires from
      // already succeeded by the time this runs), so there's no UI this
      // could usefully surface to either the coach or the parent. "Send
      // it again" on the claim page is the parent's actual recourse for a
      // failure here, same as for any other transient delivery failure.
      logger.error("sendMatchLinkClaimEmail failed", { teamId, error: err.message });
    }
  }
);
