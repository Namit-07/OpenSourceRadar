import { getToken } from "next-auth/jwt";

/**
 * Auth.js prefixes the session cookie with `__Secure-` when the app is served
 * over HTTPS, so we try the variant that matches the current environment first.
 */
const COOKIE_VARIANTS =
  process.env.NODE_ENV === "production" ? [true, false] : [false, true];

/**
 * Server-only helper: reads the signed-in user's GitHub access token out of the
 * encrypted Auth.js session cookie.
 *
 * The token intentionally never enters the client-facing session payload, so it
 * cannot be read by browser JavaScript.
 *
 * @param {Request} request - The incoming Route Handler request.
 * @returns {Promise<{accessToken: string, tokenType: string, scope: string|null, login: string|null}|null>}
 */
export async function getGithubAccessToken(request) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    return null;
  }

  for (const secureCookie of COOKIE_VARIANTS) {
    try {
      const token = await getToken({ req: request, secret, secureCookie });

      if (token?.githubAccessToken) {
        return {
          accessToken: token.githubAccessToken,
          tokenType: token.githubTokenType ?? "bearer",
          scope: token.githubScope ?? null,
          login: token.githubLogin ?? null,
        };
      }
    } catch {
      // Wrong cookie variant or an undecryptable token: try the next variant.
    }
  }

  return null;
}
