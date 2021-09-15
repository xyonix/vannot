
const { merge } = require('webpack-merge')
const common = require('./webpack.config.js')
const path = require('path');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'eval-source-map',
    watchOptions: {
      //Files or folders that are not monitored
      ignored: /node_modules/,
      //After listening to the change, it will wait for 300ms to execute the action, so as to prevent the file from being updated too fast, resulting in too high recompilation frequency  
      aggregateTimeout: 300,  
      //To judge whether the file has changed or not is realized by constantly asking the system whether the specified file has changed or not
      poll: 1000
    },
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
        directory: path.join(__dirname, 'data'),
      },
      compress: true,
      port: 8080,
    },
})