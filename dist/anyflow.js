"use strict";
/* Copyright (c) 2018~2999 - Cologler <skyoflw@gmail.com> */
Object.defineProperty(exports, "__esModule", { value: true });
class ExecuteContext {
    constructor() {
        this._state = {};
    }
    get state() {
        return this._state;
    }
    getState(key) {
        return this._state[key];
    }
    setState(key, value, readonly = false) {
        if (readonly) {
            Object.defineProperty(this._state, key, { value });
        }
        else {
            this._state[key] = value;
        }
    }
}
class MiddlewareInvoker {
    constructor(_factorys, _context, _next = null) {
        this._factorys = _factorys;
        this._context = _context;
        this._next = _next;
    }
    getNext(index) {
        // create next
        // middleware.invoke() maybe return null/undefined,
        // so I use array to ensure `nextPromise || ?` work only call once.
        let nextPromise = null;
        let next = () => {
            nextPromise = nextPromise || [this.next(index + 1)];
            return nextPromise[0];
        };
        return next;
    }
    next(index = 0) {
        if (index === this._factorys.length) {
            return Promise.resolve(undefined);
        }
        let next = this.getNext(index);
        this._context.hasNext = index + 1 !== this._factorys.length;
        if (!this._context.hasNext && this._next) {
            this._context.hasNext = true;
            next = this._next;
        }
        const factory = this._factorys[index];
        const middleware = factory.get();
        return middleware.invoke(this._context, next);
    }
}
function toMiddleware(obj) {
    if (obj === null) {
        return null;
    }
    if (typeof obj === 'function') {
        return {
            invoke: obj
        };
    }
    else {
        return obj;
    }
}
class App {
    constructor() {
        this._factorys = [];
    }
    use(obj) {
        let middleware = toMiddleware(obj);
        let factory = {
            get: () => middleware
        };
        this._factorys.push(factory);
        return this;
    }
    useFactory(factory) {
        this._factorys.push(factory);
        return this;
    }
    branch(condition) {
        if (typeof condition !== 'function') {
            throw new Error('condition must be a function.');
        }
        const m = new Branch(condition, null);
        this.use(m);
        return m;
    }
    /**
     * if state is a object, assign to context.state.
     * otherwise assign to context.state.value.
     *
     * @template R
     * @param {object} [state=undefined]
     * @returns {Promise<R>}
     * @memberof App
     */
    run(state = undefined) {
        const context = new ExecuteContext();
        if (state !== undefined) {
            if (typeof state === 'object') {
                Object.assign(context.state, state);
            }
            else {
                context.setState('value', state);
            }
        }
        const invoker = new MiddlewareInvoker(this._factorys.slice(), context);
        return invoker.next();
    }
}
exports.App = App;
class Branch extends App {
    constructor(_condition, _else) {
        super();
        this._condition = _condition;
        this._else = _else;
    }
    invoke(context, next) {
        if (this._condition === null || this._condition(context)) {
            // else branch or condition branch matched
            const invoker = new MiddlewareInvoker(this._factorys.slice(), context, next);
            return invoker.next();
        }
        if (this._condition !== null && this._else) {
            return this._else.invoke(context, next);
        }
        return next();
    }
    else() {
        if (this._else === null) {
            this._else = new Branch(null, this);
        }
        return this._else;
    }
}
function autonext(callback) {
    return async (c, n) => {
        await callback(c);
        return await n();
    };
}
exports.autonext = autonext;
