const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");


module.exports = {
  entry: {
    index: './src/app.js',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src", to: "." },
      ],
    }),
  ],
  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          "style-loader",
          // Translates CSS into CommonJS
          "css-loader",
          // Compiles Sass to CSS
          "sass-loader",
        ],
      },
    ],
  },
};