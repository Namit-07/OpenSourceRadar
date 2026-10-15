import Link from "next/link";
import AuthButton from "./AuthButton";
import SavedNav from "./SavedNav";

export default function Header() {
  return (
    <header className="topbar">
      <div className="shell topbar-row">
        <Link href="/" className="brand-wrap" aria-label="OpenSource Radar home">
          <span className="brand-eyebrow">Open source marketplace</span>
          <h1 className="brand-title">OpenSource Radar</h1>
        </Link>
        <div className="topbar-actions">
          <SavedNav />
          <a
            href="https://github.com/Namit-07/OpenSourceRadar"
            target="_blank"
            rel="noopener noreferrer"
            className="ghost-link"
          >
            View repository
          </a>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
