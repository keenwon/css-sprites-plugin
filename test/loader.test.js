const fs = require('fs-extra')
const path = require('path')
const compiler = require('./compiler.js')

beforeEach(async () => {
  const distPath = path.join(__dirname, 'dist')
  await fs.remove(distPath)
})

// 动态输入 option 进行测试
const options = [
  {}
]

options.map((option, index) => {
  test(`test${index}`, async () => {
    const stats = await compiler(option, index)
    const { errors } = stats.toJson()

    if (errors.length) {
      console.error(errors.join(''))
    }

    expect(errors.length).toBe(0)
  })
})
