/*
 * The previous markup carried Bootstrap classes (d-flex, justify-content-between,
 * align-items-center, col-md-12) defined nowhere in this project — inert leftovers
 * from a pre-Tailwind version. Replaced with real utilities.
 *
 * All three props are overridden by pages/osdf-nodes.js, which keeps its own dark
 * treatment and flush top margin.
 */
export default function Footer({
  colorClassName = 'app-footer',
  textClassName = 'text-xs leading-relaxed text-slate-500 dark:text-slate-400',
  wrapperStyle,
}) {
  return (
    <footer className={`mt-8 ${colorClassName}`} style={wrapperStyle}>
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex flex-col items-start gap-4 py-5 sm:flex-row sm:items-center">
          <img
            src="/images/nsf-logo.png"
            alt="National Science Foundation"
            className="h-12 w-auto flex-none"
          />
          <p className={textClassName}>
            This work was supported in part by National Science Foundation (NSF) awards
            CNS-1730158, ACI-1540112, ACI-1541349, OAC-1826967, OAC-2112167, CNS-2100237,
            CNS-2120019.
          </p>
        </div>
      </div>
    </footer>
  );
}
