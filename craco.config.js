module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Ignore source map warnings from face-api.js
      webpackConfig.ignoreWarnings = [
        // Ignore warnings about missing source maps in face-api.js
        {
          module: /face-api\.js/,
          message: /Failed to parse source map/
        },
        // Ignore the "Can't resolve 'fs'" warning
        {
          module: /node_modules[\\/]face-api\.js/,
          message: /Can't resolve 'fs'/
        }
      ];
      return webpackConfig;
    }
  }
};
