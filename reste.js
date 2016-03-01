var main = function() {

    var reste = this;

    // setup vars
    var config = {},
        requestHeaders = [];

    // generic log handler in DEV mode
    function log(message) {
        if (config.debug) {
            console.log(message);
        }
    }

    // sets up the config, headers, adds methods
    reste.config = function(args) {

        config = args;

        reste.setRequestHeaders(config.requestHeaders);

        config.methods.forEach(function(method) {
            reste.addMethod(method);
        });

        if (config.models) {

            initModels();

            config.models.forEach(function(model) {
                reste.addModel(model);
            });
        }

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
                return JSON.parse(text);
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
            for (var header in args.headers) {

                if (header == "Content-Type" && args.headers[header] == "application/x-www-form-urlencoded") {
                    formEncode = true;
                } else if (header == "Content-Type" && args.headers[header] == "application/json") {
                    formEncode = false;
                } else {
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
                onError(parseJSON(http.responseText));
            } else if (config.onError) {
                // otherwise fallback to the one specified in config
                config.onError(parseJSON(http.responseText));
            } else if (onLoad) {
                // otherwise revert to the onLoad callback
                onLoad(parseJSON(http.responseText));
            } else {
                // and if reste's not specified, error!
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
    reste.setRequestHeaders = function(headers) {
        requestHeaders = [];
        for (var header in headers) {
            requestHeaders.push({
                name: header,
                value: headers[header]
            });
        }
    };

    // add a new method
    reste.addMethod = function(args) {
        console.log(args.requestHeaders);

        reste[args.name] = function(params, onLoad, onError) {

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
                for (var param in params) {
                    if (param === "body") {
                        body = params[param];
                    } else {
                        while (url.indexOf("<" + param + ">") >= 0) {
                            if (typeof params[param] == "object") {
                                url = url.replace("<" + param + ">", JSON.stringify(params[param]));
                            } else {
                                url = url.replace("<" + param + ">", params[param]);
                            }
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
                };
            }

            if (args.onError) {
                // change the callback to be the one specified
                onError = function(e) {
                    args.onError(e, onLoad);
                };
            }

            if (args.expects) {
                // look for explicityly required parameters
                args.expects.forEach(function(expectedParam) {
                    if ((method == "POST" && params.body) ? !params.body[expectedParam] : !params[expectedParam]) {
                        throw "RESTe :: missing parameter " + expectedParam + " for method " + args.name;
                    }
                });

                makeHttpRequest({
                    url: url,
                    method: method,
                    params: body,
                    headers: args.requestHeaders || args.headers,
                }, onLoad, onError);

            } else {

                var m, missing = [],
                    re = /(\<\w*\>)/g;

                //work out which parameters are required
                if (config.autoValidateParams) {

                    while ((m = re.exec(url)) !== null) {
                        if (m.index === re.lastIndex) {
                            re.lastIndex++;
                        }

                        missing.push(m[0]);
                    }

                }

                if (missing.length > 0) {
                    throw "RESTe :: missing parameter/s " + missing + " for method " + args.name;
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
    };

    // Hacktastic section where we override the Alloy.createModel method
    // only call and run this section if we need it; if models are defined

    reste.createModel = function(name, attributes) {
        var model = new Backbone.Model(attributes);
        model._type = name;
        return model;
    };

    reste.createCollection = function(name, content) {

        if (!Alloy.Collections[name]) {
            Alloy.Collections[name] = new Backbone.Collection();
        }

        if (content instanceof Array) {
            Alloy.Collections[name].reset(content);
        } else {
            throw "No Array specified for createCollection";
        }

    };

    function initModels() {

        // add a new model definition
        reste.addModel = function(args) {
            reste.modelConfig = reste.modelConfig || {};

            // storing a reference to the model definition in config
            reste.modelConfig[args.name] = args;

            var model = Backbone.Model.extend({
                _type: args.name,
                _method: args.name
            });

            if (args.collections) {

                args.collections.forEach(function(collection) {
                    Alloy.Collections[collection.name] = Alloy.Collections[collection.name] || new Backbone.Collection();
                    Alloy.Collections[collection.name]._type = args.name;
                    Alloy.Collections[collection.name]._name = collection.name;
                    Alloy.Collections[collection.name].model = model;
                });
            }
        };

        // Intercept sync to handle collections / models
        Backbone.sync = function(method, model, options) {
            console.log(method + model._type);

            var modelConfig = reste.modelConfig[model._type];
            var body;

            // if this is a collection, get the data and complete
            if (model instanceof Backbone.Collection) {
                var collectionConfig = _.where(modelConfig.collections, {
                    name: model._name
                })[0];

                var methodCall = reste[collectionConfig.read];

                methodCall(options, function(response) {

                    if (options.success && response[collectionConfig.content]) {

                        // check if we have a return property
                        if (response[collectionConfig.content]) {

                            response[collectionConfig.content].forEach(function(item) {
                                item.id = item[modelConfig.id];
                            });

                            options.success(response[collectionConfig.content]);
                        } else {
                            // otherwise just return an array with the response
                            response.forEach(function(item) {
                                item.id = item[modelConfig.id];
                            });

                            options.success(response);
                        }

                    }
                });

            } else if (model instanceof Backbone.Model) {

                if (method == "update") {
                    body = {};

                    // update!
                    body[modelConfig.id] = model.id;
                    body.body = model;

                    reste[modelConfig.update](body, function(e) {
                        options.success(e);
                    });
                }

                if (method == "read") {

                    if (modelConfig.read) {

                        reste[modelConfig.read](options, function(e) {

                            if (modelConfig.content) {

                                var results = e[modelConfig.content];

                                if (results.length == 1) {
                                    options.success(results[0]);
                                }
                            } else {

                                options.success(e);
                            }
                        });
                    }
                }

                if (method == "create") {
                    reste[modelConfig.create]({
                        body: model
                    }, function(e) {
                        e.id = e[modelConfig.id];
                        options.success(e);
                    });
                }

                if (method == "delete") {
                    body = {};

                    body[modelConfig.id] = model.id;
                    body.body = model;
                    reste[modelConfig.delete](body, function(e) {
                        options.success(e);
                    });
                }
            }
        };
    }

    return reste;
};

module.exports = main;
