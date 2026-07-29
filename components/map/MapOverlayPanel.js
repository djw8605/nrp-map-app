import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faXmark, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

/*
 * Below these container dimensions the panel would cover the map rather than sit
 * beside it, so it becomes a collapsed bottom sheet. Measured against the map
 * container, NOT the viewport — /map is embedded in third-party iframes whose
 * height we do not control.
 */
const COMPACT_MAX_HEIGHT = 420;
const COMPACT_MAX_WIDTH = 640;

/**
 * Floating glass panel over the map canvas.
 *
 * The outer wrapper is click-through so map panning still works everywhere the
 * panel itself is not.
 */
export default function MapOverlayPanel({
  position = 'right',
  title,
  subtitle,
  // Rendered in place of title/subtitle. The site variant passes its site picker
  // here so the panel has exactly one place showing which site is open.
  titleNode,
  onClose,
  onBack,
  backLabel = 'Back to overview',
  children,
}) {
  const panelRef = useRef(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  /*
   * Observe the positioned ancestor (the map container) rather than the window so
   * this behaves correctly inside a short iframe.
   */
  useEffect(() => {
    const panel = panelRef.current;
    const container = panel?.offsetParent;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    const measure = () => {
      const compact =
        container.clientHeight < COMPACT_MAX_HEIGHT || container.clientWidth < COMPACT_MAX_WIDTH;
      setIsCompact((previous) => (previous === compact ? previous : compact));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Collapse by default once compact; expand again when there is room.
  useEffect(() => {
    setIsExpanded(!isCompact);
  }, [isCompact]);

  const toggleExpanded = useCallback(() => setIsExpanded((value) => !value), []);

  const placement = isCompact
    ? 'inset-x-2 bottom-2 max-h-[85%]'
    : `top-3 bottom-3 w-[360px] ${position === 'left' ? 'left-3' : 'right-3'}`;

  /*
   * The overview variant has no title/back/close, so skip the header row entirely
   * rather than leaving an empty band above the content. The collapse toggle is
   * the one control that must survive, so it still forces a header when compact.
   */
  const hasHeader = Boolean(title || subtitle || titleNode || onBack || onClose || isCompact);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        ref={panelRef}
        className={`map-glass-panel pointer-events-auto absolute flex flex-col overflow-hidden ${placement}`}
      >
        {hasHeader ? (
        <div
          className={`flex flex-shrink-0 gap-2 px-4 py-3 ${
            titleNode ? 'items-center' : 'items-start'
          }`}
        >
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              title={backLabel}
              aria-label={backLabel}
              className={`map-glass-panel__btn ${titleNode ? '' : 'mt-0.5'}`}
            >
              <FontAwesomeIcon icon={faArrowLeft} className="h-3.5 w-3.5" />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            {titleNode ?? (
              <>
                {title ? (
                  <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {title}
                  </h2>
                ) : null}
                {subtitle ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {subtitle}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {isCompact ? (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
              className="map-glass-panel__btn"
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronUp}
                className="h-3.5 w-3.5"
              />
            </button>
          ) : null}

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close panel"
              className="map-glass-panel__btn"
            >
              <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        ) : null}

        {isExpanded ? (
          <div
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 ${hasHeader ? '' : 'pt-4'}`}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
