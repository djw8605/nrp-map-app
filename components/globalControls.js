'use client'
import { RiTimeLine } from '@remixicon/react';

const TIME_RANGES = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

export default function GlobalControls({ timeRange, setTimeRange, lastUpdated }) {
  return (
    <div className="container mx-auto px-2 sm:px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <RiTimeLine className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Time Range
          </span>
          <div
            className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5"
            role="group"
            aria-label="Time range selector"
          >
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => setTimeRange(range.value)}
                aria-pressed={timeRange === range.value}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all duration-200
                  focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${timeRange === range.value
                    ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        {lastUpdated && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
