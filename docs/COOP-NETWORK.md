# Co-op recovery and protocol v2

Temporary Firebase disconnects update `rooms/{room}/m/{uid}` presence instead of deleting the room or membership. The `.info/connected` listener registers `onDisconnect().update()` before announcing the member online, and rearms it after every reconnect. Explicit leave still removes the room (host) or member (guest). Existing database rules already permit these member writes; no rules deployment is needed.

The room now advertises protocol version 2. Everyone must refresh to the new client before starting a co-op run; the lobby blocks mixed versions. Solo play is unchanged.

## Frame and event ordering

- A unique `session` identifies each run. Frames from another run are ignored.
- Each sender uses a monotonically increasing `seq`. Late snapshots cannot rewind players, enemies or team counters.
- `world` increases when the host enters or leaves a rift. Old-world player positions and combat events cannot affect the new instance.
- Events are `[eventId, world, payload]`, numbered independently for each recipient. Senders retain events until `ack` confirms a contiguous prefix. Receivers apply them once in order, even when a late frame contains a previously missing event.
- Level-up picks carry the level-up round. A delayed pick cannot release a later choice screen.
- Enemy snapshots also contain creation metadata, so a missing local copy can be recreated without depending exclusively on its original spawn event.

Only the host runs the rift exit countdown in co-op. Its `arend` event precedes enemy restoration events in the same reliable stream. Guests clean the arena before restoring world enemies. Teleports update both visible coordinates and remote network targets; entry formation uses the same UID order on every client.

## Availability

The network heartbeat runs on a 250 ms interval as well as during rendered frames. Send cadence and deadlines use `performance.now()`, independent of the simulation's clamped delta, FPS and slow motion. A hidden peer or three seconds without fresh frames pauses simulation. Players have a 30-second grace period to recover. After that, the host removes an unavailable guest and releases any level-up wait; guests end the run if their host cannot recover. Remaining guests also receive the teammate removal. A visible player taking time to pick a card keeps sending heartbeats and is not timed out for taking longer than 30 seconds.

WebRTC failures/disconnections switch sending to Firebase even when the data channel still appears open. A connected open channel can return to direct sending.

Browsers may suspend timers entirely (for example when a device sleeps). Peers then use the silence deadline; the client cannot guarantee background simulation. There is no host migration. Abandoned room records are retained rather than deleted on a transport outage; joining an abandoned lobby is rejected after the host's offline grace period. Long-term removal of orphan room data would require administrative or scheduled server cleanup.

## Validation

Run `node tools/test-coop.cjs` (Node built-ins only). The tests load actual player, enemy, co-op, rift, social and transport modules into isolated VMs. Browser/Firebase boundaries and time are simulated; no production accounts or services are contacted. Coverage includes lost, duplicate and reordered frames/events; cross-run/world isolation; rift cleanup/restoration; silent and hidden peers; level-up recovery; Firebase presence reconnection/leave races; and WebRTC relay recovery.

Before release, also exercise two real browsers with variable latency, a temporary network interruption, a hidden host tab and several rift exits. The VM tests do not replace that integration check.

Deployment uses the existing build commands: `node tools/build.js`, `node tools/export_data.js`, then `python tools/make_seo_pages.py`. Both game entry pages must reference the rebuilt bundle. The unrelated P2 concerns about interpolation, visibility culling and transport backpressure remain separate work.
