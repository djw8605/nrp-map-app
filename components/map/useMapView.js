import { useCallback } from 'react';
import { useRouter } from 'next/router';

/*
 * Which map is showing, held in the URL so a link or an iframe `src` can choose
 * it: `?view=usage` for the usage map, nothing (or anything else) for
 * contributors. `?toggle=0` hides the switch for single-view embeds.
 */
export function useMapView() {
  const router = useRouter();
  const view = router.query.view === 'usage' ? 'usage' : 'contributors';
  const showToggle = router.query.toggle !== '0';

  const setView = useCallback((next) => {
    const query = { ...router.query };
    if (next === 'usage') query.view = 'usage';
    else delete query.view;
    // replace, never push: inside an iframe a push lands in the HOST page's
    // history, so Back on nrp.ai would step through map toggles.
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  }, [router]);

  return { view, setView, showToggle };
}
