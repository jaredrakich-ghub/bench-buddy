// A fresh, cryptographically-random token — shared by every feature that
// needs an unguessable bearer secret in a URL (Match Link's claimToken/
// deviceToken, the Availability link's own share token). Extracted out of
// matchHandover.js (where this was first built) so Availability doesn't
// have to import a token generator from an unrelated feature's module just
// to get one — this is genuinely generic, not Match-Link-specific.
//
// Deliberately does NOT fall back to a weaker PRNG the way id.js's
// generateId() does for a player id: that fallback is fine for a
// collision-resistant id, but wrong for a bearer secret someone could
// otherwise guess. If a secure random source genuinely isn't available,
// failing loudly beats minting a guessable "secret".
//
// Excludes 0/O and 1/I/l — confirmed the hard way during Match Link's own
// build: a token containing capital I and lowercase l is genuinely
// indistinguishable in this app's own fonts, and got mistyped straight off
// a screenshot mid-test. The real share/copy/WhatsApp flow never involves
// anyone typing this by hand, but excluding the ambiguous characters costs
// nothing and closes the class of mistake outright. 57 symbols over 22
// chars is ~128 bits of entropy, essentially unchanged from a full
// 62-symbol alphabet's ~131.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const DEFAULT_TOKEN_LENGTH = 22;

export function generateToken(length = DEFAULT_TOKEN_LENGTH) {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("A secure random source is required to generate a token.");
  }
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let token = "";
  for (let i = 0; i < length; i++) {
    token += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return token;
}
