const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackShellPlugin = require('webpack-shell-plugin-next');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');

const config = {
  context: `${__dirname}/src`,
  devtool: 'cheap-module-source-map',
  entry: {
    background: './background/background.js',
    content: './content/content.js',
    devtools: './devtools/devtools.js',
    options: './options/options.js',
    'panel/panel': './panel/panel.js',
    'popup/popup': './popup/popup.js',
  },
  output: {
    path: `${__dirname}/build`,
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.js', '.vue'],
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
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
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
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
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({}),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'icons',
          to: 'icons',
          globOptions: {
            ignore: ['icon.svg', 'icon_grey.svg', 'icon_128.svg'],
          },
        },
        { from: 'popup/popup.html', to: 'popup/popup.html' },
        { from: 'devtools/devtools-page.html', to: 'devtools-page.html' },
        { from: 'panel/panel.html', to: 'panel/panel.html' },
        { from: 'options/options.html', to: 'options.html' },
        { from: '../version.json', to: 'version.json' },
        { from: 'manifest.json', to: 'manifest.json'},
      ],
    }),
    new WebpackShellPlugin({
      onBuildEnd: {
        scripts: ['node scripts/remove-evals.js'],
        blocking: true,
        parallel: false,
      },
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

if (process.env.LAUNCH_CHROME === 'true') {
  config.plugins = (config.plugins || []).concat([
    new WebpackShellPlugin({
      onBuildEnd: {
        scripts: ['node scripts/launch-chrome.js'],
        blocking: false,
        parallel: false,
      },
    }),
  ]);
}

if (process.env.LAUNCH_FIREFOX === 'true') {
  config.plugins = (config.plugins || []).concat([
    new WebpackShellPlugin({
      onBuildExit: {
        scripts: ['npm run manifest:firefox && web-ext run -s build-firefox'],
      },
    }),
  ]);
}

module.exports = config;
