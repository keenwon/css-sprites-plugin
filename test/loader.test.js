const fs = require('fs-extra')
const path = require('path')
const compiler = require('./compiler.js')

beforeEach(async () => {
  const distPath = path.join(__dirname, 'dist')
  await fs.remove(distPath)
})

test('test', async () => {
  const stats = await compiler()
  const { errors } = stats.toJson()

  if (errors.length) {
    console.error(errors.join(''))
  }

  expect(errors.length).toBe(0)
})
