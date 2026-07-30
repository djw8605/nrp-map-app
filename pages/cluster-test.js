'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import { Badge, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@tremor/react';
import { RiCheckLine, RiCloseLine } from '@remixicon/react';

import NavBar from '../components/navbar';
import Footer from '../components/footer';
import NodeMap from '../components/nodeMap';
import MapOverlayPanel from '../components/map/MapOverlayPanel';
import { MapSiteContent } from '../components/map/MapPanelContent';
import SiteHoverCard from '../components/map/SiteHoverCard';
import SitePinMarker from '../components/map/SitePinMarker';
import { useSiteDrillIn } from '../components/map/useSiteDrillIn';
import { fetcher } from '../lib/fetcher';
import { FIXTURE_SITES } from '../lib/siteClusters.fixture';
import { clusterChecksSummary, runClusterChecks } from '../lib/siteClusters.checks';
import {
  DEFAULT_CLUSTER_RADIUS_KM,
  clusterRadiusForZoom,
  clusterSites,
  describeMembers,
  findGroupForSite,
  siteHasOsdfCache,
  summarizeGrouping,
  summarizeSites,
} from '../lib/siteClusters';

/*
 * Preview harness for merging nearby sites into one pin.
 *
 * Not linked from the navigation — it exists so the behaviour can be inspected in
 * isolation from the live pages, which pass a fixed clusterRadiusKm and have no
 * way to vary it. Three things are on the page:
 *
 *  1. the real map, with the real overlay panel, at a radius you can drag;
 *  2. the panel and hover card rendered *outside* the map as well. Mapbox needs
 *     NEXT_PUBLIC_MAPBOX_TOKEN and a network it can reach, and the whole question
 *     being reviewed here is "does a merged site still have an identity in the
 *     panel and the popup" — that has to be answerable without a live basemap;
 *  3. lib/siteClusters.checks run live, so a reviewer can see the geometry is
 *     right rather than taking the screenshots on faith.
 *
 * Everything reuses the components the live pages use. No parallel styling: if a
 * surface here looks different from the map, that is a bug in this page.
 */

const SECTION_LABEL_CLASS =
  'text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

const CONTROL_LABEL_CLASS = 'text-sm text-slate-500 dark:text-slate-400 block mb-1.5';

const formatDistance = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

/*
 * Zooms worth reporting: the overview default, the band where groups start coming
 * apart, and SITE_ZOOM from useSiteDrillIn — the one a pin click flies to, and the
 * reason the radius has to shrink at all.
 */
const ZOOM_SAMPLES = [3, 9, 11, 12, 13, 14, 16.5];

/** Segmented control, styled off the panel's own inputs rather than a new look. */
function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-lg border-[1px] border-solid border-slate-300 dark:border-slate-600"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={[
              'px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </p>
      {hint ? <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}

/*
 * Stand-in for MapOverlayPanel. That component positions itself `absolute inset-0`
 * against the map container and measures its offsetParent to decide whether to
 * become a bottom sheet, neither of which makes sense in page flow — so this
 * mirrors its chrome (same glass class, same 360px, same header padding) and
 * nothing else.
 */
function PanelPreview({ title, subtitle, children }) {
  return (
    <div className="map-glass-panel flex w-[360px] max-w-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-start gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </div>
  );
}

