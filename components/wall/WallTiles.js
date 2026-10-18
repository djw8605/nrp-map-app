import {
  countOf,
  focusTile,
  formatHours,
  formatLarge,
  formatPercent,
  formatRoughly,
  formatShortDay,
  formatYears,
} from '../../lib/wall';

// "180 billion": the number at full size, the word after it smaller.
function Figure({ text }) {
  const [, number, unit] = /^(\S+) (billion|million)$/.exec(text) || [null, text, null];
  return (
    <p className="wall-tile-value">
      {number}
      {unit && <span className="wall-tile-unit"> {unit}</span>}
    </p>
  );
}

/*
 * One number in plain words. With `month`, the day's figure and the last 30
 * days' sit side by side under their captions; without it (a wall.json from
 * before the 30-day figures) the day's stands alone, as it always did.
 */
function Tile({ kicker, day, month, captions, label, note, home = false }) {
  return (
    <div className={home ? 'wall-tile wall-tile-home' : 'wall-tile'}>
      {kicker && <p className="wall-tile-kicker">{kicker}</p>}
      {month === null ? (
        <Figure text={day} />
      ) : (
        <div className="wall-tile-pair">
          <div>
            <p className="wall-tile-caption">{captions[0]}</p>
            <Figure text={day} />
          </div>
          <div>
            <p className="wall-tile-caption">{captions[1]}</p>
            <Figure text={month} />
          </div>
        </div>
      )}
      <p className="wall-tile-label">{label}</p>
      <p className="wall-tile-note">{note}</p>
    </div>
  );
}

// The five numbers beside the map, in plain words, for the day and the 30 days.
export default function WallTiles({ wall, focus = wall.home.institution }) {
  const { totals } = wall;
  const month = wall.month?.totals || null;
  const both = (format, key) => ({ day: format(totals[key]), month: month ? format(month[key]) : null });
  const captions = [formatShortDay(wall.day), 'Last 30 days'];
  const amber = focusTile(wall, focus);
  const users = month ? month.user_institutions : totals.user_institutions;

  return (
    <div className="wall-tiles">
      <Tile
        captions={captions}
        {...both(formatHours, 'gpu_hours')}
        label={month ? 'GPU hours of work' : 'GPU hours of work in one day'}
        note={month
          ? `30 days is like one graphics card running for ${formatYears(month.gpu_years)}.`
          : `Like one graphics card running nonstop for ${formatYears(totals.gpu_years)}.`}
      />
      <Tile
        captions={captions}
        {...both(formatPercent, 'away_share')}
        label="ran on GPUs at another campus"
        note="Not at the researcher's own school."
      />
      <Tile
        captions={captions}
        {...both((value) => value.toLocaleString('en-US'), 'host_sites')}
        label="campuses and data centers shared their GPUs"
        note={`With researchers from ${countOf(users, 'organization', 'organizations')}${month ? ' over 30 days' : ''}.`}
      />
      <Tile
        captions={captions}
        {...both(formatLarge, 'llm_tokens')}
        label="pieces of text read and written by AI chatbots"
        note={`The same kind of AI as ChatGPT, running on NRP GPUs. About ${formatRoughly((month || totals).llm_novels)} novels' worth${month ? ' over 30 days' : ''}.`}
      />
      <Tile
        home
        captions={captions}
        kicker={amber.kicker}
        day={formatHours(amber.day)}
        month={amber.month === null ? null : formatHours(amber.month)}
        label={amber.label}
        note={amber.note}
      />
    </div>
  );
}
