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
