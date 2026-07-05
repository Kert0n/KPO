const major = Number(process.versions.node.split('.')[0])

if (major !== 24) {
  console.error(`Expected Node 24, got ${process.version}`)
  process.exit(1)
}
