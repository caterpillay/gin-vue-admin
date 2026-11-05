# lt-team

`lt-team` is the memory and repository-policy companion for the fixed worker roles built into the matching `dsh-superagent` core change:

- `product-manager`
- `qa`
- `rank-programmer`
- `api-programmer`

The core keeps every request as an independent Ticket and makes the main Session choose one `role_id` when accepting it. Tickets assigned to the same role serialize through one persistent Session (`worker-<role id>`); different roles can work concurrently. Ticket Mandates, replies, directories, branches, PR state, cancellation and retries remain independent.

This bundle does **not** create another team, route through a CLI, or own Ticket execution. It decorates those core-managed role Sessions with:

- role persona and responsibility reminders;
- `memory-short` and `memory-long` runtime Skills;
- a `memory-manager` Skill for promotion, correction and deletion;
- a `skill-gardener` review queue instead of automatic executable self-modification;
- sourced, timestamped and confidence-labelled file-backed memory with no database;
- repository tool restrictions derived from configured absolute roots.

## Install

Install this directory as a bundle in the same profile as the compatible `dsh-superagent` core. The bundle inserts the `@local/lt-team` Host plugin and creates no page or client UI.

The default memory state directory is `$DSH_HOME/state/superagent`. Override it when the core uses another state directory:

```yaml
- id: lt-team
  name: '@local/lt-team'
  config:
    stateDir: /absolute/path/to/superagent-state
```

## Repository providers and paths

The default rank/api programmer roles are assigned to ByteDance Codebase. GitHub remains supported as a per-role provider, but paths intentionally stay empty until the corresponding repository is configured:

```yaml
- id: lt-team
  name: '@local/lt-team'
  config:
    roles:
      - id: product-manager
        kind: product-manager
        name: 产品经理
        responsibility: 负责 rank、api 的需求、范围、优先级和验收标准。
        repository: ''
        repositoryProvider: ''
        writeRoot: ''
        readRoots: []
      - id: qa
        kind: qa
        name: QA
        responsibility: 负责 rank、api 的测试策略、回归和发布风险。
        repository: ''
        repositoryProvider: ''
        writeRoot: ''
        readRoots: []
      - id: rank-programmer
        kind: programmer
        name: rank 程序员
        responsibility: 负责 rank 的实现方案和技术问题。
        repository: rank
        repositoryProvider: codebase
        writeRoot: ''
        readRoots: []
      - id: api-programmer
        kind: programmer
        name: api 程序员
        responsibility: 负责 api 的实现方案和技术问题。
        repository: api
        repositoryProvider: codebase
        writeRoot: ''
        readRoots: []
```

`repositoryProvider` accepts `codebase` or `github` for programmer roles. The default selects Codebase for the internal rank/api repositories without removing GitHub support for roles that still need it. Product-manager and QA roles must leave it empty because they do not own one repository.

Provider selection is routing metadata, not credentials or repository access. With no paths, repository file and shell tools are removed from these role Sessions. They can use the active Ticket context, core reporting/reply tools, web research and memory, but cannot claim to inspect, modify, build, commit, push, or open an MR/PR for rank/api code. Configuring Codebase authentication, repository identities and MR lifecycle belongs to the core repository adapter; this companion does not pretend that metadata alone enables those operations.

Read-only access can later be added with absolute `readRoots`. Relative paths are refused because the core role Session has a stable workspace separate from each Ticket directory. `writeRoot` remains reserved and must stay empty until a real one-repository writable sandbox/mount/ACL boundary is implemented and tested.

## Memory model

Each role combines:

1. Its accumulating and compacting Session history.
2. TTL short memory.
3. Stable long memory.
4. Memory promotion/deletion rules.
5. Reviewed skill candidates.

Mutable entries live in a mode-`0600` JSON file under that role's plugin state directory. The plugin re-registers runtime Skills after each memory change. Stored text is escaped and quoted as recalled data, so it cannot break Skill framing or become higher-priority instructions.

## Development

```sh
npm run check
npm pack --dry-run
```

Tests cover fixed role targeting, zero-path tool restrictions, absolute read boundaries, memory TTL/promotion, adversarial memory framing and package contents.
