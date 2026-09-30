/*
 * The NRP logo and one-line description that open the map's overview panel.
 * Shared by the contributors and usage views so the two cannot drift apart.
 */
export default function NrpPanelIntro() {
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
          className="block h-12 object-scale-down dark:hidden"
        />
        <img
          src="/images/NRP_LOGO-cropped-dark.png"
          alt="National Research Platform"
          className="hidden h-12 object-scale-down dark:block"
        />
      </a>

      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        A partnership of more than 50 institutions, led by researchers at UC San Diego,
        University of Nebraska&ndash;Lincoln, and Massachusetts Green High Performance
        Computing Center.
      </p>
    </>
  );
}
