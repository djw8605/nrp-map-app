import { usePace } from './usePace';
import {
  countOf,
  focusTile,
  formatClock,
  formatHours,
  formatLarge,
  formatPercent,
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

/*
 * The AI tile's moving part: the day's novels' worth of text, replayed at that
 * day's average pace against today's clock. The date is in the sentence so the
 * count never reads as "right now"; the changed number brightens briefly.
 */
function NovelPace({ day, novels, reducedMotion }) {
  const { value, now } = usePace(novels, reducedMotion);
  return (
    <>
      {`At ${formatShortDay(day)}'s pace, by ${formatClock(now)}: `}
      <span key={value} className="wall-tick">{value.toLocaleString('en-US')}</span>
      {" novels' worth."}
    </>
  );
}

// The five numbers beside the map, in plain words, for the day and the 30 days.
export default function WallTiles({ wall, focus = wall.home.institution, reducedMotion = false }) {
  const { totals } = wall;
  const month = wall.month?.totals || null;
  const both = (format, key) => ({ day: format(totals[key]), month: month ? format(month[key]) : null });
  const captions = [formatShortDay(wall.day), 'Last 30 days'];
  const amber = focusTile(wall, focus);

  /*
   * Only totals that add up over time get a 30-day column: GPU hours, AI text
   * and the amber tile's hours grow about thirtyfold. A share averages out and
   * a count of campuses barely grows (74% against 77%, 41 against 44), so side
   * by side they read as a repeat; those tiles show the day, as the map does.
   */
  return (
    <div className={month ? 'wall-tiles wall-tiles-paired' : 'wall-tiles'}>
      <Tile
        captions={captions}
        {...both(formatHours, 'gpu_hours')}
        label={month ? 'GPU hours of work' : 'GPU hours of work in one day'}
        note={month
          ? `30 days is like one graphics card running for ${formatYears(month.gpu_years)}.`
          : `Like one graphics card running nonstop for ${formatYears(totals.gpu_years)}.`}
      />
      <Tile
        day={formatPercent(totals.away_share)}
        month={null}
        label="ran on GPUs at another campus"
        note="Not at the researcher's own school."
      />
      <Tile
        day={totals.host_sites.toLocaleString('en-US')}
        month={null}
        label="campuses and data centers shared their GPUs"
        note={month
          ? `${month.host_sites.toLocaleString('en-US')} over the last 30 days, with researchers from ${countOf(month.user_institutions, 'organization', 'organizations')}.`
          : `With researchers from ${countOf(totals.user_institutions, 'organization', 'organizations')}.`}
      />
      <Tile
        captions={captions}
        {...both(formatLarge, 'llm_tokens')}
        label="pieces of text read and written by AI chatbots"
        note={(
          <>
            {'The same kind of AI as ChatGPT, running on NRP GPUs. '}
            <NovelPace day={wall.day} novels={totals.llm_novels} reducedMotion={reducedMotion} />
          </>
        )}
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
