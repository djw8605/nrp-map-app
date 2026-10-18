import { formatDay } from '../../lib/wall';

// Swatches are drawn in a 24×12 box and scale with the legend's font size.
function Swatch({ children }) {
  return (
    <svg className="wall-swatch" viewBox="0 0 24 12" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function WallLegend({ wall }) {
  return (
    <div className="wall-legend">
      <span className="wall-legend-item">
        <Swatch>
          <circle cx="4" cy="7" r="2" fill="#5cc8ff" />
          <circle cx="15" cy="6" r="5" fill="#5cc8ff" />
        </Swatch>
        Bigger dot: more GPU work run there
      </span>
      <span className="wall-legend-item">
        <Swatch>
          <path d="M1 9 Q 12 0 23 9" fill="none" stroke="rgba(92, 200, 255, 0.45)" strokeWidth="1.5" />
          <circle cx="15" cy="5.2" r="1.8" fill="#ffffff" />
        </Swatch>
        Moving light: work going from a researcher&apos;s campus to the GPUs that run it
      </span>
      <span className="wall-legend-item">
        <Swatch>
          <circle cx="12" cy="6" r="3" fill="#ffb547" />
          <circle cx="12" cy="6" r="5.3" fill="none" stroke="#ffb547" strokeWidth="1" />
        </Swatch>
        Amber: {wall.home.institution}, where you are
      </span>
      <span className="wall-source">Source: NRP accounting data for {formatDay(wall.day)}</span>
    </div>
  );
}
