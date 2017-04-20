var main = function() {

    var reste = this,
        _ = require('alloy/underscore')._;

    // setup vars
    var config = {},
        requestHeaders = [];

    // generic log handler in DEV mode
    function log(message) {
        if (config.debug) {
            console.log("::RESTE:: " + message);
        }
    }

    // generic warning handler
    function warn(message) {
        console.warn("::RESTE:: " + message);
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

    reste.setUrl = function(url) {
        config.url = url || config.url;
    };

    reste.getUrl = function() {
        return config.url;
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
        if (args.url.indexOf("http") >= 0) {
            log(args.url);
        } else {
            log(config.url ? config.url + args.url : args.url);
        }

        if (args.params) {
            log(JSON.stringify(args.params));
        }


        // create a client
        var http = Ti.Network.createHTTPClient();

        reste.clearCookies = function() {
            if (http) http.clearCookies(config.url);
        };

        var formEncode = false;

        //set some defaults
        http.setTimeout(config.timeout || 10000);

        if (_.has(config, 'validatesSecureCertificate')) {
            http.setValidatesSecureCertificate(config.validatesSecureCertificate);
        }

        // open the url and check if we're overrding with
        // a local http based url

        if (args.url.indexOf("http") >= 0) {
            http.open(args.method, args.url);
        } else {
            http.open(args.method, (config.url ? config.url + args.url : args.url));
        }

        // load up any global request headers
        requestHeaders.forEach(function(header) {
            if (header.name == "Content-Type" && header.value == "application/x-www-form-urlencoded") {
                formEncode = true;
            }

            http.setRequestHeader(header.name, typeof header.value == "function" ? header.value() : header.value);

            log("Setting global header - " + header.name + ": " + (typeof header.value == "function" ? header.value() : header.value));
        });

        // non-global headers
        if (args.headers) {
            // load up any request headers
            for (var header in args.headers) {
                if (header == "Content-Type" && args.headers[header] == "application/x-www-form-urlencoded") {
                    formEncode = true;
                } else if (header == "Content-Type" && args.headers[header] == "application/json") {
                    formEncode = false;
                }

                http.setRequestHeader(header, typeof args.headers[header] == "function" ? args.headers[header]() : args.headers[header]);

                log("Setting local header - " + header + ": " + (typeof args.headers[header] == "function" ? args.headers[header]() : args.headers[header]));
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

            function retry() {
                log("Retrying...");
                makeHttpRequest(args, onLoad, onError);
            }

            var error;

            if (config.errorsAsObjects) {
                error = e;
                error['content'] = parseJSON(http.responseText);
                warn("Errors will be returned as objects.");
            } else {
                error = parseJSON(http.responseText);
                warn("Future versions of RESTe will return errors as objects. Use config.errorsAsObjects = true to support this now and update your apps!");
            }

            // if we have an onError method defined locally, use it
            if (onError) {
                // if we have a global onError, we'll pass it on too do we can still use it locally if we want to
                if (config.onError) {
                    onError(error, retry, config.onError);
                } else {
                    onError(error, retry);
                }
            } else if (config.onError) {
                // otherwise fallback to the one specified in config
                config.onError(error, retry);
            } else if (onLoad) {
                // otherwise revert to the onLoad callback
                onLoad(error, retry);
            } else {
                // and if reste's not specified, error!
                throw "RESTe :: No error handler / callback for: " + args.url;
            }
        };

        function send() {
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

        // beforePost Hook
        if (args.method == "POST" && config.beforePost && _.isFunction(config.beforePost)) {
            // initialise empty params in case it's undefined
            args.params = args.params || {};
            config.beforePost(args.params, function(e) {
                args.params = e;
            });
            if (config.beforeLoad && _.isFunction(config.beforeLoad)) {
                // Combined with beforeLoad Hook
                config.beforeLoad(function(){
                    send();
                });
            } else {
                // no beforeLoad Hook
                send();
            }
        // Only beforeLoad Hook
        } else if (config.beforeLoad && _.isFunction(config.beforeLoad)) {
            config.beforeLoad(function(){
                send();
            });
        // No Hooks at all
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

    // change/add requestHeader
    reste.changeRequestHeader = function(header) {
        var changed = false;

        _.each(requestHeaders, function(item) {
            if (item.name == Object.keys(header)[0]) {
                item.value = header[Object.keys(header)[0]];
                changed = true;
            }
        });
        if (! changed) {
            // add it
            requestHeaders.push({
                name: Object.keys(header)[0],
                value: header[Object.keys(header)[0]]
            });
        }
    };

    // removes an item from the requestHeader
    reste.removeRequestHeaderItem = function(delItem) {
        requestHeaders = _.filter(requestHeaders, function(item) {
            return !(item.name == delItem);
        });
    };

    // add a new method
    reste.addMethod = function(args) {
        reste[args.name] = function(params, onLoad, onError) {

            var body,
                method = "GET",
                url,
                deferred;

            if (args.post) method = "POST";
            if (args.get) method = "GET";
            if (args.put) method = "PUT";
            if (args.delete) method = "DELETE";

            url = args[method.toLowerCase()] || args.get;

            if (config.Q && !onLoad && typeof(params) != "function") {
                deferred = config.Q.defer();
                onLoad = deferred.resolve;
                onError = deferred.reject;
            }

            if (! onLoad && typeof(params) == "function") {
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

            if (deferred) {
                return deferred.promise;
            }
        };
    };

    // Hacktastic section where we override the Alloy.createModel method
    // only call and run this section if we need it; if models are defined

    reste.createModel = function(name, attributes) {
        var model = new Backbone.Model(attributes);

        // if we have a config based transfor for th emodel
        // then attach this to the model, or create a default
        if (reste.modelConfig && reste.modelConfig[name] && reste.modelConfig[name].transform) {
            model.transform = function(model, transform) {
                if (transform) {
                    this.__transform = transform(this);
                } else {
                    this.__transform = reste.modelConfig[name].transform(this);
                }
                return this.__transform;
            };
        } else {
            model.transform = function(model, transform) {
                if (transform) {
                    this.__transform = transform(this);
                } else {
                    this.__transform = this.toJSON();
                }
                return this.__transform;
            };
        }

        model._type = name;
        return model;
    };

    reste.createCollection = function(name, content) {

        if (! Alloy.Collections[name]) {
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
                _method: args.name,
                transform: function(model, transform) {
                    if (transform) {
                        this.__transform = transform(this);
                    } else if (args.transform) {
                        this.__transform = args.transform(this);
                    } else {
                        this.__transform = this.toJSON();
                    }
                    return this.__transform;
                }
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

        // Need to override this to avoid wrapping the error handler
        Backbone.wrapError = function(onError, originalModel, options) {
            return onError || null;
        };
        // Intercept sync to handle collections / models
        Backbone.sync = function(method, model, options) {
            log("Backbone.sync: " + method + " " + model._type);

            var modelConfig = reste.modelConfig[model._type];
            var body;

            // if this is a collection, get the data and complete
            if (model instanceof Backbone.Collection) {
                var collectionConfig = _.where(modelConfig.collections, {
                    name: model._name
                })[0];

                var methodCall = reste[collectionConfig.read];
                // success
                var onLoad = function(response) {
                    if (options.success && response[collectionConfig.content]) {
                        // check if we have a return property
                        if (response[collectionConfig.content]) {
                            response[collectionConfig.content].forEach(function(item) {
                                item.id = item[modelConfig.id];
                            });
                            options.success(response[collectionConfig.content]);
                            Alloy.Collections[collectionConfig.name].trigger("sync");
                        } else {
                            // otherwise just return an array with the response
                            response.forEach(function(item) {
                                item.id = item[modelConfig.id];
                            });
                            options.success(response);
                            Alloy.Collections[collectionConfig.name].trigger("sync");
                        }
                    }
                };
                // error
                var onError = options.error ? function(e){ options.error(e); } : null;
                // Call
                methodCall(options, onLoad, onError);

            } else if (model instanceof Backbone.Model) {

                if (model.id && method == "create") {
                    method = "update";
                }

                if (method == "update") {
                    params = {};

                    // if we're specifying attributes to changes
                    // just update those
                    if (options.changes) {
                        params.body = {};
                        for (var attr in options.changes) {
                            params.body[attr] = model.get(attr);
                        }
                    }

                    // update!
                    params[modelConfig.id] = model.id;

                    params.body = params.body || model.toJSON();

                    // remove any ids from the body
                    delete params.body.id;
                    delete params.body[modelConfig.id];

                    // change to change the attributes before sending
                    if (modelConfig.beforeUpdate) {
                        params.body = modelConfig.beforeUpdate(params.body);
                    }

                    // success
                    var onLoad = function(e) {
                        // calls error handler if we have it defined and 201 returned
                        if (e.code > 200) {
                            if (options.error) {
                                options.error(e);
                            }
                        } else {
                            // otherwise pass to success
                            options.success(e);
                        }
                    };
                    // error
                    var onError = options.error ? function(e){ options.error(e); } : null;
                    // Call
                    reste[modelConfig.update](params, onLoad, onError);
                }

                if (method == "read") {

                    if (modelConfig.read) {

                        if (model[modelConfig.id]) {
                            options[modelConfig.id] = model[modelConfig.id];
                        } else if (model.id) {
                            options[modelConfig.id] = model.id;
                        }

                        // success
                        var onLoad = function(e) {
                            if (modelConfig.content) {
                                var results = e[modelConfig.content];
                                if (results.length == 1) {
                                    options.success(results[0]);
                                }
                            } else {
                                // calls error handler if we have it defined and 201+ returned
                                if (e.code > 200) {
                                    if (options.error) {
                                        options.error(e);
                                    }
                                } else {
                                    // otherwise pass to success
                                    options.success(e);
                                }
                            }
                        };
                        // error
                        var onError = options.error ? function(e){ options.error(e); } : null;
                        // Call
                        reste[modelConfig.read](options, onLoad, onError);
                    }
                }

                if (method == "create") {

                    body = model.toJSON();

                    // remove any ids from the body
                    delete body.id;
                    delete body[modelConfig.id];

                    // change to change the attributes before sending
                    if (modelConfig.beforeDelete) {
                        body = modelConfig.beforeDelete(body);
                    }

                    var onLoad = function(e) {
                        // calls error handler if we have it defined and 201+ returned
                        if (e.code > 200) {
                            if (options.error) {
                                options.error(e);
                            }
                        } else {
                            // otherwise pass to success
                            e.id = e[modelConfig.id];
                            options.success(e);
                        }
                    };
                    // error
                    var onError = options.error ? function(e){ options.error(e); } : null;
                    // Call
                    reste[modelConfig.create]({ body: body }, onLoad, onError);
                }

                if (method == "delete") {

                    body = {};

                    body[modelConfig.id] = model.id;
                    body.body = model.toJSON();

                    // change to change the attributes before sending
                    if (modelConfig.beforeCreate) {
                        body.body = modelConfig.beforeCreate(body.body);
                    }

                    // success
                    var onLoad = function(e) {
                        // calls error handler if we have it defined and 201+ returned
                        if (e.code > 200) {
                            if (options.error) {
                                options.error(e);
                            }
                        } else {
                            // otherwise pass to success
                            options.success(e);
                        }
                    };
                    // error
                    var onError = options.error ? function(e){ options.error(e); } : null;
                    // Call
                    reste[modelConfig.delete](body, onLoad, onError);
                }
            }
        };
    }

    return reste;
};

module.exports = main;
