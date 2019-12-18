var main = function () {
  var reste = this;

  var config = {},
      requestHeaders = [];

  function log(message) {
    if (config.debug && message) {
      console.log("::RESTE::" + message);
    }
  }

  function warn(message) {
    if (config.debug && message) {
      console.warn("::RESTE::" + message);
    }
  }

  reste.config = function (args) {
    config = args;

    reste.setRequestHeaders(config.requestHeaders);

    config.methods.forEach(function (method) {
      reste.addMethod(method);
    });

    if (config.models) {
      initModels();

      config.models.forEach(function (model) {
        reste.addModel(model);
      });
    }
  };

  reste.setUrl = function (url) {
    config.url = url || config.url;
  };

  reste.getUrl = function () {
    return config.url;
  };

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

    if (args.url.indexOf("http") >= 0) {
      log(args.url);
    } else {
      log(config.url ? config.url + args.url : args.url);
    }

    if (args.params) {
      log(JSON.stringify(args.params));
    }

    var http = Ti.Network.createHTTPClient();

    reste.clearCookies = function () {
      if (http) http.clearCookies(config.url);
    };

    var formEncode = false;

    http.setTimeout(config.timeout || 10000);

    if (_.has(config, "validatesSecureCertificate")) {
      http.setValidatesSecureCertificate(config.validatesSecureCertificate);
    }

    if (args.url.indexOf("http") >= 0) {
      http.open(args.method, args.url);
    } else {
      http.open(args.method, config.url ? config.url + args.url : args.url);
    }

    requestHeaders.forEach(function (header) {
      if (header.name === "Content-Type" && header.value === "application/x-www-form-urlencoded") {
        formEncode = true;
      }

      http.setRequestHeader(header.name, typeof header.value === "function" ? header.value() : header.value);

      log("Setting global header - " + header.name + ": " + (typeof header.value === "function" ? header.value() : header.value));
    });

    if (args.headers) {
      for (var header in args.headers) {
        if (header === "Content-Type" && args.headers[header] === "application/x-www-form-urlencoded") {
          formEncode = true;
        } else if (header === "Content-Type" && args.headers[header] === "application/json") {
          formEncode = false;
        }

        http.setRequestHeader(header, typeof args.headers[header] === "function" ? args.headers[header]() : args.headers[header]);

        log("Setting local header - " + header + ": " + (typeof args.headers[header] === "function" ? args.headers[header]() : args.headers[header]));
      }
    }

    if (_.has(config, "securityManager")) {
      http.setSecurityManager(config.securityManager);
    }

    http.onload = function (e) {
      var response = parseJSON(http.responseText);

      if (config.onLoad) {
        config.onLoad(response, onLoad);
      } else if (onLoad) {
        onLoad(response);
      }
    };

    http.onerror = function (e) {
      e.url = args.url;

      function retry() {
        log("Retrying...");
        return makeHttpRequest(args, onLoad, onError);
      }

      var error;

      if (config.errorsAsObjects) {
        error = e;
        error.content = parseJSON(http.responseText);
        warn("Errors will be returned as objects.");
      } else {
        error = parseJSON(http.responseText);
        warn("Future versions of RESTe will return errors as objects. Use config.errorsAsObjects = true to support this now and update your apps!");
      }

      if (onError) {
        onError(error, retry);
      } else if (config.onError) {
        config.onError(error, retry);
      } else if (onLoad) {
        onLoad(error, retry);
      } else {
        throw "RESTe :: No error handler / callback for: " + args.url;
      }
    };

    function send() {
      log(args.params);

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

    args.params = args.params || {};

    var beforePost = args.beforePost || config.beforePost;
    var beforeSend = args.beforeSend || config.beforeSend;

    if (args.method === "POST" && typeof beforePost === "function") {

      beforePost(args.params, function (e) {
        args.params = e;
        send();
      });
    } else if (typeof beforeSend === "function") {
      beforeSend(args.params, function (e) {
        args.params = e;
        send();
      });
    } else {
      send();
    }
    return http;
  }

  reste.setRequestHeaders = function (headers) {
    requestHeaders = [];
    for (var header in headers) {
      requestHeaders.push({
        name: header,
        value: headers[header] });
    }
  };

  reste.changeRequestHeader = function (header) {
    var changed = false;

    _.each(requestHeaders, function (item) {
      if (item.name === Object.keys(header)[0]) {
        item.value = header[Object.keys(header)[0]];
        changed = true;
      }
    });
    if (!changed) {
      requestHeaders.push({
        name: Object.keys(header)[0],
        value: header[Object.keys(header)[0]] });
    }
  };

  reste.removeRequestHeaderItem = function (delItem) {
    requestHeaders = _.filter(requestHeaders, function (item) {
      return !(item.name === delItem);
    });
  };

  reste.addMethod = function (args) {
    log(args.requestHeaders);

    if (reste[args.name]) {
      throw "RESTe :: method already defined and will be overwritten: " + args.name;
    }

    reste[args.name] = function (params, onLoad, onError) {
      var body,
          method = "GET",
          url,
          deferred;

      if (args.post) method = "POST";
      if (args.get) method = "GET";
      if (args.put) method = "PUT";
      if (args.delete) method = "DELETE";

      url = args[method.toLowerCase()] || args.get;

      if (config.Q && !onLoad && typeof params != "function") {
        deferred = config.Q.defer();
        onLoad = deferred.resolve;
        onError = deferred.reject;
      }

      if (!onLoad && typeof params === "function") {
        onLoad = params;
      } else {
        for (var param in params) {
          if (param === "body") {
            body = params[param];
          } else {
            while (url.indexOf("<" + param + ">") >= 0) {
              if (typeof params[param] === "object") {
                url = url.replace("<" + param + ">", JSON.stringify(params[param]));
              } else {
                url = url.replace("<" + param + ">", params[param]);
              }
            }
          }
        }
      }

      if (args.onLoad) {
        var originalOnLoad = onLoad;

        onLoad = function (e) {
          args.onLoad(e, originalOnLoad);
        };
      }

      if (args.onError) {
        onError = function (e) {
          args.onError(e, onLoad);
        };
      }

      if (args.expects) {
        args.expects.forEach(function (expectedParam) {
          if (method === "POST" && params.body ? !params.body[expectedParam] : !params[expectedParam]) {
            throw "RESTe :: missing parameter " + expectedParam + " for method " + args.name;
          }
        });

        return makeHttpRequest({
          url: url,
          method: method,
          params: body,
          headers: args.requestHeaders || args.headers,
          beforePost: args.beforePost,
          beforeSend: args.beforeSend }, onLoad, onError);
      } else {
        var m,
            missing = [],
            re = /(\<\w*\>)/g;

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
          return makeHttpRequest({
            url: url,
            method: method,
            params: body,
            headers: args.requestHeaders || args.headers,
            beforePost: args.beforePost,
            beforeSend: args.beforeSend }, onLoad, onError);
        }
      }

      if (deferred) {
        return deferred.promise;
      }
    };
  };

  reste.createModel = function (name, attributes) {
    var model = new Backbone.Model(attributes);

    if (reste.modelConfig && reste.modelConfig[name] && reste.modelConfig[name].transform) {
      model.transform = function (model, transform) {
        if (transform) {
          this.__transform = transform(this);
        } else {
          this.__transform = reste.modelConfig[name].transform(this);
        }
        return this.__transform;
      };
    } else {
      model.transform = function (model, transform) {
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

  reste.createCollection = function (name, content) {
    if (!Alloy.Collections[name]) {
      Alloy.Collections[name] = new Backbone.Collection();
    }

    if (content instanceof Array) {
      Alloy.Collections[name].reset(content);

      Alloy.Collections[name].fetch = function () {
        Alloy.Collections[name].trigger("change");
      };
    } else {
      throw "No Array specified for createCollection";
    }
  };

  function initModels() {
    reste.addModel = function (args) {
      reste.modelConfig = reste.modelConfig || {};

      reste.modelConfig[args.name] = args;

      var model = Backbone.Model.extend({
        _type: args.name,
        _method: args.name,
        transform: function (model, transform) {
          if (transform) {
            this.__transform = transform(this);
          } else if (args.transform) {
            this.__transform = args.transform(this);
          } else {
            this.__transform = this.toJSON();
          }
          return this.__transform;
        } });

      if (args.collections) {
        args.collections.forEach(function (collection) {
          Alloy.Collections[collection.name] = Alloy.Collections[collection.name] || new Backbone.Collection();
          Alloy.Collections[collection.name]._type = args.name;
          Alloy.Collections[collection.name]._name = collection.name;
          Alloy.Collections[collection.name].model = model;
        });
      }
    };

    Backbone.sync = function (method, model, options) {
      log("Backbone.sync: " + method + " " + model._type);

      var modelConfig = reste.modelConfig[model._type];
      var body, onError;

      if (model instanceof Backbone.Collection && modelConfig && modelConfig.collections) {
        var collectionConfig = _.where(modelConfig.collections, {
          name: model._name })[0];

        var methodCall = reste[collectionConfig.read];

        methodCall(options, function (response) {
          if (response != null && response != undefined) {
            if (response[collectionConfig.content]) {
              response[collectionConfig.content].forEach(function (item) {
                item.id = item[modelConfig.id];
              });

              if (options.success) options.success(response[collectionConfig.content]);

              Alloy.Collections[collectionConfig.name].trigger("sync");
            } else {
              response.forEach(function (item) {
                item.id = item[modelConfig.id];
              });

              if (options.success) options.success(response);

              Alloy.Collections[collectionConfig.name].trigger("sync");
            }
          }
        }, function (response) {
          if (options.error) {
            options.error(response);
          }
        });
      } else if (model instanceof Backbone.Model) {
        if (model.get("id") && method === "create") {
          method = "update";
        }

        if (method === "update") {
          params = {};

          if (options.changes) {
            params.body = {};
            for (var attr in options.changes) {
              params.body[attr] = model.get(attr);
            }
          }

          params[modelConfig.id] = model.get("id");

          params.body = params.body || model.toJSON();

          delete params.body.id;
          delete params.body[modelConfig.id];

          if (modelConfig.beforeUpdate) {
            params.body = modelConfig.beforeUpdate(params.body);
          }

          options.error ? onError = function (e) {
            options.error(e);
          } : onError = null;

          reste[modelConfig.update](params, function (e) {
            if (e.code > 200) {
              onError(e);
            } else {
              options.success(e);
            }
          }, onError);
        }

        if (method === "read") {
          if (modelConfig.read) {
            if (model[modelConfig.id]) {
              options[modelConfig.id] = model[modelConfig.id];
            } else if (model.get("id")) {
              options[modelConfig.id] = model.get("id");
            }

            options.error ? onError = function (e) {
              options.error(e);
            } : onError = null;

            reste[modelConfig.read](options, function (e) {
              if (modelConfig.content) {
                var result = e[modelConfig.content];

                if (result.length === 1) {
                  options.success(result[0]);
                } else {
                  options.success(result);
                }
              } else {
                if (e.code > 200) {
                  onError(e);
                } else {
                  options.success(e);
                }
              }
            }, onError);
          }
        }

        if (method === "create") {
          body = model.toJSON();

          delete body.id;
          delete body[modelConfig.id];

          if (modelConfig.beforeDelete) {
            body = modelConfig.beforeDelete(body);
          }

          options.error ? onError = function (e) {
            options.error(e);
          } : onError = null;

          reste[modelConfig.create]({
            body: body }, function (e) {

            if (e.code > 200) {
              onError(e);
            } else {
              e.id = e[modelConfig.id];
              model.set("id", e[modelConfig.id]);
              options.success(e);
            }
          }, onError);
        }

        if (method === "delete") {
          body = {};

          body[modelConfig.id] = model.get("id");
          body.body = model.toJSON();

          if (modelConfig.beforeCreate) {
            body.body = modelConfig.beforeCreate(body.body);
          }

          options.error ? onError = function (e) {
            options.error(e);
          } : onError = null;

          reste[modelConfig.delete](body, function (e) {
            if (e.code > 200) {
              onError(e);
            } else {
              options.success(e);
            }
          }, onError);
        }
      }
    };
  }

  return reste;
};

module.exports = main;