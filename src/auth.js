import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Scopes requested from the user.
 *
 * `read:user user:email` is read-only public profile data. We deliberately keep
 * this read-only so a leaked token can never write to a contributor's repos.
 */
export const GITHUB_SCOPE = "read:user user:email";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: {
        params: { scope: GITHUB_SCOPE },
      },
    }),
  ],
  session: {
    // No database in this project: the session lives in an encrypted, HttpOnly
    // cookie that Auth.js issues and validates.
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    /**
     * Persist the GitHub access token inside the encrypted JWT only.
     */
    async jwt({ token, account, profile }) {
      if (account) {
        token.githubAccessToken = account.access_token;
        token.githubTokenType = account.token_type ?? "bearer";
        token.githubScope = account.scope ?? GITHUB_SCOPE;
        token.githubTokenExpiresAt = account.expires_at ?? null;
      }

      if (profile) {
        token.githubId = profile.id != null ? String(profile.id) : null;
        token.githubLogin = profile.login ?? null;
      }

      return token;
    },
    /**
     * The client-facing session deliberately excludes `githubAccessToken`:
     * the browser only needs the public profile. Server code reads the token
     * with `getGithubAccessToken()` in `src/lib/session.js`.
     */
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.githubId ?? token.sub ?? null,
          login: token.githubLogin ?? null,
          avatarUrl: session.user?.image ?? null,
        },
        provider: "github",
        scope: token.githubScope ?? null,
        tokenExpiresAt: token.githubTokenExpiresAt ?? null,
      };
    },
  },
});
