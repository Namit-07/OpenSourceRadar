"use client";

import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import GitHubMark from "./GitHubMark";
import { clearSavedIssues } from "@/hooks/useSavedIssues";

export default function AuthButton() {
  const { data: session, status } = useSession();

  const handleSignOut = async () => {
    // Saved issues live in localStorage, independent of the GitHub session, so
    // they must be wiped explicitly — otherwise the next person to sign in on
    // this browser would see the previous user's saved issues.
    clearSavedIssues();
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
    return <span className="auth-status">Checking account…</span>;
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <button
        type="button"
        className="github-button"
        onClick={() => signIn("github", { callbackUrl: window.location.href })}
      >
        <GitHubMark />
        Sign up with GitHub
      </button>
    );
  }

  const { name, login, avatarUrl } = session.user;

  return (
    <div className="auth-user">
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
        onClick={handleSignOut}
      >
        Sign out
      </button>
    </div>
  );
}
