# lt-team worker guide

Use `lt-team` when a ticket benefits from durable product or quality context. The specialist Sessions persist across tickets; the current dsh-superagent worker remains responsible for authorization, implementation, reports, and delivery.

## Roles

- `product-manager`: requirements, scope, priority, acceptance criteria, and cross-repository product decisions.
- `qa`: test strategy, regression coverage, release risk, and acceptance verification.

## Commands

List roles:

```sh
{{LT_TEAM_CLI}} roles
```

Ask one role. Always provide a stable request id derived from the ticket and purpose so transport retries do not duplicate work:

```sh
{{LT_TEAM_CLI}} ask product-manager --request-id "$DSH_SUPERAGENT_TICKET:requirements" <<'EOF'
Describe the concrete product question and include only the ticket context the role needs.
EOF
```

The command may move to a background job under the worker shell. Collect that job normally; its stdout is the role's answer.

Consult a role only for work that fits its responsibility. Do not delegate final ticket ownership, repository writes, GitHub delivery, or a decision that needs the user. Treat role output as specialist input and verify it against the current ticket and source context.
