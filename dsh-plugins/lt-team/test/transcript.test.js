import assert from 'node:assert/strict'
import test from 'node:test'
import { responseForRequest } from '../lib/roles.js'

const user = text => ({ type: 'user/message', data: { content: [{ type: 'text', text }] } })
const assistant = text => ({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text }] } } })
const end = { type: 'turn/end', data: {} }

test('request replay returns the completed answer', () => {
  const events = [user('[lt-team request req-1]\nQuestion'), assistant('Answer'), end]
  assert.equal(responseForRequest(events, 'req-1'), 'Answer')
})

test('a resumed duplicate request uses its latest turn', () => {
  const events = [user('[lt-team request req-1]\nQuestion'), end, user('[lt-team request req-1]\nResume'), assistant('Recovered answer'), end]
  assert.equal(responseForRequest(events, 'req-1'), 'Recovered answer')
})
