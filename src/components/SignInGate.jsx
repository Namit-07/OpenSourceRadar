"use client";

import { signIn } from "next-auth/react";
import GitHubMark from "./GitHubMark";

export default function SignInGate() {
  return (
    <div className="panel gate-panel">
      <p className="gate-kicker">Members only</p>
      <h3 className="gate-title">Your GitHub handle is your key to the catalog.</h3>
      <p className="gate-copy">
        OpenSource Radar is a private showroom, not a public feed. Signing in points every
        search at your own GitHub account — thirty searches a minute, yours to spend, never
        shared with the crowd.
      </p>
      <p className="gate-copy gate-copy--sub">
        No passwords, no forms, nothing new to remember. Your GitHub account is the entire
        sign-up.
      </p>

      <button
        type="button"
        className="github-button"
        onClick={() => signIn("github", { callbackUrl: window.location.href })}
      >
        <GitHubMark />
        Continue with GitHub
      </button>
    </div>
  );
}
