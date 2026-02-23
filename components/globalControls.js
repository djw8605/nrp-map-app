'use client'
import { RiTimeLine } from '@remixicon/react';

const TIME_RANGES = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

export default function GlobalControls({ timeRange, setTimeRange, lastUpdated }) {
  return (
    <div className="container mx-auto px-2 sm:px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RiTimeLine className="h-4 w-4 text-tremor-content dark:text-dark-tremor-content" aria-hidden="true" />
          <span className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
            Time Range
          </span>
          <div className="inline-flex rounded-md shadow-sm" role="group" aria-label="Time range selector">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => setTimeRange(range.value)}
                aria-pressed={timeRange === range.value}
                className={`px-3 py-1.5 text-sm font-medium border transition-colors
                  first:rounded-l-md last:rounded-r-md
                  focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${timeRange === range.value
                    ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        {lastUpdated && (
          <span className="text-tremor-label text-tremor-content dark:text-dark-tremor-content">
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
