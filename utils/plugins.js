class WebpackRunPlugin {
    apply(compiler) {
        compiler.hooks.run.tap("WebpackRunPlugin", () => {
            console.log("开始编译")
        })
    }
}

class WebpackDonePlugin {
    apply(compiler) {
        compiler.hooks.run.tap("webpackDonePlugin", () => {
            console.log("编译完成")
        })
    }
}

module.exports = {
    WebpackRunPlugin,
    WebpackDonePlugin,
}