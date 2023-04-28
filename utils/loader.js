function loader1(source) {
    console.log('source: ', source);
    // return source + "//给你的代码加点注释：loader1";
    return source;
}

function loader2(source) {
    // return source + "//给你的代码加点注释：loader2";
    return source;
}

module.exports = {
    loader1,
    loader2,
}