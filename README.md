# Fancy.promise

## Usage
```javascript
const q = new FancyPromise();

q.then( value => {
    
    console.log( "Success", value );
    return value;
}, reason => {
    
    console.error( "Failed", reason );
    return reason;
}, () => {
    console.log( "finished" )
} );
````
