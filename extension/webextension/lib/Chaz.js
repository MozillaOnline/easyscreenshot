
const Chaz = function(W) {
class Utility {}

Utility.develop = false;
Utility.allowScriptType = ["background", "content", "privileged"];
Utility.matchAddress = function(target, address) {
    return Array.isArray(target)
        && Array.isArray(address)
        && address.every((item, index) => {
            return item === target[index];
        })
    ;
};
Utility.parseScriptType = function(str) {
    if (Array.isArray(str)) return str;
    var arr = str.split(".").reverse();
    if (
        !Utility.allowScriptType.includes(arr[0])
    ) {
        throw new Error(`type "${arr[0]}" is not allow`);
    }
    return arr;
};
Utility.log = function() {
    this.develop && console.warn(...arguments);
};
Utility.QuickData = null;
Utility.setDefaultTabId = function(message) {
    if ("tab_id" in message) return;
    if (Utility.QuickData === null) {
        throw new Error("Utility.QuickData is null");
    }
    message["tab_id"] = this.QuickData.tabId;
};
Utility.getActivatedTabId = async function() {
    var tabs = await browser.tabs.query({active: true});
    return tabs[0].id;
};
class ChazEvent {
    constructor() {
        this._events = {};
    }
    /**
     * @param {string} eventType
     * @param {function} listener
     * @param {boolean} once
     * */
    on(eventType, listener, {once} = {}) {
        var event = new ChazEvent.Event(listener);
        this.addEvent(eventType, event);

        if (once === true) {
            let that = this;
            event.execFn = function() {
                that.off(eventType, listener);
                return listener(...arguments);
            };
        }
    }
    /**
     * @param {string} eventType
     * @param {function} listener
     * @param {Object} [options]
     * */
    one(eventType, listener, options = {}) {
        var args = Array.from(arguments);
        args[2] = arguments[2] || {};
        args[2].once = true;
        return this.on(...args);
    }
    /**
     * @param {string} eventType
     * @param {function} listener
     * */
    off(eventType, listener) {
        var event = new ChazEvent.Event(listener);
        return this.removeEvent(eventType, event);
    }
    /**
     * 等待一个事件发生
     * 可以添加一个验证器，来验证这个事件是否是自己等待的，
     * 若checker返回false继续等待，若返回true则resolved
     * @param {string} eventType
     * @param {function} [checker] - 验证器
     * */
    wait(eventType, checker = () => true) {
        return new Promise(resolve => {
            var symbol = Symbol(`${eventType}.waiter`);
            var event = new ChazEvent.Event(symbol, (...args) => {
                if (checker(...args)) {
                    this.off(eventType, symbol);
                    resolve();
                }
            });
            this.addEvent(eventType, event);
        });
    }
    /**
     * 返回当前事件的监听器数量
     * @return {Number}
     * */
    has(eventType) {
        if (eventType in this._events) {
            return this._events[eventType].length;
        }
            return 0;

    }
}

// 以下是内部方法

/**
 * @param {string} type
 * @param {ChazEvent.Event} event
 * */
ChazEvent.prototype.addEvent = function(type, event) {
    if (!(type in this._events)) {
        this._events[type] = [];
    }
    // 检测重复添加
    if (
        this._events[type].findIndex(
            e => e.originFn === event.originFn
        ) === -1
    ) {
        this._events[type].push(event);
    }
};
/**
 * @param {string} type
 * @param {ChazEvent.Event} event
 * */
ChazEvent.prototype.removeEvent = function(type, event) {
    if (!(type in this._events)) {
        return false;
    }
    var index = this._events[type].findIndex(e => e.originFn === event.originFn);
    if (index !== -1) {
        this._events[type].splice(index, 1);
        return true;
    }
    return false;
};
ChazEvent.prototype.execEventAll = function(type, argn) {
    if (!(type in this._events)) {
        return false;
    }
    var promises = this._events[type]
        .map(ce => {
            var val = this.execEvent(ce.execFn, argn);
            if ([undefined, null].includes(val)) {
                return null;
            }
                return val;

        })
        .filter(v => v !== null)
    ;
    if (promises.length === 0) return Promise.resolve();
    return Promise.race(promises);
};
ChazEvent.prototype.execEvent = function(fn, args = []) {
    return fn(...args);
};




ChazEvent.Event = class {
    constructor(originFn, execFn = originFn) {
        this.originFn = originFn;
        this.execFn   = execFn;
    }
};


class Message {
    constructor({from = Message.defaultFrom, to, eventType, data, tabId} = {}) {
        this.chaz = true;

        this.from = Utility.parseScriptType(from);
        this.to   = Utility.parseScriptType(to);
        this.event_type = eventType;
        this.tab_id = (typeof tabId === "number") ? String(tabId) : tabId;
        this.data = data;

        this.sender = undefined;// 用于路由过程保存原始sender

        if (
            !this.event_type
            || this.from.length === 0
            || this.to.length === 0
        ) throw new Error("abnormal message init:" + JSON.stringify(arguments[0]));

        // 删除值为undefined的属性
        // 并没有什么依赖，只是想增强可读性
        for (let key of Object.keys(this)) {
            if (this[key] === undefined) delete this[key];
        }
    }
}
Message.defaultFrom = null;
Message.is = function(message) {
    return message
        && typeof message === "object"
        && "chaz" in message
        && message.chaz === true
        && "from" in message
        && Array.isArray(message.from)
        && "to" in message
        && Array.isArray(message.to)
        && "event_type" in message
        && typeof message["event_type"] === "string"
    ;
};
class InsideMessage extends Message {// todo: internal
    constructor(info) {
        if (!InsideMessage.allowType.includes(info.eventType)) {
            throw new Error(`event_type "${info.eventType}" is not support in InsideMessage."`)
        }
        super(...arguments);
        this.inside = true;
    }
}
InsideMessage.allowType = ["hello", "transfer"];
/** @param {ChazCommunication.InsideMessage} message*/
InsideMessage.is = function(message) {
    return Message.is(message)
        && "inside" in message
        && message.inside === true
        && InsideMessage.allowType.includes(message.event_type)
    ;
};
class Sender {
    constructor(self, target) {
        this.target = Utility.parseScriptType(target);
        this.self   = Utility.parseScriptType(self);
    }
    send(eventType, data, tabId) {
        var message = new Message({
            from: this.self,
            to: this.target,
            eventType,
            tabId,
            data,
        });
        return Sender.sendMessage(message);
    }
}


Sender.sendMessage = async function(message) {
    switch (`${message.from[0]} -> ${message.to[0]}`) {
        case "content -> content":
            Utility.setDefaultTabId(message);
            return this.sendTransferMessage(message);
        case "privileged -> content":
            Utility.setDefaultTabId(message);
        case "background -> content":
        case "background -> privileged":
            return this.sendMessageUseTabs(message);


        case "privileged -> privileged":
        case "content -> privileged":
            Utility.setDefaultTabId(message);
        case "content -> background":
        case "privileged -> background":
            return this.sendMessageUseRuntime(message);
        default:
            throw new Error("unknown message", message);
    }
};

Sender.sendTransferMessage = function(message) {
    var im = new InsideMessage({
        to: "background",
        from: message.from,
        data: message,
        eventType: "transfer"
    });
    return Sender.sendMessage(im);
};
Sender.sendMessageUseTabs = async function(message) {
    if (!Number.isNaN(+message["tab_id"])) {
        return browser.tabs.sendMessage(+message["tab_id"], message);
    } // 广播发送
        var tabs = await browser.tabs.query({});
        // 广播发送情况略复杂
        // 由于有可能有的tab没有listener，导致reject
        // 所以这里当所有tabs均reject则reject，但有任何一个tab resolve则resolve
        return new Promise(function(resolve, reject) {
            var rejectContent = 0;
            var rejectMap = {};
            var rejectCallback = function(error, tabId) {
                rejectContent++;
                if (error instanceof Error) {
                    rejectMap[tabId] = error.toString();
                }
                if (rejectContent === tabs.length) {
                    if (Object.keys(rejectMap) === 0) {
                        resolve();// 没有任何一个标签响应
                    } else {
                        reject(`some tabs throw error:${JSON.stringify(rejectMap, null, 4)}`);
                    }
                }
            };
            var resolveCallback = function(data) {
                if (typeof data !== undefined) {
                    resolve(data);
                } else {
                    rejectCallback();
                }
            };
            tabs.forEach(
                tab => (
                    browser.tabs.sendMessage(tab.id, message)
                    .then(resolveCallback)
                    .catch(e => rejectCallback(e, tab.id))
                )
            );
        });

};
Sender.sendMessageUseRuntime = async function(message) {
    return browser.runtime.sendMessage(message);
};

class Receiver extends ChazEvent {
    constructor(self, target) {
        super();
        this.self   = Utility.parseScriptType(self);
        this.target = Utility.parseScriptType(target);
        this.listen();
    }
    static init(type) {
        if (Receiver.called) {
            throw new Error("you called init().");
        }

        type = Utility.parseScriptType(type);
        Receiver.called = true;

        switch (type[0]) {
            case "background":
                return this.backgroundInit(type);
            case "content":
                return this.contentInit(type);
            case "privileged":
                return this.privilegedInit(type);
            default:
                throw new Error(`could not init used ${type[0]}`);
        }
    }
}

Receiver.prototype.listen = function() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (InsideMessage.is(message)) return false;
        if (
            !Message.is(message)
            || !Utility.matchAddress(this.self, message.to)
            || !Utility.matchAddress(message.from, this.target)
        ) {
            Utility.log(
                this.self,
                "->",
                this.target,
                "ignore message",
                message,
                {
                    match_from: Utility.matchAddress(message.from, this.target),
                    match_to: Utility.matchAddress(message.to, this.self),
                    is: Message.is(message),
                }
            );
            return false;
        }
        switch (`${message.from[0]} -> ${message.to[0]}`) {
            case "content -> content":
                if ("sender" in message) {
                    sender = message.sender;
                }
            case "content -> privileged":
            case "privileged -> content":
            case "privileged -> privileged":
                if (// 校验tab_id决定是否消费这个报文 tab
                    message["tab_id"] !== "*"
                    && message["tab_id"] !== Utility.QuickData.tabId
                ) {
                    Utility.log(
                        this.self, "->", this.target,
                        `tab id is ${Utility.QuickData.tabId} but message`,
                        message
                    );
                    return false;
                }
        }
        if (this.has(message["event_type"]) === 0) {
            Utility.log(this.self, "no listener", message);
            return false;
        }
        // Firefox bug
        // return this.execEventAll(
        //     message['event_type'],
        //     [message.data ,sender ,message]
        // );
        this.execEventAll(
            message["event_type"],
            [message.data, sender, message]
        ).then(sendResponse);
        return true;
    });
};

