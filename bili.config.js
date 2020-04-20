// a config file for bili [1]. currently used to inline sourcemaps (for the
// non-minified build)
//
// [1] https://github.com/egoist/bili

export default {
    extendRollupConfig (config) {
        const { outputConfig } = config

        if (outputConfig.sourcemap) {
            outputConfig.sourcemap = 'inline'
        }

        return config
    }
}
