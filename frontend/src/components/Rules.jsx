/**
 * The Singapore competition rulebook (SPGG, January 2024), embedded rather than summarised —
 * every evergreen browser renders a PDF natively inside an iframe, so this needs no viewer
 * library. `rules.pdf` is a static asset in `public/`, served at the site root by Vite.
 */
export default function Rules() {
  return (
    <div className="rules-screen">
      <iframe src="/rules.pdf" title="Mahjong rules" />
    </div>
  );
}
