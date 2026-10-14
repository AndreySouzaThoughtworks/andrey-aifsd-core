# Apply a bundle's promotion to a storefront

*Illustrative example on invented platform — services, tickets, domain all fictional. Here to show template structure. Nothing to fact-check.*

*Thin shape: first cut end to end through three services, wide scope, few rules.*

## User Story

As a **Store Owner**
I want a promotion from a Bundle added to my storefront by the server
So that I do not have to recreate it on my storefront by hand.

## Background

TKT-9 stood up bundle-apply service. Today answers health check, nothing else — no operation of its own
crosses bundle-catalogue, promotions-manager and storefront.

Applying a bundle to a storefront now creates its promotion there, through one call instead of the console's own sequence of writes.

## Scope

**In:**

* Apply operation on bundle-apply service. Takes target storefront + bundle at given version
* Read on bundle-catalogue returning bundle's components at that version, carrying payloads
  needed to write them. Nothing exposes those payloads today
* Writing promotion component to storefront through promotions-manager
* Reporting back what was written
* Carrying one correlation identifier across both outbound calls

**Out:**

* Price rules of any kind. No definitions read, resolved or created — bundle whose promotion
  references price rules is out of scope, not handled-then-ignored.
* Every component type except promotion. Shipping rules and payment methods come later.
* Storefront console calling this operation. Browser keeps sequencing own writes, so store
  owner sees no change.
* Bundles with more than one component. This story applies bundle whose single component is
  promotion.
* Publishing. What written lands on storefront's draft.

## Open Questions / Dependencies

* **[QUESTION] Does applying promotion whose name already exists in tenant succeed or fail?**
  Configuration store checks name uniqueness on create path, scoped to tenant, no storefront
  scoping. Default where namespace has no settings document: enforce it. Whether promotions
  have settings document turning it off is runtime config, held in no repository. One read of
  namespace-settings endpoint settles it. Decides whether story gains success AC or failure one.
* **[DEPENDENCY] Component read this story adds lives in bundle-catalogue, so catalogue team own
  its design.** This story proposes shape, may not settle it. Their agreement needed before any
  build.
* **[DEPENDENCY] Promotion write goes through promotions-manager's public route, carrying store
  owner's token.** Service acts as owner, never as autonomous cross-tenant actor, so internal
  route asserting tenant on service's own word cannot carry this caller. Promotions team own
  route, need to agree it.

## Acceptance Criteria

### Applying a promotion — the apply succeeds

| # | **Given** | **When** | **Then** |
| --- | --- | --- | --- |
| 1 | Bundle with one promotion, and target storefront | Apply operation called | Promotion created on storefront through promotions-manager, appears on storefront's draft |
| 2 | Bundle with one promotion, and target storefront | Apply operation called | Response names component applied and identifier promotions-manager assigned it |
| 3 | Bundle with more than one version, promotion differs between them | Apply called naming older version | Component from that version written, not current one |
| 4 | Any successful apply | Live storefront inspected | Unchanged — what written is on unpublished draft |

### Applying a promotion — the apply fails

| # | **Given** | **When** | **Then** |
| --- | --- | --- | --- |
| 5 | Bundle identifier that does not exist | Apply operation called | Apply rejected as bad input, so caller knows to correct rather than retry |
| 6 | Bundle version that does not exist | Apply operation called | Apply rejected as bad input, naming version not found |
| 7 | bundle-catalogue unavailable or erroring | Apply operation called | Apply fails as upstream failure before anything written, naming call that failed |
| 8 | promotions-manager unavailable or erroring | Apply operation called | Apply fails as upstream failure, naming call that failed, so caller knows retry may succeed |
| 9 | Bundle whose promotion promotions-manager rejects as invalid | Apply operation called | Apply fails reporting rejection and its reason, not success |
| 10 | Bundle whose only component is not promotion | Apply operation called | Apply rejected as unsupported component type — retry will never succeed |
| 11 | Bundle with more than one component | Apply operation called | Apply rejected as unsupported, rather than applying some components and skipping others |
| 12 | Any failed apply | Storefront inspected | Nothing written to it |

