# Retire the v1 configuration client from bundle-apply

*Illustrative example on invented platform — services, tickets, domain all fictional. Here to show template structure. Nothing to fact-check.*

*Task shape: a result with no user in it, and completion stated as labelled criteria.*

## Description

bundle-apply still reads tenant configuration through the v1 configuration client. The platform team
removes v1 at the end of the quarter, after which the service will not start. Every other service in
the delivery path moved in TKT-71; bundle-apply was skipped because it was still being stood up.

## Open Questions / Dependencies

* **[DEPENDENCY] The v2 client's tenant-scoped read is behind the platform team's `config-v2` flag in
  staging.** Blocks verifying the migrated read path anywhere but locally until they enable it.

## Completion Criteria

- [ ] C1. No import of the v1 configuration client remains in bundle-apply.
- [ ] C2. The service starts and serves its health check against an environment offering only v2.
- [ ] C3. The integration suite passes against v2, including the tenant-scoped read.
- [ ] C4. The v1 deprecation warning no longer appears in startup logs.

## Technical Notes

* The v2 client returns a result value where v1 threw, so each call site gains an explicit failure
  branch rather than relying on the surrounding handler.
* Configuration is read once at startup, so no request path changes and no cache needs invalidating.

## References

* [Platform deprecation notice](https://example.invalid/notices/config-v1) — states the removal date
  this task is working to.
* [TKT-71](https://example.invalid/browse/TKT-71) — the same migration on the four services that went
  first; its call-site pattern is the one to copy.
