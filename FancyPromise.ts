class State {
    public static readonly PENDING  = "PENDING";
    public static readonly SUCCESS  = "SUCCESS";
    public static readonly REJECTED = "REJECTED";
    public static readonly CANCELED = "CANCELED";
}

type Pending<I> = {
    promise: FancyPromise<I>;
    [ State.SUCCESS ]: ( value: I ) => any;
    [ State.REJECTED ]: ( value: any ) => any;
    finish: ( value: I ) => any;
}

class PromiseState<T> {

    public status: string = State.PENDING;
    pending: Pending<T>[] = [];
    value?: T;
    scheduled: boolean    = false;
}

let id: number = 1;

export default class FancyPromise<T> {

    public readonly id: number;
    public state: PromiseState<T> = new PromiseState();

    public constructor ( chain?: FancyPromise<any> ) {

        if ( chain == null )
            this.id = id++;
        else
            this.id = chain.id;
    }

    public reject ( reason?: any ) {

        if ( this.state.status != State.PENDING )
            return;

        this.state.value  = reason;
        this.state.status = State.REJECTED;
        FancyPromise.schedule( this );
    }

    public resolve ( data?: any ) {

        if ( this.state.status != State.PENDING )
            return;

        try {

            this.state.value  = data;
            this.state.status = State.SUCCESS;
            FancyPromise.schedule( this );

        } catch ( e ) {
            this.reject( e );
        }
    }

    public cancel (): this {

        if ( this.state.status == State.PENDING )
            this.state.status = State.CANCELED;

        return this;
    }

    public then<R> ( success: ( arg: T ) => R, error?: ( arg: any ) => any, finish?: ( arg: T ) => any ): FancyPromise<R | T> {

        if ( success == null && error == null )
            return this;

        const promise = new FancyPromise<T>( this );

        this.state.pending.push( {
            promise,
            [ State.SUCCESS ] : success,
            [ State.REJECTED ]: error,
            finish
        } );

        if ( this.state.status != State.PENDING && this.state.status != State.CANCELED )
            FancyPromise.schedule( this );

        return promise;
    }

    public static all ( promises: FancyPromise<any>[] ): FancyPromise<any[]> {

        let result  = new FancyPromise<any[]>(),
            counter = 0,
            results = [];

        promises.forEach( ( promise, index ) => {

            counter++;
            FancyPromise.when( promise ).then( function ( value ) {

                results[ index ] = value;
                if ( !( --counter ) )
                    result.resolve( results );
            }, ( reason ) => {
                result.reject( reason );
            } );
        } );

        if ( counter === 0 )
            result.resolve( results );

        return result;
    }

    public static reject ( reason?: any ): FancyPromise<any> {

        let promise = new FancyPromise<any>();
        promise.reject( reason );
        return promise;
    }

    public static resolve ( data?: any ): FancyPromise<any> {

        let promise = new FancyPromise<any>();
        promise.resolve( data );
        return promise;
    }

    public static when<T> ( value: FancyPromise<any> | T, callback?, onError?, onFinished? ) {

        const result = new FancyPromise<T>();

        if ( value instanceof FancyPromise )
            value.then( val => result.resolve( val ), err => result.reject( err ) );
        else
            result.resolve( value );

        return result.then( callback, onError, onFinished );
    }

    private static workQueue ( promise: FancyPromise<any> ) {

        const state                 = promise.state;
        let pending: Pending<any>[] = state.pending;
        /*
         * set scheduled to false to let the next schedule check the value again
         */
        state.scheduled = false;
        state.pending   = [];

        try {

            pending.forEach( ( entry: Pending<any> ) => {

                const promise  = entry.promise;
                const callback = entry[ state.status ];

                try {

                    if ( typeof callback === "function" )
                        promise.resolve( callback( state.value ) );
                    else if ( state.status === State.SUCCESS )
                        promise.resolve( state.value );
                    else
                        promise.reject( state.value );

                } catch ( e ) {
                    promise.reject( e );
                } finally {
                    if ( entry.finish != null )
                        entry.finish( state.value );
                }
            } );

        } finally {

            --queueSize;
            if ( queueSize === 0 )
                this.checkForExceptions();
        }
    }

    private static checkForExceptions () {

        while ( !queueSize && checkQueue.length ) {

            let toCheck = checkQueue.shift();
            if ( !isStateExceptionHandled( toCheck ) ) {

                markStateExceptionHandled( toCheck );
                let errorMessage = "Possibly unhandled rejection";

                if ( isError( toCheck.value ) )
                    console.error( toCheck.value, errorMessage );
                else
                    console.error( toCheck, errorMessage );
            }
        }
    }

    private static schedule ( promise: FancyPromise<any> ) {

        const state = promise.state;

        if ( !state.pending.length && state.status === State.REJECTED ) {

            /*
             * The while statement is executed with a small delay
             */
            if ( queueSize === 0 && checkQueue.length === 0 )
                this.checkForExceptions();

            checkQueue.push( state );
        }

        if ( state.scheduled || !state.pending )
            return;

        state.scheduled = true;
        ++queueSize;
        this.workQueue( promise );
    }

}

let queueSize    = 0;
const checkQueue = [];

function isError ( value ) {

    const tag = toString.call( value );
    switch ( tag ) {
        case "[object Error]":
        case "[object Exception]":
        case "[object DOMException]":
            return true;
        default:
            return value instanceof Error;
    }
}

function isStateExceptionHandled ( state ) {
    return !!state.exceptionHandled;
}

function markStateExceptionHandled ( state ) {
    state.exceptionHandled = true;
}