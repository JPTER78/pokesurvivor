# Binary multiplayer frames, version 1

Based on main `803125dfdf3066fe6cf65f490f1e7b577871a295`.
This change reduces application payload bytes, not message frequency. The
existing reliable, ordered WebRTC data channel and 15 Hz direct update rate
remain. Firebase signaling, start-message fallback, gameplay, pause reconciliation
and saving are unchanged. Neither TURN nor the disabled RTDB gameplay relay is
enabled. No additional service or package is required.

## Compatibility and delivery

Each new data channel starts in JSON mode and sends the JSON capability message
`{"k":"net-cap","binary":1}` on open, before any peer-open gameplay callbacks.
Only receipt of the matching capability enables binary sends to that peer.
Older clients ignore the unknown message kind and continue using JSON. Unknown
versions also retain JSON; reconnecting resets the capability. Since the channel
is ordered, the sender's capability precedes its binary frames at the receiver.

Only `k: "f"` frames are candidates. Each send compares the encoded frame against
its UTF-8 JSON byte count, and uses binary only if smaller. Unsupported values
and packets exceeding the codec limits retain the existing JSON path. Start and
other control messages remain JSON. Mixed peers can coexist in the same room.
No event is deliberately discarded or coalesced, and no delta baseline or
shared string dictionary can become desynchronized.

## Wire format

A packet starts with bytes `0x50 0x53 0x01` (PS, version 1), followed by one value.
Tags: 0 null, 1 false, 2 true, 3 unsigned safe integer, 4 negative magnitude,
5 little-endian float64, 6 positive hundredths, 7 negative hundredths,
8 UTF-8 string, 9 array, 10 object. Tags 32–127 embed integers 0–95;
128–223 embed -1 through -96. Other tags are reserved and rejected.

Integers and lengths use unsigned base-128 varints, bounded to JS safe integers.
Strings have a byte length; arrays/objects have an element/property count.
Object entries are UTF-8 keys followed by values. Hundredths are used only when
reconstruction is exactly equal to the source JS number. Other finite numbers
retain float64 precision, including very large enemy HP. The decoded value always
equals `JSON.parse(JSON.stringify(value))`: -0 is sent as 0, NaN/Infinity as null,
and undefined/functions become null inside arrays and are omitted from objects
(as JSON does), so they no longer force the whole frame back to JSON. Lone UTF-16
surrogates, other unsupported types (BigInt, Date, ...) and cycles still fall back
to JSON on send.

Decode limits: 1 MiB per binary packet, 100,000 values and depth 32. The decoder
rejects truncated/trailing data, unknown versions/tags, bad UTF-8, overlong or
unsafe integers, duplicate keys and impossible lengths. Object keys are defined
as own properties, including `__proto__`. Malformed packets and binary packets
received before negotiation are discarded, counted and never reach Coop.
These limits bound decoding; they do not add gameplay validation to the existing
JSON trust model.

## Reproducible measurement

Run `node tools/bench_net.cjs`. These are synthetic packets based on the actual
`coop.js` schema, not captures of real matches. Host examples include two player
states, 12 damage events, pause/level state and Arceus. Payload size per recipient:

| Example | JSON bytes | Selected bytes | Reduction |
| --- | ---: | ---: | ---: |
| Guest | 111 | 71 | 36.0% |
| Host, 0 enemies | 552 | 370 | 33.0% |
| Host, 30 enemies | 1,361 | 880 | 35.3% |
| Host, 100 enemies | 3,301 | 2,070 | 37.3% |
| Host, 300 enemies | 8,901 | 5,471 | 38.5% |
| Host, 600 enemies | 17,048 | 10,348 | 39.3% |

For the 100-enemy example at 15 Hz, application payload falls from 48.35 to
30.32 KiB/s per recipient. Three recipients multiply the corresponding host
traffic by three. This is not a billable TURN traffic estimate: protocol overhead,
retransmissions, relay usage and changing match states are not included.

The bandwidth saving costs CPU: the send path still builds JSON to guarantee
that binary never increases a frame's size, then also encodes binary. On this
Windows/Node 24 run, encode/select/decode took about 0.15 ms for 100 enemies and
0.56 ms for 600, versus about 0.04/0.22 ms for JSON encode/decode. These are local
microbenchmarks, not browser or mobile performance guarantees. Profile real
matches before claiming lower latency or equivalent battery consumption.

## Observability

