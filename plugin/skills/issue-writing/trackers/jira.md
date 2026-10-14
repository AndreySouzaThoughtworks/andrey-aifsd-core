# Jira adapter

- **Hidden content.** Fetch with `expand=names` and read the **ADF custom fields**. On intake-form and service-desk boards `description` is often null and the narrative lives in custom fields; restricting the fetch to standard fields makes a populated ticket look blank.
- **Bug fields.** Environment, Steps to reproduce, Expected Result and Actual Result are custom fields on boards that have them. Their ids come from the `expand=names` read and are per-board — never hard-code one. Take the priority name from the project's allowed values.
- **Restricted comment** = a comment with a `visibility` of type `role` or `group`. Without it the comment is as visible as the description, including on customer portals.
- **Link direction.** "A is blocked by B" → `inwardIssue: B, outwardIssue: A` on the `Blocks` link type. Re-fetch A and confirm it reads *is blocked by B*, not the reverse.
- **Transitions** are workflow-specific: list them for the ticket before transitioning; never reuse an ID from another project.
- **Task-list items.** Jira stops parsing a line as a tickable task-list item when bold follows the checkbox, and renders a literal `[ ]` in a plain bullet instead. Leave criterion labels unbolded.
