# Spike: can promotions-manager absorb bundle-apply's write rate at launch volume?

*Illustrative example on invented platform — services, tickets, domain all fictional. Here to show template structure. Nothing to fact-check.*

*Spike shape: one question, the decision waiting on it, an explicit timebox, evidence as the deliverable. Closeout filled at the end.*

## Question

At the launch volume forecast for bundle apply — 40 applies per second, each writing up to 12
components — does promotions-manager hold its write latency within its current budget, or does it
need batching before launch?

## Why it matters

The launch date is fixed. If promotions-manager holds, bundle-apply ships as built and batching stays
out of scope. If it does not, a batch write becomes a dependency on the promotions team and has to be
agreed this quarter, not discovered during the launch ramp.

## Timebox

**Duration or end date:** 3 days from the start of the investigation.

## Context

* Current promotions-manager write budget is 200ms at the 99th percentile, measured at the service
  boundary, and today's peak traffic reaches roughly a tenth of the forecast rate.
* Two shapes to compare: the per-component write bundle-apply performs now, and a single batch write
  per apply.
* Staging shares a database tier with two other services, so measurements taken there carry
  interference the forecast does not.

## Deliverables

- Latency at the 50th, 95th and 99th percentiles for both write shapes, at the forecast rate, with
  the conditions of measurement stated.
- A go/no-go on shipping without batching, with the margin the answer rests on.

## Risks / Assumptions / Dependencies

- Assumes the 40-per-second forecast; the answer does not transfer if the forecast moves materially.
- Needs a load-generation slot on the shared staging tier, which the promotions team schedules.

## References

* [Launch volume forecast](https://example.invalid/docs/launch-forecast) — the source of the 40-per-second figure the whole measurement rests on.
* [TKT-9](https://example.invalid/browse/TKT-9) — the apply path being measured.

---

# Closeout

## Answer / Decision

promotions-manager holds at the forecast rate with the per-component write. Ship without batching,
and keep batching as a follow-up rather than a launch dependency.

## Findings and Evidence

* At 40 applies per second over a 20-minute run, the per-component write measured 41ms at the 50th
  percentile, 110ms at the 95th and 174ms at the 99th.
* That 99th percentile sits inside the 200ms budget, with 13% of margin.
* The batch write measured 12ms at the 50th percentile, 28ms at the 95th and 38ms at the 99th.
* Batching is therefore worth roughly a fourfold headroom improvement if it is ever needed.
* Both runs shared the staging database tier with two other services, whose load was not recorded.
* The numbers may not be representative in either direction, so the 13% is a staging measurement
  rather than production headroom.
* Not measured: sustained load beyond 20 minutes, and the effect of a cold cache after deployment.
  A slow leak on either would not have shown up in these runs.

## Recommendation

Ship as built, and watch the 99th percentile once production traffic reaches the forecast rate.
Raise batching as a Task if the forecast is revised upward, or if the production 99th percentile
passes 150ms — staging could not tell us how much of the 13% survives a different neighbour.

## Produced Artifacts

* [Load-test harness](https://example.invalid/repos/perf-harness/pull/12) — the generator used for
  both runs. It is evidence for this answer; adopting it as a standing performance test is a separate
  decision nobody has taken.
* [Run output](https://example.invalid/reports/spike-throughput) — raw percentiles for both shapes.
