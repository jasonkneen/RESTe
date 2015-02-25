// setup vars
var config = {},
    requestHeaders = [];

// generic log handler in DEV mode
function log(message) {
    if (ENV_DEV) {
        console.log(message);
    }
}

// sets up the config, headers, adds methods
exports.config = function(args) {

    config.baseUrl = args.url;
    config.timeout = args.timeout;
    config.onError = args.onError;
    config.onLoad = args.onLoad;

    exports.setRequestHeaders(args.requestHeaders);

    args.methods.forEach(function(method) {
        exports.addMethod(method);
    });
};

// makes an http request to a URL, as a POST / GET / currently, 
// passing params and callback
function makeHttpRequest(url, method, params, callback) {

    // debug the url
    log("::RESTE:: " + (config.baseUrl ? config.baseUrl + url : url));

    // create a client
    var http = Ti.Network.createHTTPClient();

    //set some defaults
    http.setTimeout(config.timeout || 10000);

    // open the url
    http.open(method, (config.baseUrl ? config.baseUrl + url : url));

    // load up any request headers
    requestHeaders.forEach(function(header) {
        http.setRequestHeader(header.name, header.value);
    });

    // events
    http.onload = function(e) {

        if (config.onLoad) {
            config.onLoad(JSON.parse(http.responseText), callback);
        } else {
            callback(JSON.parse(http.responseText));
        }

    };

    http.onerror = function(e) {
        e.url = url;

        if (config.onError) {
            config.onError(JSON.parse(http.responseText))
        } else if (callback) {
            callback(JSON.parse(http.responseText))
        } else {
            throw "No error handler / callback for: " + url;
        }
    };

    // go
    if (params && method == "POST") {
        http.send(JSON.stringify(params));
    } else {
        http.send();
    }
}

// set Requestheaders
exports.setRequestHeaders = function(headers) {
    requestHeaders = [];
    for (header in headers) {
        requestHeaders.push({
            name: header,
            value: headers[header]
        });
    }
};

// add a new method
exports.addMethod = function(args) {
    exports[args.name] = function(params, callback) {

        var body, url = args.post || args.get;

        if (!callback && typeof(params) == "function") {
            callback = params;
        } else {
            for (param in params) {

                if (param === "body") {
                    body = params[param];
                } else {
                    url = url.replace("<" + param + ">", params[param]);
                }

            }
        }

        if (args.post) method = "POST";
        if (args.get) method = "GET";
        if (args.put) method = "PUT";
        if (args.delete) method = "DELETE";

        makeHttpRequest(url, method, body, callback);
    };
};
