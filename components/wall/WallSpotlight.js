import { spotlightParts } from '../../lib/wall';

/*
 * One long-distance partnership at a time, under the map. The page rotates
 * `flow`; the key restarts the fade-in (which reduced motion turns off in CSS).
 */
export default function WallSpotlight({ flow, nameFor }) {
  if (!flow) {
    return (
      <p className="wall-spotlight">
        Every moving light is real research work traveling from one campus to another.
      </p>
    );
  }
  const parts = spotlightParts(flow, nameFor);
  return (
    <p className="wall-spotlight" aria-live="polite">
      <span key={`${flow.from}\u0000${flow.to}`} className="wall-fade">
        {parts.map((part, index) => (part.strong ? <strong key={index}>{part.text}</strong> : part.text))}
      </span>
    </p>
  );
}
