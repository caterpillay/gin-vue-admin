import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeConfig } from '../lib/config.js'

test('defaults to persistent product-manager and QA roles', () => {
  const config = normalizeConfig({}, { DSH_HOME: '/tmp/dsh-home' })
  assert.equal(config.stateDir, '/tmp/dsh-home/state/superagent')
  assert.deepEqual(config.roles.map(role => [role.id, role.sessionId]), [
    ['product-manager', 'lt-team-product-manager'],
    ['qa', 'lt-team-qa'],
  ])
  assert.ok(config.roles.every(role => role.readRoots.length === 0))
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
  assert.throws(() => normalizeConfig({ ...base, roles: base.roles.map((role, index) => index ? role : { ...role, kind: 'programmer' }) }), /product-manager or qa/)
})