### Applying a promotion — permissions

| # | **Given** | **When** | **Then** |
| --- | --- | --- | --- |
| 13 | Apply targeting storefront in caller's own tenant | Apply operation called | Tenant taken from caller's token, both writes made as caller not as service |
| 14 | Apply naming storefront in tenant other than caller's | Apply operation called | Apply rejected as though storefront did not exist, revealing nothing about whether identifier is real |
| 15 | Apply carrying no credentials | Apply operation called | Apply rejected as unauthenticated, nothing written |
| 16 | Apply whose caller authenticated but holds no permission on storefront | Apply operation called | Apply rejected as not permitted, nothing written |

### Applying a promotion — observability

| # | **Given** | **When** | **Then** |
| --- | --- | --- | --- |
| 17 | Any apply, successful or failed | Request processed | Structured event records correlation identifier, tenant, storefront, bundle, outcome |
| 18 | Apply carrying correlation identifier | Request processed | Same value propagated to both outbound calls and returned on response, alongside request identifier unique to this request |
| 19 | Apply carrying no correlation identifier | Request processed | One generated, propagated to both outbound calls, returned on response |

## Technical Notes

* Write uses promotions-manager's existing endpoint.
* Read does not exist — new contract this story adds. Proposed shape, for catalogue team to agree:
  * `GET /bundles/{id}/components`, with `bundle_version` as optional query parameter defaulting
    to current version.
  * Selecting version is query change, no migration behind it.
  * Payloads go on this read, not on bundle detail — that response is discovery contract behind
    bundle detail page, read far more often.
* Component selection arrives on apply call, so it is not property of bundle.
* Apply cannot recognise own previous work. Promotion on storefront carries no reference to
  bundle or component that produced it.
* Error classes fixed by ACs; status codes are proposal for contract review, not something this
  story settles.

To conform with platform API standard:

* Forward caller's identity on outbound calls, not minting service identity.
* Return errors in platform's problem format, carrying machine-readable code ACs name.
* Name version selector as query parameter in snake case.

## References

*Identifiers here carry no link: the platform is invented, so no URL exists. A real story links
every entry — a ticket key to its browse URL, a design page to its page, a decision to its register row.*

* TKT-9 — apply service this extends, and story that left it answering only health check
* CAT-31 — catalogue team's own component read, closest neighbour to read this story adds.
  Not blocker, but shape should be validated with them before building
* Platform design — API inventory behind the two outbound calls this story makes

## Definition of Ready

- [ ] Business value clear
- [ ] Parent epic linked
- [ ] ACs complete, covering expected path, failure, edge case, one observable signal
- [ ] No AC depends on undecided rule
- [ ] Designs linked
- [ ] API contract agreed — and where interface lives in another team's service, agreed with owning team before any build
- [ ] Dependencies known and stated
- [ ] Open Questions / Dependencies empty — every question answered, every dependency agreed
- [ ] Fits single sprint
- [ ] Testable
- [ ] Refined with team

## Definition of Done

**Acceptance**

- [ ] Every AC passes
- [ ] Accepted by requesting stakeholder
- [ ] No critical defects open

**Tests**

- [ ] Unit tests
- [ ] Component tests, for anything newly written or restructured
- [ ] Interface specification validated, if any interface changed
- [ ] Integration tests
- [ ] End-to-end test, if user-facing flow changed
- [ ] Code coverage at or above eighty percent, one hundred percent targeted

**Code and deployment**

- [ ] Reviewed and merged
- [ ] Non-functional requirements covered
- [ ] Observable signal from ACs works in production, not merely enabled in principle
- [ ] Deployed and verified in production

**Communication**

- [ ] Documentation and operational runbooks updated
- [ ] Dependent teams notified, if interface changed
- [ ] Release notes written
- [ ] Sprint demonstration updated
