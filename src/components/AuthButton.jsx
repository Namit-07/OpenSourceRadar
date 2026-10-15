"use client";

import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import GitHubMark from "./GitHubMark";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="auth-status">Checking account…</span>;
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <button
        type="button"
        className="github-button"
        // The server renders the anonymous state ("Sign up"); the client may
        // already hold a session cookie and render the user chip instead.
        // That divergence is expected — suppress the hydration warning.
        suppressHydrationWarning
        onClick={() => signIn("github", { callbackUrl: window.location.href })}
      >
        <GitHubMark />
        Sign up with GitHub
      </button>
    );
  }

  const { name, login, avatarUrl } = session.user;

  return (
    <div className="auth-user" suppressHydrationWarning>
      {avatarUrl ? (
        <Image
          className="auth-avatar"
          src={avatarUrl}
          alt=""
          width={30}
          height={30}
        />
      ) : null}
      <span className="auth-user-meta">
        <span className="auth-user-name">{name ?? login}</span>
        {login ? <span className="auth-user-handle">@{login}</span> : null}
      </span>
      <button
        type="button"
        className="ghost-link ghost-link--compact"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </button>
    </div>
  );
}
