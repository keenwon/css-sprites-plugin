const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const CssSpritesPlugin = require('../index')

module.exports = (option, index) => {
  const compiler = webpack({
    context: __dirname,
    entry: './files/entry.js',
    output: {
      path: path.resolve(__dirname, `dist${index}`),
      filename: 'bundle.js',
      publicPath: '//p1.music.126.net/test/'
    },
    mode: 'development',
    devtool: 'none',
    resolve: {
      alias: {
        '@page1': path.resolve(__dirname, './files/page1'),
        '@page2': path.resolve(__dirname, './files/page2')
      }
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css'
      }),
      new CssSpritesPlugin(option)
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
            CssSpritesPlugin.loader
          ]
        }
      ]
    }
  })

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) reject(err)

      resolve(stats)
    })
  })
}
