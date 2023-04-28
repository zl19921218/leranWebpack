const Compiler = require('./compiler');

function webpack(webpackOptions) {
    const compiler = new Compiler(webpackOptions);

    // 注册插件
    const { plugins } = webpackOptions;
    for (let plugin of plugins) {
        plugin.apply(compiler);
    }

    return compiler;
}

module.exports = {
    webpack,
};
