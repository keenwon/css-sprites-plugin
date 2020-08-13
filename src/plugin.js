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
 * 默认配置
 */
const defaultOptions = {
  /**
   * sprite 图片 name
   */
  name: 'sprite.[contenthash:6].png',

  /**
   * 过滤模式，支持 query 和 all
   * query 模式下只将 url 带指定 params 的图片，合并入 sprite
   */
  filter: 'all',
  params: '__sprite',

  /**
   * 限制文件大小，文件 < limit 才会合入 sprite
   */
  limit: 8 * 1024,

  /**
   * Spritesmith algorithm
   */
  algorithm: 'binary-tree',

  /**
   * Spritesmith padding
   */
  padding: 5
}

class CssSpritesPlugin {
  constructor (options) {
    this.options = Object.assign({}, defaultOptions, options)

    debug('options: %o', this.options)

    // 输出路径
    this.outputPath = ''

    // 原始图片信息
    this.rawImagesInfo = {}

    // 全部 asset
    this.assets = {}
  }

  registerImageInfo (name, info) {
    this.rawImagesInfo[name] = info
  }

  apply (compiler) {
    this.outputPath = compiler.options.output.path

    compiler.hooks.compilation.tap(pluginName, compilation => {
      // 注册方法给 loader 使用
      compilation.hooks.normalModuleLoader.tap(pluginName, context => {
        context.cspRegisterImageInfo = this.registerImageInfo.bind(this)
      })

      compilation.hooks.optimizeAssets.tapPromise(pluginName, () => {
        this.assets = compilation.assets

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

    const ast = css.parse(content)

    if (!ast.stylesheet.rules) {
      debug(`${assetName}: no rules`)
      return Promise.resolve()
    }

    // 筛选出 image 相关的 rules
    const imageRules = this.getImageRulsFromAst(ast).map(item => {
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
        const spriteFileName = this.emitFile(result.image)

        /**
         * 修改 css
         */
        const { width, height } = result.properties

        imageRules.forEach(({ rawUrl, imageFilePath, declaration, rule }) => {
          const {
            x, y, width: imageWidth, height: imageHeight
          } = result.coordinates[rawUrl]

          const newImagePath = `${path.dirname(imageFilePath)}/${spriteFileName}`

          declaration.value = declaration.value.replace(/url\(.+?\)/i, `url(${newImagePath})`)

          const positionX = this.getBackgroundPosition(x, imageWidth, width)
          const positionY = this.getBackgroundPosition(y, imageHeight, height)
          const sizeX = this.getBackgroundSize(imageWidth, width)
          const sizeY = this.getBackgroundSize(imageHeight, height)

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
        algorithm: this.options.algorithm,
        padding: this.options.padding
      }, handleSpritesmithResult.bind(this))
    })
  }

  /**
   * 从 ast 中提取 image url
   */

  getImageRulsFromAst (ast) {
    const rules = []

    ast.stylesheet.rules.forEach((rule) => {
      if (!rule.declarations) {
        return
      }

      rule.declarations.forEach((declaration) => {
        const { property, value } = declaration

        /**
         * CSS 属性过滤
         */
        if (property !== 'background' && property !== 'background-image') {
          return
        }

        const matched = value.match(URL_REG)

        if (!matched || !matched[1]) {
          return
        }

        /**
         * options.filter 过滤
         */
        if (this.options.filter === 'query' && value.includes(this.options.params)) {
          return
        }

        const imageFilePath = matched[1]
        const absoluteUrl = path.join(this.outputPath, imageFilePath)

        /**
         * 根据文件大小过滤
         */
        if (this.assets[path.basename(imageFilePath)].size() >= this.options.limit) {
          return
        }

        debug(`css sprite plugin: ${imageFilePath}`)

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

  getBackgroundPosition (num, item, total) {
    if (!num) {
      return '0%'
    }

    return `${(-num / (item - total) * 100).toFixed(4)}%`
  }

  /**
   * background-size 转换
   */

  getBackgroundSize (item, total) {
    return `${(total / item * 100).toFixed(4)}%`
  }

  /**
   * 生成文件
   */

  emitFile (image) {
    const spriteFileName = loaderUtils.interpolateName({}, this.options.name, {
      content: image
    })

    const absolutePath = path.join(this.outputPath, spriteFileName)

    fs.outputFileSync(absolutePath, image)

    debug(`emit sprite file: ${absolutePath}`)

    return spriteFileName
  }
}

module.exports = CssSpritesPlugin
