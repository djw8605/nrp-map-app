import {
  formatHours,
  formatLarge,
  formatPercent,
  formatRoughly,
  formatYears,
} from '../../lib/wall';

const count = (value, one, many) => `${value.toLocaleString('en-US')} ${value === 1 ? one : many}`;

function Tile({ kicker, value, label, note, home = false }) {
  return (
    <div className={home ? 'wall-tile wall-tile-home' : 'wall-tile'}>
      {kicker && <p className="wall-tile-kicker">{kicker}</p>}
      <p className="wall-tile-value">{value}</p>
      <p className="wall-tile-label">{label}</p>
      <p className="wall-tile-note">{note}</p>
    </div>
  );
}

// The five numbers beside the map, in plain words.
export default function WallTiles({ wall }) {
  const { totals, home } = wall;
  return (
    <div className="wall-tiles">
      <Tile
        value={formatHours(totals.gpu_hours)}
        label="GPU hours of work in one day"
        note={`Like one graphics card running nonstop for ${formatYears(totals.gpu_years)}.`}
      />
      <Tile
        value={formatPercent(totals.away_share)}
        label="ran on GPUs at another campus"
        note="Not at the researcher's own school."
      />
      <Tile
        value={totals.host_sites.toLocaleString('en-US')}
        label="campuses and data centers shared their GPUs"
        note={`With researchers from ${count(totals.user_institutions, 'organization', 'organizations')}.`}
      />
      <Tile
        value={formatLarge(totals.llm_tokens)}
        label="pieces of text read and written by AI"
        note={`Roughly ${formatRoughly(totals.llm_novels)} novels' worth.`}
      />
      <Tile
        home
        kicker={`Here at ${home.institution}`}
        value={formatHours(home.served_hours)}
        label="GPU hours our computers ran for others"
        note={`For researchers at ${count(home.partner_count, 'other organization', 'other organizations')}.`}
      />
    </div>
  );
}
