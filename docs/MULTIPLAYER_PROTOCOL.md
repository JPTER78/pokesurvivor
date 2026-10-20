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
