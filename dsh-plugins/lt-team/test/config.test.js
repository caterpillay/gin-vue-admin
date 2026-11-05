import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeConfig } from '../lib/config.js'

test('defaults to persistent product-manager, QA, rank, and api roles', () => {
  const config = normalizeConfig({}, { DSH_HOME: '/tmp/dsh-home' })
  assert.equal(config.stateDir, '/tmp/dsh-home/state/superagent')
  assert.deepEqual(config.roles.map(role => [role.id, role.sessionId]), [
    ['product-manager', 'lt-team-product-manager'],
    ['qa', 'lt-team-qa'],
    ['rank-programmer', 'lt-team-rank-programmer'],
    ['api-programmer', 'lt-team-api-programmer'],
  ])
  assert.ok(config.roles.every(role => role.readRoots.length === 0))
  assert.deepEqual(config.roles.filter(role => role.kind === 'programmer').map(role => [role.repository, role.writeRoot]), [
    ['rank', ''],
    ['api', ''],
  ])
})

test('normalizes absolute read roots and rejects unsafe role declarations', () => {
  const base = {
    stateDir: '/tmp/state',
    roles: [
      { id: 'pm', kind: 'product-manager', name: 'PM', responsibility: 'Own product work.', readRoots: ['/repo/rank', '/repo/rank'] },
      { id: 'quality', kind: 'qa', name: 'QA', responsibility: 'Own quality work.', readRoots: ['/repo/api'] },
    ],
  }
  const config = normalizeConfig(base)
  assert.deepEqual(config.roles[0].readRoots, ['/repo/rank'])
  assert.throws(() => normalizeConfig({ ...base, roles: [...base.roles, base.roles[0]] }), /duplicated/)
  assert.throws(() => normalizeConfig({ ...base, roles: base.roles.map((role, index) => index ? role : { ...role, readRoots: ['relative'] }) }), /absolute path/)
  assert.throws(() => normalizeConfig({ ...base, roles: base.roles.map((role, index) => index ? role : { ...role, kind: 'designer' }) }), /product-manager, qa, or programmer/)
})

test('programmer roles require a repository label and keep write paths empty', () => {
  const roles = [
    { id: 'pm', kind: 'product-manager', name: 'PM', responsibility: 'Own product work.', readRoots: [] },
    { id: 'quality', kind: 'qa', name: 'QA', responsibility: 'Own quality work.', readRoots: [] },
    { id: 'rank-dev', kind: 'programmer', name: 'rank dev', responsibility: 'Own rank implementation.', repository: 'rank', writeRoot: '', readRoots: [] },
  ]
  assert.equal(normalizeConfig({ stateDir: '/tmp/state', roles }).roles[2].repository, 'rank')
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: roles.map((role, index) => index === 2 ? { ...role, repository: '' } : role) }), /must name its repository/)
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: roles.map((role, index) => index === 2 ? { ...role, writeRoot: '/repo/rank' } : role) }), /must stay empty/)
})
