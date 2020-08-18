# CSS Sprites Plugin

## Install

```shell
npm install css-sprites-plugin -D
```

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
