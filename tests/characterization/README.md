# Stable characterization suite

This directory captures the externally observable behavior of the published
KPO site before architecture refactoring begins. The suite is intentionally
black-box: production code must not be changed to make these checks pass.

Visual baselines are produced and compared only with Linux Chromium. Update
them explicitly after a human comparison with the published site; routine test
runs must never rewrite screenshots.
