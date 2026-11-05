# lt-team

`lt-team` adds two fixed, persistent specialist Sessions to a DeepSeek Harness `dsh-superagent` profile:

- **Product manager** — requirements, scope, priority, acceptance criteria, and cross-business coordination.
- **QA** — test strategy, regression coverage, release risk, and acceptance verification.

Their Session IDs are deterministic (`lt-team-product-manager` and `lt-team-qa`), so their conversation context survives unrelated Superagent tickets and process restarts. A ticket worker consults them explicitly with the `lt-team` command and remains responsible for authorization, code changes, reports, and delivery.

## Why this is a sidecar

Current `dsh-superagent` deliberately owns one Executor Session per Ticket. Its public plugin service does not expose an Executor extension point, and its report attribution, input tracking, cancellation, retry, and workspace lifecycle all assume one Session maps to one Ticket. `lt-team` therefore does not monkey-patch or replace that lifecycle. It supplies durable role judgement as a safe first step; making permanent roles first-class Ticket executors requires a separate core Executor-provider interface.

## Install

Install this directory as a bundle in the `superagent` profile using the Harness Plugin Manager. The bundle inserts the `@local/lt-team` Host plugin. It creates no UI and requires no frontend build.

The default state directory is `$DSH_HOME/state/superagent`. Override it when `dsh-superagent` uses another state directory.

```yaml
- id: lt-team
  name: '@local/lt-team'
  config:
    stateDir: /absolute/path/to/superagent-state
```

## Configure repository visibility later

The initial roles know the business repository names `rank` and `api`, but no filesystem path is assumed. Add absolute read roots after those paths are available:

```yaml
- id: lt-team
  name: '@local/lt-team'
  config:
    roles:
      - id: product-manager
        kind: product-manager
        name: 产品经理
        responsibility: 负责 rank、api 的需求、范围、优先级和验收标准。
        readRoots:
          - /path/to/rank
          - /path/to/api
      - id: qa
        kind: qa
        name: QA
        responsibility: 负责 rank、api 的测试策略、回归和发布风险。
        readRoots:
          - /path/to/rank
          - /path/to/api
```

PM and QA are read-only: their tool allowlist excludes shell and file-write tools, and file reads are guarded by `readRoots`. Their private Session workspace remains writable only for Harness internals.

Programmer roles are intentionally not enabled in this first version. “Write exactly one repository, read a broader set” must be enforced by a real sandbox/mount/ACL boundary, not only by a prompt or command parser. Add them only after the writable worktree and read-only repository mounts are available and tested.

## Worker use

Every live and future `worker-<ticket>` Session receives an `lt-team` skill. It can list roles and make a serialized request:

```sh
lt-team roles
lt-team ask qa --request-id "$DSH_SUPERAGENT_TICKET:regression" <<'EOF'
Review the proposed acceptance and identify the smallest meaningful regression plan.
EOF
```

The CLI talks over a mode-`0600` Unix-domain socket beneath the plugin state directory. Stable request IDs return the already recorded answer after transport retries instead of starting duplicate work.

## Memory model

There is no memory database. Each permanent role uses:

1. Its accumulating and compacting Session context as working memory.
2. A `memory-short` runtime Skill backed by TTL entries.
3. A `memory-long` runtime Skill for stable, sourced knowledge.
4. A `memory-manager` Skill that controls promotion, correction, and deletion.
5. A `skill-gardener` Skill that records reusable-method candidates for review instead of rewriting executable skills automatically.

The mutable entries live in a mode-`0600` JSON file inside that role's plugin state directory. The plugin re-registers the runtime Skills after every memory change, so the next `skill` read sees the current content. Entries keep source, time, confidence, and (for short memory) expiry.

## Development

```sh
npm run check
```

The tests cover role/config validation, path boundaries, memory TTL and promotion, and the private RPC transport.
