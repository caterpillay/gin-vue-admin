import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { normalizeConfig } from '../lib/config.js'
import { RoleDecorator } from '../lib/roles.js'

function fakeAgent(id) {
  const tools = new Map([
    ['orchestrator_read', {}], ['orchestrator_ack', {}], ['orchestrator_report', {}],
    ['orchestrator_thread_unrelated', {}], ['orchestrator_thread_follow', {}], ['orchestrator_trigger_handback', {}],
    ['read', {}], ['read_image', {}], ['glob', {}], ['grep', {}], ['bash', {}],
    ['web_search', {}], ['web_fetch', {}], ['skill', {}], ['todo_write', {}],
  ])
  const skills = new Map(), sections = [], restrictions = []
  const agent = {
    id,
    ctx: {
      systemPrompt: { section(spec) { sections.push(spec); return () => {} } },
      tools: {
        register(spec) { tools.set(spec.name, spec); return () => tools.delete(spec.name) },
        restrict(spec) { restrictions.push(spec.allow); return () => {} },
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
    test: { tools, skills, sections, restrictions },
  }
  return agent
}

function fakeContext(agents) {
  return {
    on: () => () => {},
    agents: { list: () => [...agents.values()] },
  }
}

test('decorates only core-managed fixed role Sessions with memory and zero-path policy', async t => {
  const stateDir = await mkdtemp(join(tmpdir(), 'lt-team-roles-'))
  t.after(() => rm(stateDir, { recursive: true, force: true }))
  const config = normalizeConfig({ stateDir })
  const qa = fakeAgent('worker-qa'), rank = fakeAgent('worker-rank-programmer'), unrelated = fakeAgent('worker-random')
  const decorator = new RoleDecorator(fakeContext(new Map([[qa.id, qa], [rank.id, rank], [unrelated.id, unrelated]])), config)
  await decorator.start()
  t.after(() => decorator.dispose())

  for (const [agent, role] of [[qa, 'qa'], [rank, 'rank-programmer']]) {
    assert.equal(agent.test.sections.length, 1)
    assert.match(agent.test.sections[0].text, new RegExp(`permanent lt-team role .*${role}`))
    assert.ok(agent.test.skills.has(`lt-team-${role}-memory-manager`))
    assert.ok(agent.test.tools.has('lt_team_memory_add'))
    const allowed = agent.test.restrictions.at(-1)
    assert.ok(allowed.includes('orchestrator_report'))
    assert.ok(allowed.includes('lt_team_memory_add'))
    assert.equal(allowed.includes('read'), false)
    assert.equal(allowed.includes('bash'), false)
  }
  assert.equal(unrelated.test.sections.length, 0)
  assert.equal(unrelated.test.tools.has('lt_team_memory_add'), false)

  const add = qa.test.tools.get('lt_team_memory_add')
  await add.execute({ kind: 'short', text: 'Verify the active Ticket source.', source: 'ticket-1', confidence: 'high', ttlDays: 2 })
  assert.match(qa.test.skills.get('lt-team-qa-memory-short').content, /Verify the active Ticket source/)
})
