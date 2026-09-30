/*
 * The NRP logo and one-line description that open the map's overview panel.
 * Shared by the contributors and usage views so the two cannot drift apart.
 *
 * `compact` is the logo alone, smaller: the usage view spends that height on its
 * region list, which is the way in to the map.
 */
export default function NrpPanelIntro({ compact = false }) {
  const logoHeight = compact ? 'h-9' : 'h-12';
  return (
    <>
      <a
        href="https://nationalresearchplatform.org"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src="/images/NRP_LOGO-cropped.png"
          alt="National Research Platform"
          className={`block ${logoHeight} object-scale-down dark:hidden`}
        />
        <img
          src="/images/NRP_LOGO-cropped-dark.png"
          alt="National Research Platform"
          className={`hidden ${logoHeight} object-scale-down dark:block`}
        />
      </a>

      {compact ? null : (
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          A partnership of more than 50 institutions, led by researchers at UC San Diego,
          University of Nebraska&ndash;Lincoln, and Massachusetts Green High Performance
          Computing Center.
        </p>
      )}
    </>
  );
}
