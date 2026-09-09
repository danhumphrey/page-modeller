/**
 * CI sets this. A gated check that skips is invisible there, which is the one
 * place every toolchain and browser is guaranteed — so on CI a skip is a
 * failure, and on a contributor's machine it stays a skip.
 */
export const REQUIRE_FULL_SUITE = process.env.PM_REQUIRE_FULL_SUITE === '1';
