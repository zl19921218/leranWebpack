const path = require("path");
const fs = require("fs");

const parser = require("@babel/parser");
let types = require("@babel/types");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;

function getSource(chunk) {
    
}

function tryExtensions(modulePath, extensions) {
    if (fs.existsSync(modulePath)) {
        return modulePath;
    }

    for (let i = 0; i < extensions?.length; i++) {
        let filePath = modulePath + extensions[i];
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }

    throw new Error(`无法找到${modulePath}`);
}

function toUnixPath(filePath) {
    return filePath.replace(/\\/g, "/");
}

const baseDir = toUnixPath(process.cwd());

class Compilation {
    constructor(webpackOptions) {
        this.options = webpackOptions;

        this.modules = []; // 本次编译所有生成出来的模块
        this.chunks = []; // 本次编译产出的所有代码块，入口模块和依赖的模块打包在一起为代码块
        this.assets = []; // 本次编译产出的资源文件
        this.fileDependencies = []; // 本次打包涉及到的文件，这里主要是为了实现watch模式下监听文件的变化，文件发生变化后会重新编译
    }

    buildModule(name, modulePath) {
        // 6.2.1 读取模块内容，获取源代码
        let sourceCode = fs.readFileSync(modulePath, "utf-8");

        // buildModule最终会返回一个modules模块对象，每个模块都会有一个id,id是相对于根目录的相对路径
        let moduleId = "./" + path.posix.relative(baseDir, modulePath);

        // 6.2.2 创建模块对象
        let module = {
            id: moduleId,
            names: [name],
            dependencies: [], // 模块依赖
            _source: "", // 模块代码
        };

        // 6.2.3 找到对应的 `Loader` 对源代码进行翻译和替换
        let loaders = [];
        let { rules = [] } = this.options.module;

        rules.forEach((rule) => {
            let { test } = rule;

            // 如果模块的路径和正则匹配，就把此规则对应的loader添加到loader数组中
            if (modulePath.match(test)) {
                loaders.push(...rule.use);
            }

            sourceCode = loaders.reduceRight((code, loader) => {
                return loader(code);
            }, sourceCode);

            //通过loader翻译后的内容一定得是js内容，因为最后得走我们babel-parse，只有js才能成编译AST
            //第七步：找出此模块所依赖的模块，再对依赖模块进行编译
            //7.1：先把源代码编译成 [AST](https://astexplorer.net/)

            let ast = parser.parse(sourceCode, { sourceType: "module" });

            traverse(ast, {
                CallExpression: (nodePath) => {
                    const { node } = nodePath;

                    //7.2：在 `AST` 中查找 `require` 语句，找出依赖的模块名称和绝对路径
                    if (node.callee.name === "require") {
                        //获取依赖的模块
                        let depModuleName = node.arguments[0].value;
                        //获取当前正在编译的模所在的目录
                        let dirName = path.posix.dirname(modulePath);
                        //获取依赖模块的绝对路径
                        let depModulePath = path.posix.join(
                            dirName,
                            depModuleName
                        );
                        //获取配置中的extensions
                        let extensions = this.options.resolve?.extensions || [
                            "js",
                        ];

                        // 尝试添加后缀，找到一个真实在硬盘上存在的文件
                        depModulePath = tryExtensions(
                            depModulePath,
                            extensions
                        );

                        // 7.3：将依赖模块的绝对路径 push 到 `this.fileDependencies` 中
                        this.fileDependencies.push(depModulePath);

                        // 7.4：生成依赖模块的`模块 id`
                        let depModuleId =
                            "./" + path.posix.relative(baseDir, depModulePath);

                        // 7.5：修改语法结构，把依赖的模块改为依赖`模块 id` require("./name")=>require("./src/name.js")
                        node.arguments = [types.stringLiteral(depModuleId)];

                        // 7.6：将依赖模块的信息 push 到该模块的 `dependencies` 属性中
                        module.dependencies.push({
                            depModuleId,
                            depModulePath,
                        });
                    }
                },
            });

            // 7.7：生成新代码，并把转译后的源代码放到 `module._source` 属性上
            let { code } = generator(ast);
            module._source = code;

            //7.8：对依赖模块进行编译（对 `module 对象`中的 `dependencies` 进行递归执行 `buildModule` ）
            module.dependencies.forEach(({ depModuleId, depModulePath }) => {
                let existModule = this.modules.find(
                    (item) => item.id === depModuleId
                );

                if (existModule) {
                    existModule.names.push(name);
                } else {
                    let depModule = this.buildModule(name, depModulePath);
                    this.modules.push(depModule);
                }
            });
        });
        // 7.10：等依赖模块全部编译完成后，返回入口模块的 `module` 对象
        return module;
    }

    build(callback) {
        // 第五步：根据配置文件中的`entry`配置项找到所有的入口
        let entry = {};

        if (typeof this.options.entry === "string") {
            entry.main = this.options.entry;
        } else {
            entry = this.options.entry;
        }

        // 第六步：从入口文件出发，调用配置的 `loader` 规则，对各模块进行编译
        for (let entryName in entry) {
            let entryFilePath = path.posix.join(baseDir, entry[entryName]);

            // 6.1 把入口文件的绝对路径添加到依赖数组（`this.fileDependencies`）中，记录此次编译依赖的
            this.fileDependencies.push(entryFilePath);

            // 6.2 得到入口模块的的 `module` 对象 （里面放着该模块的路径、依赖模块、源代码等）
            let entryModule = this.buildModule(entryName, entryFilePath);

            // 6.3 将生成的入口文件 `module` 对象 push 进 `this.modules` 中
            this.modules.push(entryModule);

            // 第八步：等所有模块都编译完成后，根据模块之间的依赖关系，组装代码块 `chunk`（一般来说，每个入口文件会对应一个代码块`chunk`，每个代码块`chunk`里面会放着本入口模块和它依赖的模块）
            let chunk = {
                name: entryName,
                entryModule,
                modules: this.modules.filter(item => item.names.includes(entryName)),
            }

            this.chunks.push(chunk);
        }

        callback();
    }
}

module.exports = Compilation;