Receiver.called = false;

Receiver.backgroundInit = async function(type) {
    browser.runtime.onMessage.addListener(function(message, sender) {
        if (
                !InsideMessage.is(message)
                || !Utility.matchAddress(message.to, Utility.parseScriptType("background"))
        ) return undefined;
        switch (message["event_type"]) {
            case "hello":
                return async function() {
                    var tabId = null;
                    if (!("tab" in sender)) {
                        tabId = await Utility.getActivatedTabId();
                    } else {
                        tabId = sender.tab.id;
                    }
                    return {tabId};
                }();
            case "transfer":
                message.data.sender = sender;// 用于劫持sender
                Utility.log("transfer message", message);
                return Sender.sendMessageUseTabs(message.data);
            default:
                Utility.log(Receiver.self, "ignore isInsideMessage", message);
                return undefined;
        }
    });
    return true;
};
Receiver.contentInit = async function(type) {
    return Utility.QuickData = await Sender.sendMessage(new InsideMessage({
        eventType: "hello",
        to: "background",
        from: type,
    }));
};
/** @alias ChazCommunication.contentInit*/
Receiver.privilegedInit = function() {
    return this.contentInit(...arguments);
};

class Chaz {
    constructor(target) {
        if (Chaz.selfType === null) {
            throw new Error("you must called Chaz.init() before new Chaz");
        }
        this.sender = new Sender(Chaz.selfType, target);
        this.reseiver = new Receiver(Chaz.selfType, target);
    }
    send() {
        return this.sender.send(...arguments);
    }
    on() {
        return this.reseiver.on(...arguments);
    }
    wait() {
        return this.reseiver.wait(...arguments);
    }
    one() {
        return this.reseiver.one(...arguments);
    }
    static init(self) {
        Chaz.selfType = Utility.parseScriptType(self);
        Message.defaultFrom = self;
        return Receiver.init(self);
    }
    static get Utility() {
        return Utility;
    }
    static get QuickData() {
        return Utility.QuickData;
    }
}
Chaz.selfType = null;



return Chaz;
}(window);
