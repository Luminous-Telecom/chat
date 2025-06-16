module.exports = function (ctx) {
  return {
    build: {
      chainWebpack (chain) {
        // Configuração específica para o Chart.js
        chain.module
          .rule('js')
          .exclude
          .add(/node_modules\/(?!chart\.js)/)
          .end()
          .use('babel-loader')
          .tap(options => {
            if (!options) options = {}
            if (!options.presets) options.presets = []

            // Adicionar preset-env se não existir
            const hasPresetEnv = options.presets.some(preset =>
              Array.isArray(preset) && preset[0] === '@babel/preset-env'
            )

            if (!hasPresetEnv) {
              options.presets.push([
                '@babel/preset-env',
                {
                  targets: {
                    browsers: ['last 2 versions', 'not dead']
                  },
                  modules: false,
                  useBuiltIns: 'usage',
                  corejs: 3,
                  loose: true
                }
              ])
            }

            // Adicionar plugin para campos estáticos de classe
            if (!options.plugins) options.plugins = []
            options.plugins.push('@babel/plugin-proposal-class-properties')

            return options
          })
      }
    }
  }
}
