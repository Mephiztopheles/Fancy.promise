class State {
}
State.PENDING = "PENDING";
State.SUCCESS = "SUCCESS";
State.REJECTED = "REJECTED";
State.CANCELED = "CANCELED";
class PromiseState {
    constructor() {
        this.status = State.PENDING;
        this.pending = [];
        this.scheduled = false;
    }
}
let id = 1;
export default class FancyPromise {
    constructor(chain) {
        this.state = new PromiseState();
        if (chain == null)
            this.id = id++;
        else
            this.id = chain.id;
    }
    reject(reason) {
        if (this.state.status != State.PENDING)
            return;
        this.state.value = reason;
        this.state.status = State.REJECTED;
        FancyPromise.schedule(this);
    }
    resolve(data) {
        if (this.state.status != State.PENDING)
            return;
        try {
            this.state.value = data;
            this.state.status = State.SUCCESS;
            FancyPromise.schedule(this);
        }
        catch (e) {
            this.reject(e);
        }
    }
    cancel() {
        if (this.state.status == State.PENDING)
            this.state.status = State.CANCELED;
        return this;
    }
    then(success, error, finish) {
        if (success == null && error == null)
            return this;
        const promise = new FancyPromise(this);
        this.state.pending.push({
            promise,
            [State.SUCCESS]: success,
            [State.REJECTED]: error,
            finish
        });
        if (this.state.status != State.PENDING && this.state.status != State.CANCELED)
            FancyPromise.schedule(this);
        return promise;
    }
    static all(promises) {
        let result = new FancyPromise(), counter = 0, results = [];
        promises.forEach((promise, index) => {
            counter++;
            FancyPromise.when(promise).then(function (value) {
                results[index] = value;
                if (!(--counter))
                    result.resolve(results);
            }, (reason) => {
                result.reject(reason);
            });
        });
        if (counter === 0)
            result.resolve(results);
        return result;
    }
    static reject(reason) {
        let promise = new FancyPromise();
        promise.reject(reason);
        return promise;
    }
    static resolve(data) {
        let promise = new FancyPromise();
        promise.resolve(data);
        return promise;
    }
    static when(value, callback, onError, onFinished) {
        const result = new FancyPromise();
        if (value instanceof FancyPromise)
            value.then(val => result.resolve(val), err => result.reject(err));
        else
            result.resolve(value);
        return result.then(callback, onError, onFinished);
    }
    static workQueue(promise) {
        const state = promise.state;
        let pending = state.pending;
        /*
         * set scheduled to false to let the next schedule check the value again
         */
        state.scheduled = false;
        state.pending = [];
        try {
            pending.forEach((entry) => {
                const promise = entry.promise;
                const callback = entry[state.status];
                try {
                    if (typeof callback === "function")
                        promise.resolve(callback(state.value));
                    else if (state.status === State.SUCCESS)
                        promise.resolve(state.value);
                    else
                        promise.reject(state.value);
                }
                catch (e) {
                    promise.reject(e);
                }
                finally {
                    if (entry.finish != null)
                        entry.finish(state.value);
                }
            });
        }
        finally {
            --queueSize;
            if (queueSize === 0)
                this.checkForExceptions();
        }
    }
    static checkForExceptions() {
        while (!queueSize && checkQueue.length) {
            let toCheck = checkQueue.shift();
            if (!isStateExceptionHandled(toCheck)) {
                markStateExceptionHandled(toCheck);
                let errorMessage = "Possibly unhandled rejection";
                if (isError(toCheck.value))
                    console.error(toCheck.value, errorMessage);
                else
                    console.error(toCheck, errorMessage);
            }
        }
    }
    static schedule(promise) {
        const state = promise.state;
        if (!state.pending.length && state.status === State.REJECTED) {
            /*
             * The while statement is executed with a small delay
             */
            if (queueSize === 0 && checkQueue.length === 0)
                this.checkForExceptions();
            checkQueue.push(state);
        }
        if (state.scheduled || !state.pending)
            return;
        state.scheduled = true;
        ++queueSize;
        this.workQueue(promise);
    }
}
let queueSize = 0;
const checkQueue = [];
function isError(value) {
    const tag = toString.call(value);
    switch (tag) {
        case "[object Error]":
        case "[object Exception]":
        case "[object DOMException]":
            return true;
        default:
            return value instanceof Error;
    }
}
function isStateExceptionHandled(state) {
    return !!state.exceptionHandled;
}
function markStateExceptionHandled(state) {
    state.exceptionHandled = true;
}
//# sourceMappingURL=FancyPromise.js.map