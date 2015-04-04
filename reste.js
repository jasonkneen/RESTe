// setup vars
var config = {},
    requestHeaders = []

// generic log handler in DEV mode
function log(message) {
    if (config.debug) {
        console.log(message);
    }
}

// Intercept sync to handle collections / models


Backbone.sync = function(method, model, options) {
    var modelConfig = exports[model._method].model

    // if this is a collection, get the data and complete
    if (model instanceof Backbone.Collection) {

        exports[model._method](function(e) {

            if (options.success) {

                e[modelConfig.collection.content].forEach(function(model) {
                    model.id = model.id || model[modelConfig.id];
                });

                options.success(e.results);
            }
        });

    } else if (model instanceof Backbone.Model) {

        if (method == "update") {
            var body = {};

            // update!
            body[modelConfig.id] = model.id;
            body.body = model;

            exports[modelConfig.update](body, function(e) {
                options.success(e);
            });
        }

        if (method == "create") {
            exports[modelConfig.create]({
                body: model
            }, function(e) {
                e.id = e[modelConfig.id];
                options.success(e);
            });
        }

        if (method == "delete") {
            var body = {};

            body[modelConfig.id] = model.id;
            body.body = model;

            exports[modelConfig.delete](body, function(e) {
                options.success(e);
            });
        }
    }
}


// sets up the config, headers, adds methods
exports.config = function(args) {

    config = args;

    exports.setRequestHeaders(config.requestHeaders);

    config.methods.forEach(function(method) {
        exports.addMethod(method);
    });
};

// makes an http request to a URL, as a POST / GET / currently, 
// passing params and callback
function makeHttpRequest(args, onLoad, onError) {

    function isJSON(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

    function parseJSON(text) {
        if (isJSON(text)) {
            return JSON.parse(text)
        } else {
            return text;
        }
    }

    // debug the url
    log("::RESTE:: " + (config.url ? config.url + args.url : args.url));

    if (args.params) {
        log("::RESTE:: " + JSON.stringify(args.params));
    }

    // create a client
    var http = Ti.Network.createHTTPClient();

    var formEncode = false;

    //set some defaults
    http.setTimeout(config.timeout || 10000);

    // open the url
    http.open(args.method, (config.url ? config.url + args.url : args.url));

    // load up any global request headers
    requestHeaders.forEach(function(header) {
        if (header.name == "Content-Type" && header.value == "application/x-www-form-urlencoded") {
            formEncode = true;
        }

        http.setRequestHeader(header.name, typeof header.value == "function" ? header.value : header.value);
    });

    // non-global headers
    if (args.headers) {
        // load up any request headers
        for (header in args.headers) {

            if (header == "Content-Type" && args.headers[header] == "application/x-www-form-urlencoded") {
                formEncode = true;
            }

            http.setRequestHeader(header, typeof args.headers[header] == "function" ? args.headers[header]() : args.headers[header]);
        }
    }

    // events
    http.onload = function(e) {

        // get the response parsed
        var response = parseJSON(http.responseText);

        if (config.onLoad) {
            config.onLoad(response, onLoad);
        } else if (onLoad) {
            onLoad(response);
        }
    };

    http.onerror = function(e) {
        e.url = args.url;

        if (onError) {
            // if we have an onError method, use it            
            onError(parseJSON(http.responseText))
        } else if (config.onError) {
            // otherwise fallback to the one specified in config                        
            config.onError(parseJSON(http.responseText))
        } else if (onLoad) {
            // otherwise revert to the onLoad callback
            onLoad(parseJSON(http.responseText))
        } else {
            // and if that's not specified, error!
            throw "RESTe :: No error handler / callback for: " + args.url;
        }
    };

    function send() {
        // go
        if (args.params && (args.method === "POST" || args.method === "PUT")) {
            if (formEncode) {
                http.send(args.params);
            } else {
                http.send(JSON.stringify(args.params));
            }

        } else {
            http.send();
        }
    }

    if (args.method == "POST" && config.beforePost) {

        // initialise empty params in case it's undefined
        args.params = args.params || {};

        config.beforePost(args.params, function(e) {

            args.params = e;
        });

        send();
    } else {

        send();
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
    console.log(args.requestHeaders)



    exports[args.name] = function(params, onLoad) {

        var body,
            method = "GET",
            url,
            onError;

        if (args.post) method = "POST";
        if (args.get) method = "GET";
        if (args.put) method = "PUT";
        if (args.delete) method = "DELETE";

        url = args[method.toLowerCase()] || args.get;

        if (!onLoad && typeof(params) == "function") {
            onLoad = params;
        } else {
            for (param in params) {
                if (param === "body") {
                    body = params[param];
                } else {
                    while (url.indexOf("<" + param + ">") >= 0) {
                        url = url.replace("<" + param + ">", params[param]);
                    }
                }
            }
        }

        if (args.onLoad) {
            // save the original callback
            var originalOnLoad = onLoad;

            // change the callback to be the one specified
            onLoad = function(e) {
                args.onLoad(e, originalOnLoad);
            }
        }

        if (args.onError) {
            // change the callback to be the one specified
            onError = function(e) {
                args.onError(e, onLoad);
            }
        }

        if (args.expects) {
            // look for explicityly required parameters
            args.expects.forEach(function(expectedParam) {
                if ((method == "POST" && params.body) ? !params.body[expectedParam] : !params[expectedParam]) {
                    throw "RESTe :: missing parameter " + expectedParam + " for method " + args.name
                }
            });

            makeHttpRequest({
                url: url,
                method: method,
                params: body,
                headers: args.requestHeaders || args.headers,
            }, onLoad, onError);

        } else {
            //work out which parameters are required
            var m, missing = [],
                re = /(\<\w*\>)/g;

            while ((m = re.exec(url)) != null) {
                if (m.index === re.lastIndex) {
                    re.lastIndex++;
                }

                missing.push(m[0]);
            }

            if (missing.length > 0) {
                throw "RESTe :: missing parameter/s " + missing + " for method " + args.name
            } else {
                makeHttpRequest({
                    url: url,
                    method: method,
                    params: body,
                    headers: args.requestHeaders || args.headers,
                }, onLoad, onError);
            }
        }
    };

    // add support for backbone collections
    if (args.model) {

        // storing a reference to the model definition in config
        exports[args.name].model = args.model;

        Alloy._createModel = Alloy.createModel;
        Alloy.createModel = function(name, attributes) {
            try {
                return Alloy._createModel(name, attributes);
            } catch (err) {
                return exports.createModel(name, attributes);
            }
        }

        exports.createModel = function(name, attributes) {
            var model = new Backbone.Model(attributes);

            model._type = name;
            model._method = args.name;

            return model;
        };

        if (args.model.collection && args.model.collection.name) {
            Alloy.Collections[args.model.collection.name] = Alloy.Collections[args.model.collection.name] || new Backbone.Collection();
            Alloy.Collections[args.model.collection.name]._method = args.name;

            // create a model definition and associate it with the collection
            if (args.model && args.model.name) {
                Alloy.Collections[args.model.collection.name].model = Backbone.Model.extend({
                    _type: args.model.name,
                    _method: args.name
                });
            }
        }

    }
};
