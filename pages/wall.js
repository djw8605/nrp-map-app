import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import WallLegend from '../components/wall/WallLegend';
import WallMap from '../components/wall/WallMap';
import WallSpotlight from '../components/wall/WallSpotlight';
import WallTiles from '../components/wall/WallTiles';
import { usePrefersReducedMotion } from '../components/wall/usePrefersReducedMotion';
import { useWallData } from '../components/wall/useWallData';
import { canonicalNames, formatDay, spotlightFlows } from '../lib/wall';

// Long enough to read a two-line sentence and watch its comet land (WallMap.js).
const SPOTLIGHT_MS = 11000;

/*
 * NRP Live Wall: a full-screen kiosk page for the big screen in the UNL Holland
 * Computing Center offices. No navbar or footer, sized in viewport units, and
 * written for people who have never heard of the NRP. Data: /api/wall
 * (generate-nodes/generate-wall.js). See
 * docs/superpowers/specs/2026-10-18-nrp-live-wall-design.md and
 * docs/superpowers/specs/2026-10-18-wall-focus-and-30-days-design.md.
 */
export default function WallPage() {
  const { wall, outline, unavailable } = useWallData();
  const reducedMotion = usePrefersReducedMotion();

  const spotlights = useMemo(() => spotlightFlows(wall?.flows, { home: wall?.home?.institution }), [wall]);
  const nameFor = useMemo(() => canonicalNames(wall), [wall]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (spotlights.length < 2) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), SPOTLIGHT_MS);
    return () => clearInterval(timer);
  }, [spotlights]);
  const spotlight = spotlights.length > 0 ? spotlights[tick % spotlights.length] : null;

  // The institution in amber: home until someone picks a dot, and home again if
  // a refresh drops the pick from the map. Picking needs the per-institution
  // figures, which an older wall.json does not have.
  const [picked, setPicked] = useState(null);
  const canPick = Boolean(wall?.institutions);
  const focus = canPick && picked && wall.institutions[picked] ? picked : wall?.home?.institution;

  return (
    <>
      <Head>
        <title>NRP Live Wall</title>
      </Head>
      <main className="wall">
        <header className="wall-header">
          <p className="wall-kicker">
            National Research Platform{wall ? ` · ${formatDay(wall.day)}` : ''}
          </p>
          <h1 className="wall-headline">Every day, scientists share computers across the whole country.</h1>
          <p className="wall-lede">
            GPUs are powerful chips behind AI and science simulations, and the National Research
            Platform lets researchers at one school use GPUs at schools across the country.
          </p>
        </header>

        {unavailable ? (
          <div className="wall-unavailable">
            <p>Live data is unavailable right now.</p>
            <p className="wall-unavailable-note">This screen will try again in a few minutes.</p>
          </div>
        ) : (
          <>
            <WallMap
              wall={wall}
              outline={outline}
              spotlight={spotlight}
              reducedMotion={reducedMotion}
              focus={focus}
              onPick={canPick ? setPicked : null}
            />
            {wall && (
              <>
                <WallSpotlight flow={spotlight} nameFor={nameFor} />
                <WallLegend wall={wall} focus={focus} />
                <WallTiles wall={wall} focus={focus} reducedMotion={reducedMotion} />
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
