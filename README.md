# CSS Sprites Plugin

[![NPM version][npm-image]][npm-url]
[![Build Status][github-actions-image]][github-actions-url]
[![License][license-image]][license-url]

## Install

```shell
npm install css-sprites-plugin -D
```

- webpack 4: css-sprites-plugin@1
- webpack 5: css-sprites-plugin@5

## Usage

```js
// webpack.config.js

const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssSpritesPlugin = require('../index')

module.exports = {
  entry: './files/entry.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CssSpritesPlugin() // css-spirtes-plugin
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          CssSpritesPlugin.loader // css-spirtes-plugin loader
        ]
      }
    ]
  }
}
```

## Options

```js
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
```

## License

MIT.

[npm-image]: https://img.shields.io/npm/v/css-sprites-plugin.svg?maxAge=3600
[npm-url]: https://www.npmjs.com/package/css-sprites-plugin
[github-actions-image]: https://github.com/keenwon/css-sprites-plugin/workflows/unittest/badge.svg
[github-actions-url]: https://github.com/keenwon/css-sprites-plugin/actions
[license-image]: https://img.shields.io/npm/l/css-sprites-plugin.svg?maxAge=3600
[license-url]: https://github.com/keenwon/css-sprites-plugin/blob/master/LICENSE
