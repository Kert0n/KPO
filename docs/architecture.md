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
