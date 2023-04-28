const { SyncHook } = require("tapable");

const Compilation = require('./compilation');

class Compiler {
    constructor(webpackOptions) {
        this.options = webpackOptions;
        //它内部提供了很多钩子
        this.hooks = {
            run: new SyncHook(), //会在编译刚开始的时候触发此run钩子
            done: new SyncHook(), //会在编译结束的时候触发此done钩子
        };
    }

    compile(callback) {
        let compilation = new Compilation(this.options);

        compilation.build(callback);
    }

    run(callback) {
        this.hooks.run.call()

        const onComplated = () => {
            this.hooks.done.call();
        }

        this.compile(onComplated);
    }
}

module.exports = Compiler;