const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackShellPlugin = require('webpack-shell-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ChromeExtensionReloader = require('webpack-chrome-extension-reloader');
const TerserPlugin = require('terser-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');

const config = {
  mode: process.env.NODE_ENV,
  context: `${__dirname}/src`,
  entry: {
    background: './background/background.js',
    content: './content/content.js',
    devtools: './devtools/devtools.js',
    options: './options/options.js',
    'panel/panel': './panel/panel.js',
    'popup/popup': './popup/popup.js',
  },
  output: {
    path: `${__dirname}/dist`,
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.js', '.vue'],
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loaders: 'vue-loader',
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      {
        test: /\.sass$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader?indentedSyntax'],
      },
      {
        test: /\.(png|jpg|gif)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          publicPath: '../',
        },
      },
      {
        test: /\.(svg|ico|eot|woff|ttf|woff2)$/,
        loader: 'file-loader',
        options: {
          name: '/fonts/[name].[ext]',
        },
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyWebpackPlugin([
      { from: 'icons', to: 'icons', ignore: ['icon.svg', 'icon_bw.svg', 'icon_32_colour.png'] },
      { from: 'popup/popup.html', to: 'popup/popup.html' },
      { from: 'devtools/devtools-page.html', to: 'devtools-page.html' },
      { from: 'panel/panel.html', to: 'panel/panel.html' },
      { from: 'options/options.html', to: 'options.html' },
      {
        from: 'manifest.json',
        to: 'manifest.json',
        transform: content => {
          const jsonContent = JSON.parse(content);

          if (config.mode === 'development') {
            jsonContent.content_security_policy = "script-src 'self' 'unsafe-eval'; object-src 'self'";
          }

          return JSON.stringify(jsonContent, null, 2);
        },
      },
    ]),
    new WebpackShellPlugin({
      onBuildEnd: ['node scripts/remove-evals.js'],
    }),
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        test: /\.js($|\?)/i,
        terserOptions: {
          compress: {
            drop_console: true,
          },
        },
      }),
    ],
  },
};

if (config.mode === 'production') {
  config.plugins = (config.plugins || []).concat([
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"production"',
      },
    }),
  ]);
}

if (process.env.LAUNCH === 'true') {
  config.plugins = (config.plugins || []).concat([
    new WebpackShellPlugin({
      onBuildEnd: ['node scripts/launch-chrome.js'],
    }),
  ]);
}

if (process.env.HMR === 'true') {
  config.plugins = (config.plugins || []).concat([new ChromeExtensionReloader()]);
}

module.exports = config;
