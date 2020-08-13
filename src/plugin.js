const debug = require('debug')('css-sprites-plugin')
const fs = require('fs-extra')
const path = require('path')
const css = require('css')
const Spritesmith = require('spritesmith')
const webpackSources = require('webpack-sources')
const loaderUtils = require('loader-utils')

const pluginName = 'CssSpritesPlugin'
const URL_REG = /url\(['"]?(.+?\.(png|jpg|jpeg|gif))(.*)['"]?\)/i

/**
 * 是否是网络图片
 */

function isNetworkImg (value) {
  if (!value || typeof value !== 'string') {
    return false
  }

  return /^(\/\/|http|https).+?/.test(value)
}

/**
 * 从 ast 中提取 image url
 */

function getImageRulsFromAst (ast, outputPath) {
  const rules = []

  ast.stylesheet.rules.forEach((rule) => {
    if (!rule.declarations) {
      return
    }

    rule.declarations.forEach((declaration) => {
      const { property, value } = declaration

      if (property !== 'background' && property !== 'background-image') {
        return
      }

      const matched = value.match(URL_REG)

      if (!matched || !matched[1]) {
        return
      }

      const imageFilePath = matched[1]
      const absoluteUrl = path.join(outputPath, imageFilePath)

      //  网络图片不处理
      if (isNetworkImg(matched && matched[1])) {
        return
      }

      debug(`css sprite loader: ${imageFilePath}`)

      rules.push({
        imageFilePath,
        absoluteUrl,
        declaration,
        rule
      })
    })
  })

  return rules
}

/**
 * background-position 转换
 */

function getPosition (num, item, total) {
  if (!num) {
    return '0%'
  }

  return `${(-num / (item - total) * 100).toFixed(4)}%`
}

/**
 * background-size 转换
 */

function getSize (item, total) {
  return `${(total / item * 100).toFixed(4)}%`
}

/**
 * 生成文件
 */

function emitFile (image, outputPath, name = 'sprite.[contenthash:6].png') {
  const spriteFileName = loaderUtils.interpolateName({}, name, {
    content: image
  })

  const absolutePath = path.join(outputPath, spriteFileName)

  fs.outputFileSync(absolutePath, image)

  debug(`sprite file absolute path: ${absolutePath}`)

  return spriteFileName
}

class CssSpritesPlugin {
  constructor () {
    // 输出路径
    this.outputPath = ''

    // 原始图片信息
    this.rawImagesInfo = {}

    this.registerImageInfo = this.registerImageInfo.bind(this)
  }

  registerImageInfo (name, info) {
    this.rawImagesInfo[name] = info
  }

  apply (compiler) {
    this.outputPath = compiler.options.output.path

    compiler.hooks.compilation.tap(pluginName, compilation => {
      // 注册方法给 loader 使用
      compilation.hooks.normalModuleLoader.tap(pluginName, context => {
        context.cspRegisterImageInfo = this.registerImageInfo
      })

      compilation.hooks.optimizeAssets.tapPromise(pluginName, () => {
        return this.sprite(compilation)
      })
    })
  }

  sprite (compilation) {
    const assetNames = Object.keys(compilation.assets)

    debug('assetNames: %o', assetNames)

    const cssAssetNames = assetNames.filter(name => /\.css$/.test(name))

    debug('cssAssetNames: %o', cssAssetNames)

    if (!cssAssetNames.length) {
      return Promise.resolve()
    }

    return Promise.all(cssAssetNames.map(name => {
      return this.run(compilation, name, compilation.assets[name])
    }))
  }

  run (compilation, assetName, asset) {
    const content = asset.source()
    const outputPath = this.outputPath

    const ast = css.parse(content)

    if (!ast.stylesheet.rules) {
      debug(`${assetName}: no rules`)
      return Promise.resolve()
    }

    // 筛选出 image 相关的 rules
    const imageRules = getImageRulsFromAst(ast, outputPath).map(item => {
      const imageFileName = path.basename(item.imageFilePath)
      const rawUrl = this.rawImagesInfo[imageFileName].resourcePath

      return {
        ...item,
        rawUrl
      }
    })

    // 所有 image url
    const imageUrls = imageRules
      .map(item => item.rawUrl)
      .filter(item => !!item)

    debug(`${assetName} image urls: %o`, imageUrls)

    if (!imageUrls.length) {
      debug(`${assetName}: no image, exit`)
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      function handleSpritesmithResult (error, result) {
        if (error) {
          reject(error)
          return
        }

        /**
         * 生成文件
         */
        const spriteFileName = emitFile(result.image, outputPath)

        /**
         * 修改 css
         */
        const { width, height } = result.properties

        imageRules.forEach(({ rawUrl, imageFilePath, declaration, rule }) => {
          const {
            x, y, width: imageWidth, height: imageHeight
          } = result.coordinates[rawUrl]

          const newImagePath = path.join(path.dirname(imageFilePath), spriteFileName)

          declaration.value = declaration.value.replace(/url\(.+?\)/i, `url(${newImagePath})`)

          const positionX = getPosition(x, imageWidth, width)
          const positionY = getPosition(y, imageHeight, height)
          const sizeX = getSize(imageWidth, width)
          const sizeY = getSize(imageHeight, height)

          const newRules = [
            {
              type: 'declaration',
              property: 'background-position',
              value: `${positionX} ${positionY}`
            },
            {
              type: 'declaration',
              property: 'background-size',
              value: `${sizeX} ${sizeY}`
            }
          ]

          debug(`new rules ${rawUrl}: %O`, newRules)

          rule.declarations.push(...newRules)
        })

        const newContent = css.stringify(ast)

        compilation.assets[assetName] = new webpackSources.RawSource(newContent)

        resolve()
      }

      Spritesmith.run({
        src: imageUrls,
        algorithm: 'binary-tree',
        padding: 5
      }, handleSpritesmithResult)
    })
  }
}

module.exports = CssSpritesPlugin
