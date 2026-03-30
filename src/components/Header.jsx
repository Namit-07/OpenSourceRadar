export default function Header() {
  return (
    <header className="topbar">
      <div className="shell topbar-row">
        <div className="brand-wrap">
          <span className="brand-eyebrow">Open source marketplace</span>
          <h1 className="brand-title">OpenSource Radar</h1>
        </div>
        <div className="topbar-actions">
          <a
            href="https://github.com/Namit-07/OpenSourceRadar"
            target="_blank"
            rel="noopener noreferrer"
            className="ghost-link"
          >
            View repository
          </a>
        </div>
      </div>
    </header>
  );
}
