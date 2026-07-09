# Editorial Rubric For KPO Lectures

This file is an internal review checklist. It is intentionally outside `lectures` and `extras`, so it is not part of
the public VitePress navigation.

## Article Contract

Each lecture should work as a standalone companion article for a student who missed the class.

- The lecture starts from a concrete scenario or course map.
- Major terms are introduced through a problem, not as isolated dictionary entries.
- The article returns to the scenario after important conceptual jumps.
- Reference tables support the story and do not replace explanation.
- Every non-obvious code sample has context, expected behavior, and a reason to exist.
- Runnable Kotlin examples use `kotlin playground`; architectural fragments use `{playground=off}`.
- Language differences use `::: only kotlin/csharp/java/go` when the languages really shape the design differently.
- Mermaid diagrams show a flow, boundary, state machine, transaction boundary, sequence, or decision tree.
- Future concepts get short working definitions and cross-links to the lecture where they are fully explained.
- The ending contains summary, self-check, and mini-practice tied to the scenario.

## Worked Example Contract

At least one substantial section in each lecture should have this shape:

1. `Ситуация` - what the team is trying to build.
2. `Наивное решение` - the simple first attempt.
3. `Что ломается` - the failure mode or cost of change.
4. `Улучшение` - the engineering move.
5. `Почему это работает` - the principle behind the solution.

The point is not to make every section longer. The point is to make the reader see why a design move exists.

## Review Questions

- What concrete change would make this code painful?
- What mistake will a novice likely make here?
- Does the example show behavior or only syntax?
- Does a language-specific block explain a real language difference?
- Can the mini-practice be checked without guessing the author's intent?
