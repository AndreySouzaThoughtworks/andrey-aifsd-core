# Create a storefront's price rules when a bundle is applied

*Illustrative example on invented platform — services, tickets, domain all fictional. Here to show
template structure. Nothing in it to fact-check.*

*Hard shape: domain rules not plumbing, many ACs, four questions story honest about rather than
asserting. This is a **grooming-stage** specimen, mid-refinement and not Ready: each question here
still has to leave before handover — decided into an AC, recorded as an ADR, or split into its own
ticket. A question that survives to Ready is a story not ready.*

*Technical Notes are signposts. No note repeats the single-write or nothing-written-on-failure rules —
ACs 3, 12 and 13 assert those, and a note that restates an AC is the one the pair stops reading.*

## User Story

As a **Store Owner**
I want the price rules a Bundle needs created on my storefront when I apply it
So that the Bundle works without me configuring rules by hand.

## Background

TKT-14 added price-rule definitions to bundles. Applying bundle has not used them — owner still creates
each rule on storefront by hand.

Applying a bundle to a storefront now creates the price rules its components reference, reusing a rule already there rather than duplicating it.

## Scope

**In:**

* Deciding, per rule reference in applied components, whether to create new rule or use one already on
  storefront
* Rejecting whole apply before anything written when reference cannot be satisfied
* Rewriting component payloads to resolved rule names before anything written
* Writing every price-rule change to storefront draft in one call
* Reporting back, per reference, created or reused and under what name
* Applying only named components' references when caller supplies component filter

**Out:**

* Publishing. Everything this story writes lands on storefront's unpublished draft, so owner sees no
  change to live storefront until they publish.

## Open Questions / Dependencies

* **[QUESTION] Does a declared rule of one numeric type reuse a target of another?** A `number`
  declaration meeting an `integer` rule on storefront either reuses it or fails apply. Until decided,
  reuse defined only for exact type matches, and mismatch AC below covers only clearly different types.
* **[QUESTION] What does a declaration with no default produce?** Either rule created with no default
  value, or one substituted. Nothing currently states which.
* **[QUESTION] Can a declared name exceed the length a price rule allows, and what happens if it does?**
  Names matched exactly and case-sensitively at runtime, so silently truncated name = Bundle that does
  not work.
* **[QUESTION] What happens when another actor changes the draft between our read and our write?** Write
  is full-payload upsert with no version check, so last writer wins and other actor's change lost.
  Whether acceptable, or whether we detect and reject, decides behaviour.

## Acceptance Criteria

### Applying a bundle's price rules — the apply succeeds

| # | **Given** | **When** | **Then** |
| --- | --- | --- | --- |
| 1 | Declared rule not existing on storefront's draft | Bundle applied | Created under declared name, with declared type and default value |
| 2 | Declared rule already on draft, same type | Bundle applied | Nothing created, rule's other properties left as owner set them |
| 3 | Several declared rules, none on draft | Bundle applied | All created in single write, not one per rule |
| 4 | Same rule referenced by more than one component | Bundle applied | One rule created, every referencing payload points at it |
| 5 | Apply that failed after already creating rules on draft | Same bundle applied to same storefront again | Retry reuses what first attempt created, instead of creating second copy or failing on name |
| 6 | Bundle of three components, applied with filter naming one | Bundle applied | Only that component's references resolve; those belonging solely to other two create nothing |
| 7 | Bundle declaring no price rules | Bundle applied | Response reports empty set, not failure |
| 8 | Any valid bundle with price rules | Bundle applied | Everything written to storefront's unpublished draft, live storefront unchanged |
| 9 | Any valid bundle with price rules | Bundle applied | Response reports outcome for every reference |
| 10 | Any valid bundle with price rules | Bundle applied | Component payloads rewritten to resolved rule names |

### Applying a bundle's price rules — the apply fails

| # | **Given** | **When** | **Then** |
| --- | --- | --- | --- |
| 11 | Declared rule on draft with clearly different type — string declared, boolean found | Bundle applied | Apply fails, error names rule, type declared, type found |
| 12 | Three declared rules, two conflicting on type with draft | Bundle applied | Third, non-conflicting rule not created either |
| 13 | Any bundle with reference that cannot be satisfied | Bundle applied | Nothing written to any service |
| 14 | Any bundle with more than one reference that cannot be satisfied | Bundle applied | Every offending reference reported, not stopping at first |

### Applying a bundle's price rules — observability

| # | **Given** | **When** | **Then** |
| --- | --- | --- | --- |
| 15 | Any apply, successful or rejected | Request processed | Structured event records correlation identifier, tenant, storefront, bundle, per-reference outcome, and on failure every violation not just first |

## Technical Notes

* Draft write uses storefront-manager's existing full-payload contract — not new one.
* Dry-run story later becomes mode on this path, so resolution computes intended result whether or
  not caller asks to see it.
* Response is only record of what happened. Nothing stored for caller to read back, so anything owner
  or retry needs must be in it.
* Definitions come from bundle-catalogue, which definitions story exposes. That story and apply
  service both prerequisites.
* Error handling follows existing approach in API.

## References

*Identifiers here carry no link: the platform is invented, so no URL exists. A real story links
every entry — a ticket key to its browse URL, a design page to its page, a decision to its register row.*

* Platform design — resolution rules and error handling this story implements, stated in full above so
  design is provenance not required reading
* TKT-22 — owner-facing console surface, consumes what this story reports
