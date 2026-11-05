import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { normalizeConfig } from '../lib/config.js'
import { RoleManager } from '../lib/roles.js'

function fakeAgent(id) {
  const events = []
  const tools = new Map([
    ['read', {}], ['read_image', {}], ['glob', {}], ['grep', {}], ['web_search', {}], ['web_fetch', {}], ['skill', {}],
  ])
  const skills = new Map()
  const agent = {
    id,
    status: 'idle',
    session: { snapshotEvents: () => events.slice() },
    cancel() { this.status = 'idle' },
    whenIdle: async () => {},
    followup(message) {
      events.push({ type: 'user/message', data: message })
      events.push({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: `answer-${id}` }] } } })
      events.push({ type: 'turn/end', data: {} })
    },
    ctx: {
      systemPrompt: { section: () => () => {} },
      tools: {
        register(spec) { tools.set(spec.name, spec); return () => tools.delete(spec.name) },
        restrict: () => () => {},
        guard: () => () => {},
        get: name => tools.get(name),
      },
      inject(_deps, callback) {
        const scope = { skills: { register(spec) { skills.set(spec.name, spec); return () => skills.delete(spec.name) } } }
        const pending = Promise.resolve(callback(scope))
        pending.dispose = async () => { skills.clear() }
        return pending
      },
    },
    test: { events, tools, skills },
  }
  return agent
}

function fakeContext(agents) {
  const renamed = []
  const stored = new Set()
  const counts = { created: 0, resumed: 0 }
  const create = async (options, resumed) => {
    counts[resumed ? 'resumed' : 'created']++
    const agent = fakeAgent(options.sessionId ?? options.resumeSessionId)
    await options.setup?.(agent.ctx, agent)
    agents.set(agent.id, agent)
    stored.add(agent.id)
    return {
      agent,
      async dispose() { agents.delete(agent.id) },
    }
  }
  return {
    on: () => () => {},
    agents: {
      get: id => agents.get(id),
      create: options => create(options, false),
      resume: options => create(options, true),
    },
    sessionController: { rename: async value => { renamed.push(value) } },
    permissionPresets: { set: () => {} },
    sessionPersistence: {
      stat: async id => stored.has(id) ? { id } : undefined,
      flush: async () => {},
    },
    test: { renamed, stored, counts },
  }
}

test('role manager reuses deterministic sessions and deduplicates requests', async t => {
  const stateDir = await mkdtemp(join(tmpdir(), 'lt-team-roles-'))
  t.after(() => rm(stateDir, { recursive: true, force: true }))
  const config = normalizeConfig({ stateDir })
  const agents = new Map()
  const context = fakeContext(agents)
  const manager = new RoleManager(context, config)
  await manager.start()
  t.after(() => manager.dispose())
  assert.equal((await stat(config.roles[0].workspace)).isDirectory(), true)

  const first = await manager.ask('qa', 'ticket-1:regression', 'Review the regression plan.')
  const second = await manager.ask('qa', 'ticket-1:regression', 'Review the regression plan.')
  assert.equal(first.cached, false)
  assert.equal(second.cached, true)
  assert.equal(first.text, 'answer-lt-team-qa')
  const rank = await manager.ask('rank-programmer', 'ticket-1:rank-design', 'Review the supplied rank design context.')
  assert.equal(rank.text, 'answer-lt-team-rank-programmer')
  await assert.rejects(manager.ask('qa', 'bad]\nmarker', 'Unsafe request id.'), /must match/)
  assert.equal(agents.get('lt-team-qa').test.events.filter(event => event.type === 'user/message').length, 1)
  assert.ok(agents.get('lt-team-qa').test.skills.has('lt-team-qa-memory-manager'))
  assert.deepEqual(context.test.renamed.map(item => item.sessionId).sort(), [
    'lt-team-api-programmer', 'lt-team-product-manager', 'lt-team-qa', 'lt-team-rank-programmer',
  ])
  await manager.dispose()
  assert.equal(agents.size, 0)
  assert.deepEqual([...context.test.stored].sort(), [
    'lt-team-api-programmer', 'lt-team-product-manager', 'lt-team-qa', 'lt-team-rank-programmer',
  ])
  assert.deepEqual(context.test.counts, { created: 4, resumed: 0 })

  const restarted = new RoleManager(context, config)
  await restarted.start()
  assert.equal(agents.size, 4)
  assert.deepEqual(context.test.counts, { created: 4, resumed: 4 })
  await restarted.dispose()
})