`G.Net.stats` in a development build exposes cumulative `sentBytes`, `jsonBytes`
(the equivalent JSON size), `recvBytes`, `binarySent`, `binaryRecv` and
`invalidBinary`, alongside the existing message counters. Payload byte counters
exclude capability messages, signaling, RTDB, SCTP/DTLS/IP/TURN overhead and failed
sends. Values accumulate for the lifetime of the page: take before/after deltas
for a particular match. Savings = `1 - deltaSentBytes / deltaJsonBytes` when the
denominator is nonzero. The normal production build still hides `G`; no debug
endpoint or additional telemetry is introduced.

## Validation

`node --test tests/net.test.cjs` covers lossless frames and numeric extremes,
Unicode, malformed/truncated packets, prototype-safe keys, 500 deterministic
random cases, per-peer negotiation, JSON fallback, reconnects, successful-send
counters, the disabled relay, and frames generated by the real `Coop.tick` for
both host and guest with test world/network doubles.

`node tools/build.js`, `node tools/export_data.js`, and
`python tools/make_seo_pages.py` regenerate the normal protected distribution.
No desktop/browser-control tests were used. Real cross-browser WebRTC sessions,
mobile CPU, NAT traversal and TURN are not validated by these automated tests.
This bandwidth/cost implementation change does not add a player changelog entry.

# Compact enemy rows, coop version 2 (22-10-2026)

Built on top of the binary codec above; the codec itself is unchanged. The enemy
list is most of every host frame (and of everything a TURN-relayed pair sends),
so version 2 changes only how that list and the player-state keys are written.

## Negotiation

Guests add `cv: 2` to every frame they send. The host keeps the last value per
guest and, only for guests with `cv >= 2`, replaces `e` with `e2` and keys `p` by
the player's index in the room (`"0"`..`"3"`, the same `members` order every
client received in `start`) instead of the 28-character uid. Old guests never
send `cv` and keep receiving `e`; old hosts ignore `cv` and keep sending `e`,
which new guests still read. A room can mix versions.

## `e2` layout (`js/net/rows.js`)

One flat array of integers instead of one array per enemy:

    full   id+1,    x,  y, hp, a + 7*dir + 56*status
    short  -(id+1), dx, dy

- Animation, direction and status bits share one number (usually 1 byte; 3 before).
- A short row is sent when hp and that number are unchanged since the last row sent
  to that guest; dx/dy are relative to the last position sent to that guest
  (usually under 96 per axis: 1 byte instead of 3).
- Enemies farther than 640 units from what the guest is watching (outside any
  supported screen: the widest one sees ~520 from its centre) are sent one frame
  in three. Between updates the guest already extrapolates them (`netUpdate`).
- Every 15th frame (1 s at 15 Hz) every enemy is sent as a full row.

## Why the baseline cannot drift

This is the first per-guest delta baseline in the protocol, so its limits:

- The data channel is reliable and ordered, so the guest has applied every row the
  host sent before. The guest's `net.x/y` is exactly the last position received.
- The host's baseline only keeps enemies present in the previous frame (or skipped
  on purpose because they are far). An enemy missing from one frame (left the
  950-unit radius, stashed by a rift or by the Judgment) is forgotten and comes
  back as a full row, after the `ne` event that re-creates it on the guest.
- Rows for enemies the guest does not know are ignored in both formats.
- Even if something unforeseen happened, the 1-second full frame repairs it.

## Measurement

`node tools/bench_coop.cjs` simulates 15 s at 15 Hz with the real codec and
`rows.js`, in three scenarios (all enemies on screen while calm, on screen in heavy
combat, and players apart). Selected wire bytes per host frame and guest:

| Scenario | Enemies | Before | After | Saving |
| --- | ---: | ---: | ---: | ---: |
| Together, calm | 100 | 1,928 | 928 | 51.9% |
| Together, combat | 100 | 1,882 | 1,016 | 46.0% |
| Apart | 100 | 1,959 | 851 | 56.5% |
| Together, calm | 300 | 5,018 | 2,148 | 57.2% |
| Together, combat | 300 | 4,904 | 2,419 | 50.7% |
| Apart | 300 | 5,149 | 1,925 | 62.6% |

Encode + decode time per frame also drops (0.37 → 0.25 ms for 300 enemies in combat
on the same machine), because there are no per-enemy arrays to build or walk.
Same caveats as above: synthetic traffic, not captures or TURN billing.

`node --test tests/rows.test.cjs` checks that after 90 frames of 300 moving,
hit and animated enemies the guest holds exactly the host's state, that far enemies
never skip more than 2 frames in a row, that an enemy missing from a frame returns
as a full row, that malformed arrays stop decoding, and the real `coop.js` with both
old and new guests and hosts.
