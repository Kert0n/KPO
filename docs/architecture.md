# Architecture

Build-time and browser code depend on `.vitepress/shared`, which must not import
theme components or composables. Compatibility re-exports may remain at old
internal paths while callers migrate, but the implementation has one owner.

Browser features that allocate observers, animation frames or route hooks use
an explicit controller lifecycle. A controller owns everything it allocates
and provides `dispose()`; reinstalling a controller disposes the earlier owner.
Route-hook cleanup restores the preceding hook only while the controller still
owns the router slot, so later integrations are not overwritten.

Adaptive tables follow this rule through `AdaptiveTablesController`:

- `scan()` schedules discovery and layout of current table blocks;
- `disposeDisconnected()` removes controllers for detached route DOM;
- `dispose()` disconnects every observer, cancels scan/layout/verification RAFs
  and restores the previous VitePress route hook.

The controller changes lifecycle ownership only. Table markup, CSS and the
fit/wrap/scroll geometry policy remain separate stable contracts.

Code language and Playground transitions own a viewport-anchor transaction.
The transaction observes the interacted switcher and document geometry,
restores the anchor while it owns scrolling, and releases ownership immediately
after wheel, touch or later keyboard scroll intent. The initiating Home/End
event is explicitly excluded from interruption.

Each Kotlin Playground exposes a ready/failed/disposed settlement signal and
waits for its own ResizeObserver-backed geometry quiet period. Global language
or Playground mode changes use a lifecycle registry of actually pending
initializations; they never discover state through global DOM queries. Unmount
settles the registry entry, invalidates the async generation and destroys any
instance attached after the component became disconnected.
