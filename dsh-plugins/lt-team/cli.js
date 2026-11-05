#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import net from 'node:net'
import { stdin, stdout, stderr } from 'node:process'
import { decodeMessage, encodeMessage } from './lib/rpc.js'

function socketPath() {
  if (process.env.LT_TEAM_SOCKET) return process.env.LT_TEAM_SOCKET
  if (process.env.DSH_SUPERAGENT_DIR) return join(dirname(dirname(process.env.DSH_SUPERAGENT_DIR)), 'lt-team', 'rpc.sock')
  throw new Error('LT_TEAM_SOCKET is unset; run this command inside a dsh-superagent worker')
}

function readStdin() {
  if (stdin.isTTY) return Promise.resolve('')
  return new Promise((resolve, reject) => {
    let text = ''
    stdin.setEncoding('utf8')
    stdin.on('data', chunk => { text += chunk })
    stdin.on('end', () => resolve(text))
    stdin.on('error', reject)
  })
}

function call(request) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath())
    let text = ''
    socket.setEncoding('utf8')
    socket.setTimeout(30 * 60_000, () => socket.destroy(new Error('lt-team request timed out after 30 minutes')))
    socket.on('connect', () => socket.write(encodeMessage(request)))
    socket.on('data', chunk => { text += chunk })
    socket.on('end', () => {
      try {
        const line = text.split('\n').find(Boolean)
        if (!line) throw new Error('lt-team returned no response')
        const response = decodeMessage(line)
        if (!response.ok) throw new Error(String(response.error || 'lt-team request failed'))
        resolve(response.result)
      } catch (error) { reject(error) }
    })
    socket.on('error', reject)
  })
}

function usage() {
  return 'usage: lt-team roles | lt-team ask <role> [--request-id <id>] [task text; otherwise read stdin]'
}

async function main(argv) {
  const command = argv.shift()
  if (command === 'roles' && argv.length === 0) {
    const roles = await call({ command: 'roles' })
    for (const role of roles) stdout.write(`${role.id}\t${role.name}\t${role.responsibility}\n`)
    return
  }
  if (command !== 'ask') throw new Error(usage())
  const role = argv.shift()
  if (!role) throw new Error(usage())
  let requestId = randomUUID()
  const index = argv.indexOf('--request-id')
  if (index >= 0) {
    requestId = argv[index + 1] || ''
    argv.splice(index, 2)
  }
  const task = (argv.join(' ').trim() || (await readStdin()).trim())
  if (!task) throw new Error('lt-team task is empty')
  const result = await call({ command: 'ask', role, requestId, task })
  stdout.write(`${result.text}\n`)
}

main(process.argv.slice(2)).catch(error => { stderr.write(`lt-team: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1 })
