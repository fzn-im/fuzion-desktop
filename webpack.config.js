const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { DefinePlugin } = require('webpack');

const tsRules = [
  {
    test: /\.ts$/,
    exclude: path.resolve(__dirname, './node_modules/'),
    oneOf: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                [
                  '@babel/preset-env',
                  {
                    corejs: '3.0.0',
                    useBuiltIns: 'entry',
                  },
                ],
              ],
            },
          },
          {
            loader: 'ts-loader',
            options: {
              configFile: path.join(__dirname, './tsconfig.webpack.json'),
            },
          },
        ],
      },
    ],
  },
  {
    test: /\.(sa|sc|c)ss$/,
    oneOf: [
      {
        resourceQuery: /lit/,
        use: [
          { loader: 'lit-scss-loader', options: { minify: false } }, // profile.mode !== 'development' } },
          { loader: path.resolve(__dirname, './escape-lit-scss.js') },
          {
            loader: 'extract-loader',
            options: {
              publicPath: '',
              sourceMap: true,
            },
          },
          {
            loader: 'css-loader',
            options: { sourceMap: true, esModule: false },
          },
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                includePaths: [ '.', './src', './node_modules' ],
              },
              sourceMap: true,
            },
          },
        ],
      },
      {
        use: [
          { loader: MiniCssExtractPlugin.loader },
          { loader: 'css-loader', options: { sourceMap: true } },
          { loader: 'resolve-url-loader', options: { sourceMap: true } },
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                includePaths: [ '.', './src', './node_modules' ],
              },
              sourceMap: true,
            },
          },
        ],
      },
    ],
  },
];

module.exports = [
  {
    entry: './src/host-preload/index.js',
    target: 'electron-main',
    output: {
      path: path.join(__dirname, 'build'),
      filename: 'host-preload.js'
    },
    node: {
      __dirname: false,
    },
    externals: {
      process: 'process'
    },
    plugins: [
      new DefinePlugin({
        WEBPACK_BUNDLE: true,
      }),
    ],
  },
  {
    entry: './src/guest-preload/index.js',
    target: 'electron-main',
    output: {
      path: path.join(__dirname, 'build'),
      filename: 'guest-preload.js'
    },
    node: {
      __dirname: false,
    },
    externals: {
      process: 'process'
    },
    plugins: [
      new DefinePlugin({
        WEBPACK_BUNDLE: true,
      }),
    ],
  },
  {
    entry: './src/keybinding-preload/index.js',
    target: 'electron-main',
    output: {
      path: path.join(__dirname, 'build'),
      filename: 'keybinding-preload.js'
    },
    node: {
      __dirname: false,
    },
    externals: {
      process: 'process'
    },
    plugins: [
      new DefinePlugin({
        WEBPACK_BUNDLE: true,
      }),
    ],
  },
  {
    entry: './src/keybinding/index.ts',
    target: 'web',
    output: {
      path: path.join(__dirname, 'build'),
      filename: 'keybinding.js'
    },
    node: {
      __dirname: false,
    },
    externals: {
      process: 'process'
    },
    module: {
      rules: tsRules,
    },
    resolve: {
      extensions: [ '.js', '.jsx', '.ts', '.tsx', '.mjs' ],
    },
    plugins: [
      new DefinePlugin({
        WEBPACK_BUNDLE: true,
      }),
      new MiniCssExtractPlugin({
        filename: 'keybinding.css',
        chunkFilename: 'development' === 'development' ? '[id].css' : '[id].[hash].css',
      }),
      new HtmlWebpackPlugin({
        filename: 'keybinding.html',
        template: 'src/keybinding/index.hbs',
        inject: 'head',
        minify: {
          removeAttributeQuotes: true,
          collapseWhitespace: true,
          html5: true,
          minifyCSS: true,
          removeComments: true,
          removeEmptyAttributes: true,
        },
        hash: true,
        cacheBreaker: Math.round(Math.random() * 1024 * 8),
      }),
    ],
  },
];
