const fs = require('fs-extra')
const path = require('path')
const compiler = require('./compiler.js')

const cleanDir = async (index) => {
  const distPath = path.join(__dirname, `dist${index}`)
  await fs.remove(distPath)
}

// 动态输入 option 进行测试
const options = [
  // 默认配置
  {},

  // 开启 filter
  {
    filter: true
  },

  // 不限制图片大小
  {
    limit: Number.MAX_SAFE_INTEGER
  },

  // 自定义文件名
  {
    name: 'sprite.[contenthash].png'
  },

  // 自定义 Spritesmith 配置
  {
    padding: 50
  }
]

options.map((option, index) => {
  test(`test${index}`, async () => {
    await cleanDir(index)

    const stats = await compiler(option, index)
    const { errors } = stats.toJson()

    if (errors.length) {
      console.error(errors.join(''))
    }

    expect(errors.length).toBe(0)
  })
})
