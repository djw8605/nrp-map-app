'use client'

/**
 * A lightweight section header for separating dashboard areas.
 *
 * @param {object}  props
 * @param {string}  props.title   – The section title text.
 * @param {string}  [props.className] – Optional extra classes.
 */
export default function SectionHeader({ title, className = '' }) {
  return (
    <h2
      className={`text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${className}`}
    >
      {title}
    </h2>
  );
}
