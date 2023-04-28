const { SyncHook } = require('tapable');

const syncHook = new SyncHook(['name', 'age']);

syncHook.tap('事件1', (name, age) => {
    console.log('事件1', name, age);
})

syncHook.tap('事件2', (name, age) => {
    console.log('事件2', name, age);
})

syncHook.tap('事件3', (name, age) => {
    console.log('事件3', name, age);
})

syncHook.tap('事件4', (name, age) => {
    console.log('事件4', name, age);
})

syncHook.call("小石头", 20);