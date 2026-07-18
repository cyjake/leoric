# Benchmarks

Run the model-finalization benchmark with:

```sh
npm run benchmark:model-finalization
```

The benchmark compares a direct, internally marked `Bone` subclass with the public
`Model()` finalization path. Both sides have the same prototype depth. It measures model
construction, row instantiation, native class-field repair, and hot mapped getter/setter
access. Set `ITERATIONS`, `RUNS`, or `WARMUP_RUNS` to override the defaults.

Sample result on Node.js 22.21.1 (Apple Silicon, 100,000 iterations, median of 7 runs):

| Case | Finalized/direct time |
| --- | ---: |
| construct with values | 1.84x |
| instantiate row | 1.06x |
| construct + native fields | 1.73x |
| getter hot path | 1.01x |
| setter hot path | 1.04x |

The finalizer is expected to add work at construction time because it repairs mapped own
fields and restores explicitly supplied values. Getter and setter access after construction
uses normal prototype accessors, with no long-lived `Proxy` trap.
