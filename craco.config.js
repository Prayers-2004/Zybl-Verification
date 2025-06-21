module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Ignore source map warnings from face-api.js and firebase
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
        },
        // Ignore Firebase-related warnings
        {
          module: /node_modules[\\/]@firebase/,
          message: /Failed to parse source map/
        },
        {
          module: /node_modules[\\/]firebase/,
          message: /Failed to parse source map/
        }
      ];
      
      // Required for Firebase to work properly in some environments
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "fs": false,
        "path": false,
        "crypto": false,
        "os": false
      };
      
      return webpackConfig;
    }
  }
};