export default function ClusterTestPage() {
  const mapRef = useRef(null);

  const [dataSource, setDataSource] = useState('fixture');
  const [mergeEnabled, setMergeEnabled] = useState(true);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_CLUSTER_RADIUS_KM);
  const [previewGroupId, setPreviewGroupId] = useState(null);
  const [previewMemberId, setPreviewMemberId] = useState(null);
  const [previewMetrics, setPreviewMetrics] = useState(false);

  const isLive = dataSource === 'live';
  const effectiveRadiusKm = mergeEnabled ? radiusKm : 0;

  const { data: liveNodes, error: liveError, isLoading: liveLoading } = useSWR(
    isLive ? '/api/nodes' : null,
    fetcher,
  );

  /*
   * Memoised because NodeMap keys its pins off the group objects it derives from
   * this array. A fresh array every render would rebuild every group and replay
   * every pin's entrance animation on each keystroke of the radius slider.
   */
  const sites = useMemo(() => {
    if (!isLive) return FIXTURE_SITES;
    return liveNodes ? Object.values(liveNodes) : [];
  }, [isLive, liveNodes]);

  // The same call NodeMap makes internally. Pure and cheap, and computing it here
  // too is what lets this page talk about the grouping without reaching inside the
  // map component for it.
  const groups = useMemo(
    () => clusterSites(sites, { radiusKm: effectiveRadiusKm }),
    [sites, effectiveRadiusKm],
  );

  const grouping = useMemo(() => summarizeGrouping(groups), [groups]);
  const mergedGroups = useMemo(
    () =>
      groups
        .filter((group) => group.memberCount > 1)
        .sort((a, b) => b.memberCount - a.memberCount || b.spanKm - a.spanKm),
    [groups],
  );

  const checks = useMemo(() => runClusterChecks(), []);
  const checkSummary = useMemo(() => clusterChecksSummary(checks), [checks]);

  /*
   * What the map does as you zoom, without needing the map. NodeMap derives its
   * working radius from the camera, so the pin count is a function of zoom — this
   * runs the same clusterRadiusForZoom -> clusterSites chain at a few zooms so the
   * declustering can be read off the page with no basemap.
   *
   * Latitude changes the size of a Mercator pixel, so this uses the data's own mean
   * rather than a hardcoded one.
   */
  const meanLatitude = useMemo(() => {
    const values = sites.map((site) => Number(site.latitude)).filter(Number.isFinite);
    if (values.length === 0) return 0;
    return values.reduce((total, value) => total + value, 0) / values.length;
  }, [sites]);

  const zoomBreakdown = useMemo(
    () =>
      ZOOM_SAMPLES.map((zoom) => {
        const workingRadiusKm = clusterRadiusForZoom(effectiveRadiusKm, zoom, meanLatitude);
        return {
          zoom,
          workingRadiusKm,
          ...summarizeGrouping(clusterSites(sites, { radiusKm: workingRadiusKm })),
        };
      }),
    [sites, effectiveRadiusKm, meanLatitude],
  );

  // ---- Live map + panel ----

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [focusedSiteId, setFocusedSiteId] = useState(null);

  const { isSiteMode, enterSite, exitToOverview } = useSiteDrillIn(mapRef, {
    onExitSite: () => {
      setSelectedGroup(null);
      setFocusedSiteId(null);
    },
  });

  // NodeMap hands back a *group*; the page tracks which member inside it the panel
  // is pointed at, so the header and the metric cards can never disagree.
  const handleSelectFromMap = useCallback((group) => {
    setSelectedGroup(group);
    setFocusedSiteId(group?.members?.[0]?.id ?? null);
  }, []);

  /*
   * Re-resolve the open pin whenever the grouping changes underneath it (radius
   * slider, data source). Following the focused *site* rather than the group id
   * keeps the panel open across a regroup instead of slamming shut.
   */
  useEffect(() => {
    if (focusedSiteId == null) return;
    setSelectedGroup(findGroupForSite(groups, focusedSiteId));
  }, [groups, focusedSiteId]);

  /*
   * Reached from a member row in the panel and from a pin the zoom split out of the
   * open group (NodeMap calls onEnterSite without changing the selection in that
   * case, so this is what keeps the panel's highlighted row on the site the camera
   * actually flew to). Members can be up to the radius apart, which is well off
   * screen at street-level zoom, so the camera always follows.
   */
  const handleFocusMember = useCallback(
    (member) => {
      const target = member?.primarySite ?? member;
      if (!target) return;
      setFocusedSiteId(target.id);
      enterSite(target);
    },
    [enterSite],
  );

  // ---- Token-free preview ----

  const previewOptions = useMemo(() => {
    const singleton = groups.find((group) => group.memberCount === 1);
    return [...mergedGroups.slice(0, 4), ...(singleton ? [singleton] : [])];
  }, [mergedGroups, groups]);

  const previewGroup =
    previewOptions.find((group) => String(group.id) === String(previewGroupId)) ||
    previewOptions[0] ||
    null;

  const previewMember =
    previewGroup?.members.find((member) => String(member.id) === String(previewMemberId)) ||
    previewGroup?.members[0] ||
    null;

  const previewSubtitle = previewGroup
    ? previewGroup.memberCount > 1
      ? `${previewGroup.memberCount} sites merged · within ${formatDistance(previewGroup.spanKm)}`
      : previewGroup.siteName || 'Single site'
    : '';

  const panelSubtitle = selectedGroup
    ? selectedGroup.memberCount > 1
      ? `${selectedGroup.memberCount} sites merged · within ${formatDistance(selectedGroup.spanKm)}`
      : selectedGroup.siteName || 'Single site'
    : '';

  return (
    <>
      <Head>
        <title>Nearby-site merging — preview | National Research Platform</title>
        <meta name="robots" content="noindex" />
      </Head>
      <NavBar />

      <section className="mt-4">
        <div className="container mx-auto px-2 sm:px-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Merging nearby sites
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Sites registered within a couple of kilometres of each other draw pins on top of one
            another, so only the last one painted is clickable. Below, those sites share a single
            pin carrying a count, while every site behind it keeps its name, its own node and GPU
            counts, and its own live metrics — listed in the panel and in the hover card rather
            than folded away. The radius is a ceiling that shrinks with the zoom, so a group is
            back to individual pins once they no longer overlap on screen.
          </p>
        </div>
      </section>

      <section className="mt-4">
        <div className="container mx-auto px-2 sm:px-0">
          <Card className="rounded-xl p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <span className={CONTROL_LABEL_CLASS}>Sites</span>
                <SegmentedControl
                  ariaLabel="Data source"
                  value={dataSource}
                  onChange={setDataSource}
                  options={[
                    { value: 'fixture', label: 'Fixture' },
                    { value: 'live', label: 'Live /api/nodes' },
                  ]}
                />
              </div>

              <div>
                <span className={CONTROL_LABEL_CLASS}>Merging</span>
                <SegmentedControl
                  ariaLabel="Merging"
                  value={mergeEnabled ? 'on' : 'off'}
                  onChange={(value) => setMergeEnabled(value === 'on')}
                  options={[
                    { value: 'off', label: 'Off (today)' },
                    { value: 'on', label: 'On' },
                  ]}
                />
              </div>

              <div className="min-w-[15rem] flex-1">
                <label htmlFor="radius" className={CONTROL_LABEL_CLASS}>
                  Merge radius ceiling —{' '}
                  <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {radiusKm.toFixed(2)} km
                  </span>
                </label>
                <input
                  id="radius"
                  type="range"
                  min="0.25"
                  max="5"
                  step="0.25"
                  value={radiusKm}
                  disabled={!mergeEnabled}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                  className="w-full accent-blue-600 disabled:opacity-40 dark:accent-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile label="Sites" value={grouping.siteCount} hint="registered" />
              <StatTile
                label="Pins"
                value={grouping.pinCount}
                hint={`${grouping.siteCount - grouping.pinCount} fewer`}
              />
              <StatTile label="Merged pins" value={grouping.mergedGroupCount} hint="2+ sites" />
              <StatTile
                label="Sites merged"
                value={grouping.mergedSiteCount}
                hint={
                  grouping.siteCount
                    ? `${Math.round((grouping.mergedSiteCount / grouping.siteCount) * 100)}% of sites`
                    : '—'
                }
              />
              <StatTile
                label="Widest group"
                value={grouping.maxSpanKm ? formatDistance(grouping.maxSpanKm) : '—'}
                hint="leader to furthest"
              />
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                As the camera zooms in
              </p>
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-2">
                  {zoomBreakdown.map((row) => {
                    // SITE_ZOOM: where clicking a pin lands, and the case the fix is for.
                    const isDrillIn = row.zoom === 16.5;
                    return (
                      <div
                        key={row.zoom}
                        className={[
                          'min-w-[7.5rem] rounded-xl px-3 py-2',
                          isDrillIn
                            ? 'bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:ring-blue-500/30'
                            : 'bg-slate-50 dark:bg-slate-800/60',
                        ].join(' ')}
                      >
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          zoom {row.zoom}
                          {isDrillIn ? ' · drill-in' : ''}
                        </p>
                        <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                          {row.pinCount} pins
                        </p>
                        <p className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          {row.workingRadiusKm > 0 ? formatDistance(row.workingRadiusKm) : 'no merge'}
                          {row.mergedGroupCount > 0 ? ` · ${row.mergedGroupCount} merged` : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {isLive && liveError ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                Could not load /api/nodes: {liveError.message}. Switch back to Fixture to review the
                layout.
              </p>
            ) : null}
            {isLive && liveLoading ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading live sites…</p>
            ) : null}
          </Card>
        </div>
      </section>

      <section className="mt-4">
        <div className="container mx-auto px-2 sm:px-0">
          <h2 className={SECTION_LABEL_CLASS}>On the map</h2>
          <p className="mb-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
            Click a pin to open the panel; inside a merged pin, pick a site from{' '}
            <em>Sites at this location</em> to point the metric cards at it. The slider sets a{' '}
            <em>ceiling</em> — zooming in shrinks the working radius, so groups come apart into
            their own pins (furthest member first) and are fully separate by the time the drill-in
            lands. Needs NEXT_PUBLIC_MAPBOX_TOKEN.
          </p>
          <div className="relative h-[22em] overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900 md:h-[38em]">
            {sites.length > 0 ? (
              <NodeMap
                mapRef={mapRef}
                sites={sites}
                clusterRadiusKm={effectiveRadiusKm}
                setSelectedSite={handleSelectFromMap}
                selectedSite={selectedGroup}
                isSiteMode={isSiteMode}
                onEnterSite={handleFocusMember}
                focusedSiteId={focusedSiteId}
                onExitOverview={exitToOverview}
                showExpandLink={false}
              >
                {selectedGroup ? (
                  <MapOverlayPanel
                    position="right"
                    title={selectedGroup.name}
                    subtitle={panelSubtitle}
                    onBack={exitToOverview}
                  >
                    <MapSiteContent
                      site={selectedGroup}
                      focusedSiteId={focusedSiteId}
                      onFocusSite={handleFocusMember}
                      // Fixture slugs are not in Thanos, so every metric card would
                      // render its error state and drown out the layout.
                      showMetrics={isLive}
                    />
                  </MapOverlayPanel>
                ) : null}
              </NodeMap>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No sites to draw.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="container mx-auto px-2 sm:px-0">
          <h2 className={SECTION_LABEL_CLASS}>Panel and popup, without the basemap</h2>
          <p className="mb-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
            The same components the map renders, on the same glass surface, so the identity of each
            merged site can be reviewed with or without a Mapbox token.
          </p>

          {previewOptions.length > 0 ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {previewOptions.map((group) => {
                  const isActive = String(group.id) === String(previewGroup?.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setPreviewGroupId(group.id);
                        setPreviewMemberId(null);
                      }}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white dark:bg-blue-500'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600',
                      ].join(' ')}
                    >
                      {group.name}
                      <span className="ml-1.5 opacity-70 tabular-nums">
                        {group.memberCount === 1 ? '1 site' : `${group.memberCount} sites`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/*
                * A tinted backdrop, not decoration: .map-glass-panel is translucent
                * with a backdrop blur, so on the flat page surface it renders almost
                * white and none of the contrast a reviewer needs to judge is visible.
                */}
              <div className="rounded-xl bg-gradient-to-br from-sky-200 via-slate-300 to-emerald-200 p-5 dark:from-sky-950 dark:via-slate-800 dark:to-emerald-950">
                <div className="flex flex-wrap items-start gap-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Hover card
                    </p>
                    {/* .nrp-hover-popup targets Mapbox's own content div, which does
                        not exist here, so the padding it sets is applied inline. */}
                    <div className="map-glass-panel inline-block px-3 py-2.5">
                      <SiteHoverCard site={previewGroup} />
                    </div>

                    <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Pin
                    </p>
                    <div className="map-glass-panel inline-flex items-end gap-4 px-4 py-3">
                      {previewOptions.map((group) => (
                        <span key={group.id} className="flex flex-col items-center gap-1.5">
                          <SitePinMarker
                            size={30}
                            count={group.memberCount}
                            isOsdfCache={siteHasOsdfCache(group)}
                            interactive={false}
                          />
                          <span className="text-[0.6875rem] tabular-nums text-slate-600 dark:text-slate-300">
                            {group.memberCount === 1 ? '1 site' : `${group.memberCount} sites`}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-baseline gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        Side panel
                      </p>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={previewMetrics && isLive}
                          disabled={!isLive}
                          onChange={(event) => setPreviewMetrics(event.target.checked)}
                          className="rounded accent-blue-600 disabled:opacity-40 dark:accent-blue-500"
                        />
                        live metric cards
                        {!isLive ? <span className="opacity-60">(live sites only)</span> : null}
                      </label>
                    </div>
                    <PanelPreview title={previewGroup?.name} subtitle={previewSubtitle}>
                      <MapSiteContent
                        site={previewGroup}
                        focusedSiteId={previewMember?.id}
                        onFocusSite={(member) => setPreviewMemberId(member.id)}
                        showMetrics={previewMetrics && isLive}
                      />
                    </PanelPreview>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Card className="rounded-xl p-4 text-sm text-slate-500 shadow-sm dark:text-slate-400">
              Nothing to preview at this radius.
            </Card>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="container mx-auto px-2 sm:px-0">
          <h2 className={SECTION_LABEL_CLASS}>
            Merged pins at {formatDistance(effectiveRadiusKm || 0)}
          </h2>
          <Card className="mt-2 overflow-hidden rounded-xl p-0 shadow-sm">
            {mergedGroups.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
                {mergeEnabled
                  ? 'No two sites are within this radius.'
                  : 'Merging is off — every site draws its own pin, exactly as today.'}
              </p>
            ) : (
              <Table>
                <TableHead>
                  <TableRow className="border-b border-slate-200 dark:border-slate-700">
                    <TableHeaderCell className="bg-transparent">Pin label</TableHeaderCell>
                    <TableHeaderCell className="bg-transparent text-right">Sites</TableHeaderCell>
                    <TableHeaderCell className="bg-transparent text-right">Span</TableHeaderCell>
                    <TableHeaderCell className="bg-transparent text-right">Nodes</TableHeaderCell>
                    <TableHeaderCell className="bg-transparent text-right">GPUs</TableHeaderCell>
                    <TableHeaderCell className="bg-transparent">Sites behind the pin</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mergedGroups.map((group) => {
                    const { nodeCount, gpuCount } = summarizeSites([group]);
                    return (
                      <TableRow key={group.id}>
                        <TableCell className="py-2 font-medium">{group.name}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">
                          {group.memberCount}
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums">
                          {formatDistance(group.spanKm)}
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{nodeCount}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{gpuCount}</TableCell>
                        <TableCell className="py-2">
                          <span className="flex flex-wrap gap-1">
                            {/* Same labelling rule as the panel and the hover card,
                                so the UNL pair is two distinguishable rows here
                                rather than the region name printed twice. */}
                            {describeMembers(group.members).map(({ site, label }) => (
                              <Badge key={site.id} size="xs" color="slate">
                                {label}
                              </Badge>
                            ))}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </section>

      <section className="mt-6 mb-8">
        <div className="container mx-auto px-2 sm:px-0">
          <div className="flex items-baseline gap-3">
            <h2 className={SECTION_LABEL_CLASS}>Clustering checks</h2>
            <Badge size="xs" color={checkSummary.failed === 0 ? 'green' : 'red'}>
              {checkSummary.passed}/{checkSummary.total} passing
            </Badge>
          </div>
          <p className="mb-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
            lib/siteClusters.checks.js, run in the browser against the fixture. These assert the
            geometry and the labelling, independent of whatever the slider is set to above.
          </p>

          <Card className="overflow-hidden rounded-xl p-0 shadow-sm">
            <ul className="list-none divide-y divide-slate-200 dark:divide-slate-700">
              {checks.map((check) => (
                <li key={check.name} className="flex items-start gap-3 px-4 py-2.5">
                  <span
                    className={[
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      check.pass
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
                    ].join(' ')}
                  >
                    {check.pass ? (
                      <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span className="sr-only">{check.pass ? 'Passing' : 'Failing'}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-900 dark:text-slate-100">
                      {check.name}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {check.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <Footer />
    </>
  );
}
