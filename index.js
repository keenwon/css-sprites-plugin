const plugin = require('./src/plugin')
const loader = require.resolve('./src/loader')

plugin.loader = loader

module.exports = plugin
