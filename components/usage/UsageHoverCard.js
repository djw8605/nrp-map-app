/* Region name and institution count; the names themselves are one click away in the panel. */
export default function UsageHoverCard({ name, institutionCount }) {
  return (
    <div className="text-xs">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{name}</p>
      <p className="mt-0.5 text-slate-600 dark:text-slate-300">
        {institutionCount} {institutionCount === 1 ? 'institution' : 'institutions'}
      </p>
    </div>
  );
}
