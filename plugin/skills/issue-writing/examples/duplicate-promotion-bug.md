# Applying a bundle twice creates a second promotion instead of reusing the first

*Illustrative example on invented platform — services, tickets, domain all fictional. Here to show template structure. Nothing to fact-check.*

*Bug shape: impact, expected result, actual result, reproduction, environment and context.*

## Impact summary

Store owners who re-run an apply — after a partial failure, or to pick up a bundle's new version —
end up with two promotions of the same name on the storefront draft, and the console offers no way
to tell them apart. Seen on every repeat apply in staging, so the rate is one duplicate per repeat
rather than an intermittent fraction. Nothing published yet, so no shopper has been charged twice;
that stays possible rather than observed until the draft goes live.

## Expected Result

The second apply reuses the promotion the first one created. TKT-9 settled reuse over duplication as
the rule for applying a bundle, and the price-rule path added in TKT-14 already behaves this way.

## Actual Result

The second apply returns `201 Created` with a new promotion id, and the storefront draft then lists
two promotions carrying the same name and the same discount.

## Steps to Reproduce

1. Apply a bundle with a single promotion component to an empty storefront draft.
2. Apply the same bundle, at the same version, to the same draft again.
3. Read the draft's promotions.

## Environment

Staging and local, on bundle-apply 2.4.0 and on `main`.

## Context

Independent of tenant and of bundle version. The promotions-manager write is a plain create; the
reuse lookup that the price-rule path performs has no equivalent on the promotion path, which is a
hypothesis about the cause, not an observation.

## Open Questions / Dependencies

* **[QUESTION] Does reuse match on promotion name, or on the component id that produced it?** The
  price-rule path matches on component id; whether promotions follow it decides whether a renamed
  promotion is the same promotion.

## References

* [TKT-9](https://example.invalid/browse/TKT-9) — where reuse over duplication was decided, which is
  the contract this breaks.
* [TKT-14](https://example.invalid/browse/TKT-14) — the price-rule reuse behaviour the promotion path
  is expected to match.
