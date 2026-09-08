const { resolve } = require('path');
var glob = require('glob');
var path = require('path');
var express = require('express');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ESBuildMinifyPlugin } = require('esbuild-loader');
const { ProvidePlugin, BannerPlugin } = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const CopyPlugin = require('copy-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';
const isDevelopment = !isProd;

const fastRefresh = isDevelopment ? new ReactRefreshWebpackPlugin() : null;

const SANDBOX_SUFFIX = '-sandbox';

const config = {
  mode: isProd ? 'production' : 'development',
  entry: glob.sync('./src/widgets/**/*.tsx').reduce((obj, el) => {
    const rel = path
      .relative('src/widgets', el)
      .replace(/\.[tj]sx?$/, '')
      .replace(/\\/g, '/');

    obj[rel] = el;
    obj[`${rel}${SANDBOX_SUFFIX}`] = el;
    return obj;
  }, {}),

  output: {
    path: resolve(__dirname, 'dist'),
    filename: `[name].js`,
    publicPath: '',
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|jsx|js)?$/,
        loader: 'esbuild-loader',
        options: {
          loader: 'tsx',
          target: 'es2020',
          minify: false,
        },
      },
      {
        test: /\.css$/i,
        use: [
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { url: false } },
          'postcss-loader',
        ],
      },
    ],
  },
  plugins: [
    isDevelopment
      ? undefined
      : new MiniCssExtractPlugin({
          filename: '[name].css',
        }),
    new HtmlWebpackPlugin({
      templateContent: `
      <body></body>
      <script type="text/javascript">
      const urlSearchParams = new URLSearchParams(window.location.search);
      const queryParams = Object.fromEntries(urlSearchParams.entries());
      const widgetName = queryParams["widgetName"];
      if (widgetName == undefined) {document.body.innerHTML+="Widget ID not specified."}

      const s = document.createElement('script');
      s.type = "module";
      s.src = widgetName+"${SANDBOX_SUFFIX}.js";
      document.body.appendChild(s);
      </script>
    `,
      filename: 'index.html',
      inject: false,
    }),
    new ProvidePlugin({
      React: 'react',
      reactDOM: 'react-dom',
    }),
    new BannerPlugin({
      banner: (file) => {
        return !file.chunk.name.includes(SANDBOX_SUFFIX) ? 'const IMPORT_META=import.meta;' : '';
      },
      raw: true,
    }),
    new CopyPlugin({
      patterns: [
        { from: 'public', to: '' },
        { from: 'README.md', to: '' },
      ],
    }),
    fastRefresh,
  ].filter(Boolean),
};

if (isProd) {
  config.optimization = {
    minimize: isProd,
    minimizer: [new ESBuildMinifyPlugin()],
  };
} else {
  // for more information, see https://webpack.js.org/configuration/dev-server
  config.devServer = {
    port: 8080,
    open: true,
    hot: true,
    compress: true,
    watchFiles: ['src/*'],
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Allow-Headers': 'baggage, sentry-trace',
    },
    setupMiddlewares: (middlewares, devServer) => {
      const app = devServer.app;
      const allowedOrigins = new Set([
        'https://remnote.com',
        'https://www.remnote.com',
        'http://localhost:8080',
      ]);

      app.use('/bridge', (req, res, next) => {
        const origin = req.headers.origin;
        if (origin && allowedOrigins.has(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        if (req.method === 'OPTIONS') {
          res.sendStatus(204);
          return;
        }
        next();
      });

      app.get('/bridge/health', (_req, res) => {
        res.json({ ready: Boolean(process.env.OPENAI_API_KEY) });
      });

      app.post('/bridge/openai', express.json({ limit: '1mb' }), async (req, res) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          res.status(503).json({
            error: { message: 'A chave da OpenAI não está configurada no serviço local.' },
          });
          return;
        }

        try {
          const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
          });
          const body = await response.text();
          res.status(response.status).type('application/json').send(body);
        } catch {
          res.status(502).json({
            error: { message: 'O serviço local não conseguiu acessar a OpenAI.' },
          });
        }
      });

      return middlewares;
    },
  };
}

module.exports = config;
