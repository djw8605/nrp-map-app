// Shared PromQL building blocks for node network throughput.
//
// Two classes of double counting have to be avoided when summing
// node_network_*_bytes_total across a set of Kubernetes nodes:
//
// 1. Stacked / virtual interfaces. A node reports counters for every interface
//    in its netns, and traffic that leaves over a physical NIC is also counted
//    on anything layered on top of (or in front of) it:
//      - VLAN sub-interfaces and aliases (eno1.4020, eth0.100) — the parent NIC
//        already counted those bytes.
//      - CNI veth host-ends. Most on-prem CNIs name these cali*/veth*/lxc*, but
//        the AWS VPC CNI names them eni*, which the old `en.*` allowlist matched.
//        A pod's egress would then be counted on both the veth and the uplink.
//    DEVICE_MATCHER keeps only unstacked physical NIC names: predictable names
//    (eno1, ens1f0, enp129s0f0, enP2p1s0, enx0242ac110002), legacy ethN, and no
//    dotted names. Bridges, bonds, tunnels and the rest are excluded because
//    their bytes are already counted on the enslaved/underlying NIC.
//
// 2. Duplicate series for the same node+device. The same node-exporter target
//    can be scraped by more than one job, exposed on more than one port, or
//    returned once per Prometheus replica when Thanos does not deduplicate.
//    Those series differ only in job/replica/port labels, so a bare sum() adds
//    the same bytes twice. dedupedNodeRate() collapses them with
//    `max by (nodeId, device)` before any summing, which is idempotent no matter
//    how many copies exist.

// Physical, unstacked NIC names only. `eni.*` is excluded so AWS VPC CNI veth
// host-ends are not mistaken for uplinks; there is no systemd predictable-name
// type letter `i`, so no real NIC is lost.
export const DEVICE_MATCHER = 'device=~"en[a-zA-Z0-9]*|eth[0-9]*",device!~"eni.*"';

// PromQL string literals need escaped backslashes, so metacharacters in
// hostnames become "\\." in the query text and "\." at the regex engine.
export function escapePromRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&');
}

// Instance labels may or may not carry a scrape port, so match both and
// normalize to a bare node name in the `nodeId` label.
export function buildInstanceMatcher(nodeNames) {
  const nodeRegex = nodeNames.map(escapePromRegex).join('|');
  return `{instance=~"(${nodeRegex})(:[0-9]+)?",${DEVICE_MATCHER}}`;
}

// Per-node, per-device throughput with duplicate series collapsed. Both the
// per-node and the aggregate views are built from this same expression so the
// aggregate is always exactly the sum of the per-node values.
export function dedupedNodeRate(metric, filter, window = '5m') {
  return `
    max by (nodeId, device) (
      label_replace(
        rate(${metric}${filter}[${window}]),
        "nodeId", "$1", "instance", "([^:]+)(:[0-9]+)?"
      )
    )
  `;
}
