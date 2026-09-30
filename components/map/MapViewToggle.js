import { useRef } from 'react';

const OPTIONS = [
  { value: 'contributors', label: 'Contributors' },
  { value: 'usage', label: 'Usage' },
];
const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp'];
const NEXT_KEYS = ['ArrowRight', 'ArrowDown'];

/*
 * Contributors / Usage switch. Top-left, just right of the Mapbox controls:
 * top-centre sits under the right-hand panel at 640–820px map widths.
 *
 * A radio group rather than two buttons, so arrow keys move between the views
 * and a screen reader announces which one is showing.
 */
export default function MapViewToggle({ view, onChange }) {
  const buttonsRef = useRef([]);

  const onKeyDown = (event) => {
    const step = PREVIOUS_KEYS.includes(event.key) ? -1 : NEXT_KEYS.includes(event.key) ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const current = OPTIONS.findIndex((option) => option.value === view);
    const next = (current + step + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[next].value);
    buttonsRef.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Map view"
      onKeyDown={onKeyDown}
      // Inline radius: .map-glass-panel sets its own, and this is a pill.
      style={{ borderRadius: 9999 }}
      className="map-glass-panel absolute left-14 top-3 z-10 flex gap-0.5 p-0.5 text-xs font-medium"
    >
      {OPTIONS.map((option, index) => {
        const checked = option.value === view;
        return (
          <button
            key={option.value}
            ref={(element) => { buttonsRef.current[index] = element; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => { if (!checked) onChange(option.value); }}
            className={`rounded-full px-3 py-1 transition-colors ${
              checked
                ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-slate-950'
                : 'text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-slate-700/70'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
