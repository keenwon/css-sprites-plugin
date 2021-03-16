const debug = require('debug')('css-sprites-plugin')
const fs = require('fs-extra')
const path = require('path')
const postcss = require('postcss')
const Spritesmith = require('spritesmith')
const webpack = require('webpack')
const webpackSources = require('webpack-sources')
const loaderUtils = require('loader-utils')
const _ = require('lodash')

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
   * 是否开启过滤模式
   * 开启后只将 url 带指定 params 的图片，合并入 sprite
   */
  filter: false,
  params: '__sprite',

  /**
   * 限制文件大小，文件 < limit 才会合入 sprite
   */
  limit: 16 * 1024,

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
  constructor (options = {}) {
    this.options = Object.assign({}, defaultOptions, options)

    debug('options: %o', this.options)

    // 输出路径
    this.outputPath = ''

    // 原始图片信息
    this.rawImagesInfo = {}

    // 全部 asset
    this.assets = {}
  }

  registerImageInfo (hashName, info) {
    this.rawImagesInfo[hashName] = info
  }

  apply (compiler) {
    this.outputPath = compiler.options.output.path

    const NormalModule = webpack.NormalModule
      ? webpack.NormalModule
      : require('webpack/lib/NormalModule')

    compiler.hooks.compilation.tap(pluginName, compilation => {
      // 注册方法给 loader 使用
      const normalModuleHook = typeof NormalModule.getCompilationHooks !== 'undefined'
        ? NormalModule.getCompilationHooks(compilation).loader
        : compilation.hooks.normalModuleLoader

      normalModuleHook.tap(pluginName, context => {
        context.cspRegisterImageInfo = this.registerImageInfo.bind(this)
      })

      compilation.hooks.optimizeAssets.tapPromise(pluginName, () => {
        this.assets = compilation.assets

        return this.sprite(compilation)
      })
    })
  }

  sprite (compilation) {
    const assetNames = Object.keys(this.assets)

    const cssAssetNames = assetNames.filter(name => /\.css$/.test(name))

    if (!cssAssetNames.length) {
      return Promise.resolve()
    }

    debug('cssAssetNames: %o', cssAssetNames)

    return Promise.all(cssAssetNames.map(name => {
      return this.run(compilation, name, this.assets[name])
    }))
  }

  run (compilation, assetName, asset) {
    const content = asset.source()

    const ast = postcss.parse(content)

    // 筛选出 image 相关的 rules
    const rules = this.getImageRulsFromAst(ast)
    const imageRules = this.processRules(rules)

    // 所有 image url
    const imageUrls = _.uniq(imageRules
      .map(item => item.rawImageInfo.resourcePath)
      .filter(item => !!item))

    if (!Array.isArray(imageUrls) || imageUrls.length <= 1) {
      debug(`${assetName}: 图片数 <= 1，不执行`)
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

        imageRules.forEach(({
          rawImageInfo,
          imageFilePath,
          imageFileName,
          declaration
        }) => {
          const {
            x, y, width: imageWidth, height: imageHeight
          } = result.coordinates[rawImageInfo.resourcePath]

          const newImagePath = this.replaceSpriteImage(imageFilePath, spriteFileName)
          const positionX = this.getBackgroundPosition(x, imageWidth, width)
          const positionY = this.getBackgroundPosition(y, imageHeight, height)
          const sizeX = this.getBackgroundSize(imageWidth, width)
          const sizeY = this.getBackgroundSize(imageHeight, height)

          declaration.value = declaration.value.replace(/url\(.+?\)/i, `url(${newImagePath})`)

          // 删除现有的 css 属性
          declaration.parent.walkDecls(/^background-(position|size)$/, decl => {
            decl.remove()
          })

          declaration.cloneAfter({
            prop: 'background-position',
            value: `${positionX} ${positionY} !important`
          })

          declaration.cloneAfter({
            prop: 'background-size',
            value: `${sizeX} ${sizeY} !important`
          })

          // 删除原有的图片
          delete compilation.assets[imageFileName]
        })

        const newContent = ast.toString()

        // 更新 css 文件
        compilation.assets[assetName] = new webpackSources.RawSource(newContent)

        // 添加 sprite 图到 asset
        compilation.assets[spriteFileName] = new webpackSources.RawSource(result.image)

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

    ast.walkDecls(/^background(-image)?$/, declaration => {
      const { value } = declaration

      const matched = value.match(URL_REG)

      if (!matched || !matched[1]) {
        return
      }

      // 不处理 repeat 的图片
      const content = declaration.parent.toString()

      // 暂时简单处理，当 css 里存在 repeat，但不是 no-repeat 的时候，不合入 sprite
      if (content.includes('repeat') && !content.includes('no-repeat')) {
        return
      }

      const imageFilePath = matched[1]
      const absoluteUrl = path.join(this.outputPath, imageFilePath)

      rules.push({
        imageFilePath,
        absoluteUrl,
        declaration
      })
    })

    return rules
  }

  /**
   * 过滤并预处理 rules
   */

  processRules (rules) {
    const imageRules = []
    const { filter, params, limit } = this.options

    rules.forEach(rule => {
      const imageFileName = path.basename(rule.imageFilePath)
      const rawImageInfo = this.rawImagesInfo[imageFileName]
      const asset = this.assets[imageFileName]

      // 仅处理 loader 采集过的 image
      if (!rawImageInfo || !asset) {
        return
      }

      /**
       * options.filter 过滤
       */
      if (filter && !rawImageInfo.resourceQuery.includes(params)) {
        return
      }

      /**
       * 根据文件大小过滤
       */
      if (asset.size() >= limit) {
        return
      }

      imageRules.push({
        ...rule,
        imageFileName,
        rawImageInfo
      })
    })

    return imageRules
  }

  /**
   * 用 sprite 图片替换原有图片
   */

  replaceSpriteImage (imageFilePath, spriteFileName) {
    if (!imageFilePath.includes('/')) {
      return spriteFileName
    }

    // 拼接新的 path
    return `${imageFilePath.substr(0, imageFilePath.lastIndexOf('/'))}/${spriteFileName}`
  }

  /**
   * background-position 转换
   */

  getBackgroundPosition (num, item, total) {
    if (!num) {
      return '0'
    }

    return `${parseFloat((-num / (item - total) * 100).toFixed(4))}%`
  }

  /**
   * background-size 转换
   */

  getBackgroundSize (item, total) {
    return `${parseFloat((total / item * 100).toFixed(4))}%`
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
