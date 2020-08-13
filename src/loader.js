const fallbackLoader = require('file-loader')
const loaderUtils = require('loader-utils')

function loader (content, map, meta) {
  const ctx = this
  const options = loaderUtils.getOptions(ctx)
  const context = options.context || this.rootContext

  const hashedImageFileName = loaderUtils.interpolateName(
    ctx,
    options.name || '[contenthash].[ext]',
    {
      context,
      content,
      regExp: options.regExp
    }
  )

  // 注册原始图片信息给 plugin 使用
  ctx.cspRegisterImageInfo(hashedImageFileName, {
    resourcePath: ctx.resourcePath,
    resourceQuery: ctx.resourceQuery
  })

  // 功能完全依赖 file-loader
  return fallbackLoader.call(ctx, content, map, meta)
}

module.exports = loader
module.exports.raw = true
