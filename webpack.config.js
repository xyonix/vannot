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
            test: /src\/\.sass$/,
            exclude: /node_modules/,
            use: [
                {
                    loader: 'file-loader',
                    options: { outputPath: 'css/', name: '[name].css'}
                },
                'sass-loader'
            ]
        }
    ]
}
};