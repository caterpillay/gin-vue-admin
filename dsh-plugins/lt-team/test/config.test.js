import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_ROLES, normalizeConfig } from '../lib/config.js'

const roles = () => DEFAULT_ROLES.map(role => ({ ...role, readRoots: [] }))

test('defaults to the exact persistent core role catalog', () => {
  const config = normalizeConfig({}, { DSH_HOME: '/tmp/dsh-home' })
  assert.equal(config.stateDir, '/tmp/dsh-home/state/superagent')
  assert.deepEqual(config.roles.map(role => [role.id, role.sessionId]), [
    ['product-manager', 'worker-product-manager'],
    ['qa', 'worker-qa'],
    ['rank-programmer', 'worker-rank-programmer'],
    ['api-programmer', 'worker-api-programmer'],
  ])
  assert.ok(config.roles.every(role => role.readRoots.length === 0))
  assert.deepEqual(config.roles.filter(role => role.kind === 'programmer').map(role => [role.repository, role.repositoryProvider, role.writeRoot]), [
    ['rank', 'codebase', ''],
    ['api', 'codebase', ''],
  ])
})

test('normalizes absolute read roots and rejects unsafe role declarations', () => {
  const fixed = roles().map((role, index) => ({ ...role, readRoots: index === 0 ? ['/repo/rank', '/repo/rank'] : index === 1 ? ['/repo/api'] : [] }))
  const base = { stateDir: '/tmp/state', roles: fixed }
  const config = normalizeConfig(base)
  assert.deepEqual(config.roles[0].readRoots, ['/repo/rank'])
  assert.throws(() => normalizeConfig({ ...base, roles: [...base.roles, base.roles[0]] }), /duplicated/)
  assert.throws(() => normalizeConfig({ ...base, roles: base.roles.map((role, index) => index ? role : { ...role, readRoots: ['relative'] }) }), /absolute path/)
  assert.throws(() => normalizeConfig({ ...base, roles: base.roles.map((role, index) => index ? role : { ...role, kind: 'designer' }) }), /product-manager, qa, or programmer/)
})

test('requires every fixed core role exactly once and preserves its kind and repository', () => {
  const fixed = roles()
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: fixed.slice(0, -1) }), /contain exactly/)
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: [...fixed.slice(0, -1), { ...fixed.at(-1), id: 'custom-programmer' }] }), /contain exactly/)
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: fixed.map(role => role.id === 'qa' ? { ...role, kind: 'product-manager' } : role) }), /fixed core role/)
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: fixed.map(role => role.id === 'rank-programmer' ? { ...role, repository: 'other' } : role) }), /fixed core role/)
})

test('programmer roles require repository labels and an allowed provider while write paths stay empty', () => {
  const fixed = roles()
  const normalized = normalizeConfig({ stateDir: '/tmp/state', roles: fixed })
  assert.equal(normalized.roles[2].repository, 'rank')
  assert.equal(normalized.roles[2].repositoryProvider, 'codebase')
  const github = normalizeConfig({ stateDir: '/tmp/state', roles: fixed.map(role => role.id === 'rank-programmer' ? { ...role, repositoryProvider: 'github' } : role) })
  assert.equal(github.roles[2].repositoryProvider, 'github')
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: fixed.map(role => role.id === 'rank-programmer' ? { ...role, repository: '' } : role) }), /must name its repository/)
  const migrated = normalizeConfig({ stateDir: '/tmp/state', roles: fixed.map(role => role.id === 'rank-programmer' ? { ...role, repositoryProvider: '' } : role) })
  assert.equal(migrated.roles[2].repositoryProvider, 'codebase')
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: fixed.map(role => role.id === 'rank-programmer' ? { ...role, repositoryProvider: 'gitlab' } : role) }), /must be codebase or github/)
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: fixed.map(role => role.id === 'qa' ? { ...role, repositoryProvider: 'codebase' } : role) }), /must be empty/)
  assert.throws(() => normalizeConfig({ stateDir: '/tmp/state', roles: fixed.map(role => role.id === 'rank-programmer' ? { ...role, writeRoot: '/repo/rank' } : role) }), /must stay empty/)
})
