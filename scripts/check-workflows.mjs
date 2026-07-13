import { createHash } from 'node:crypto'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const version = '1.7.12'
const targets = {
  'darwin-arm64': [
    'darwin_arm64',
    'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'
  ],
  'darwin-x64': [
    'darwin_amd64',
    '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644'
  ],
  'linux-arm64': [
    'linux_arm64',
    '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6'
  ],
  'linux-x64': ['linux_amd64', '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8']
}

const target = targets[`${process.platform}-${process.arch}`]
if (!target) throw new Error(`Unsupported actionlint platform: ${process.platform}-${process.arch}`)

const [assetTarget, expectedSha256] = target
const asset = `actionlint_${version}_${assetTarget}.tar.gz`
const url = `https://github.com/rhysd/actionlint/releases/download/v${version}/${asset}`
const directory = await mkdtemp(join(tmpdir(), 'kpo-actionlint-'))

try {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Cannot download actionlint: HTTP ${response.status}`)
  const archive = Buffer.from(await response.arrayBuffer())
  const actualSha256 = createHash('sha256').update(archive).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(`actionlint checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`)
  }

  const archivePath = join(directory, asset)
  await writeFile(archivePath, archive)
  const unpack = spawnSync('tar', ['-xzf', archivePath, '-C', directory], { stdio: 'inherit' })
  if (unpack.status !== 0) throw new Error('Cannot unpack actionlint')

  const executable = join(directory, 'actionlint')
  await chmod(executable, 0o755)
  const result = spawnSync(executable, [], { cwd: process.cwd(), stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
} finally {
  await rm(directory, { recursive: true, force: true })
}
