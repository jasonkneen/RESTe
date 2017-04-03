# RESTe

## Important note

RESTe tries to make sense of the data that comes back but currently it will have problems with invalid JSON data. If you're having any issues with data not being rendered / bound, check it's valid JSON so everything is wrapped as a string. JSON has real issues with numbers -- if it's a normal number it's fine but putting in say 000000 for a property can cause issues in parsing.

## Why?

I build a lot of apps that integrate with APIs. These could be written using the open-source Parse Server or a hosted service, but more often they are custom APIs written by another developer. I used to use a basic api.js library to handle the API integration, but this typically involved writing my own module for the API in question, requiring the api.js module, and writing specific methods for the app.

### The Old Way

So previously I'd end up writing methods like this:

```JS
exports.getPreviousLocations = function(callback) {
    var Rest = new Api(Alloy.CFG.baseURL + "users/" + token + "/previouslocations");

    Rest.get(function(e) {
        processResponse(e, function() {
            callback(e.result);
        });
    });

};
```

or a POST one like this:

```JS
exports.updateUser = function(name, email, password, callback) {
    var Rest = new Api(Alloy.CFG.baseURL + "users/" + token);

    Rest.post(JSON.stringify({
        "name" : name,
        "email" : email,
        "password" : password

    }), function(e) {

        processResponse(e, function() {
            callback(e);
        });
    });
};
```

_(The processResponse function was written to try to parse the data as it came back, check for success / results etc - but even with that I was finding myself duplicating a lot of code.)_

## A New Way - Using RESTe

The idea behind RESTe was to have a single JS library I could drop in a project, apply a simple config, and have *it* generate the methods for me.

The main things I wanted to achieve were:-

* Simple to implement in an new project, or replace an existing API layer
* Supports headers, tokens, events
* Minimal code

## Quick Start

* [Install from NPM the latest version](https://www.npmjs.com/package/reste)
or
* [Download the latest version](https://github.com/jasonkneen/reste) and place in your project (lib folder for Alloy).

Wherever you want to initialise the API interface, put this (ideally this should go in your alloy.js or index.js file):-

```javascript
var reste = require("reste");
var api = new reste();

// now we can do our one-time configure
api.config({
    debug: true, // allows logging to console of ::REST:: messages
    autoValidateParams: false, // set to true to throw errors if <param> url properties are not passed
    validatesSecureCertificate: false, // Optional: If not specified, default behaviour from http://goo.gl/sJvxzS is kept.
    timeout: 4000,
    url: "https://api.parse.com/1/",
    requestHeaders: {
        "X-Parse-Application-Id": "APPID",
        "X-Parse-REST-API-Key": "RESTID",
        "Content-Type": "application/json"
    },
    methods: [{
        name: "courses",
        post: "functions/getCourses",
        onError: function(e, callback){
        	alert("There was an error getting the courses!");
        }
    }, {
        name: "getVideos",
        get: "classes/videos"
    }, {
        name: "getVideoById",
        get: "classes/videos/<videoId>"
    }, {
        name: "addVideo",
        post: "classes/videos"
    }],
    onError: function(e, retry) {
        var dialog = Ti.UI.createAlertDialog({
            title: "Connection error",
            message: "There was an error connecting to the server, check your network connection and  retry.",
            buttonNames: ['Retry']
        });

        dialog.addEventListener("click", function() {
            retry();
        });
        dialog.show();
    },
    onLoad: function(e, callback) {
        callback(e);
    }
});
```

### onError() and onLoad()

You can pass the _optional_ **onError** and **onLoad** handlers, which will intercept the error or retrieved data before it's passed to the calling function's callback. This way you can change, test, do-what-you-want-with-it before passing it on.

Note, in the **onError** handler, you can (as of 1.2.0) also handle any network errors better -- in the example above a **retry** method is returned so you can check the error, display a specific one, or handle any network issues, and if required, issue a **retry()** which will attempt the last call again.

If you specify parameters required e.g. **videoId** then RESTe will automatically check for these in the parameters passed to the method, and raise an error if they're missing.

Once you've done all this (and assuming no errors), you'll have new methods available:

```javascript
api.getVideos(function(videos) {
    // do stuff with the videos here
});
```

Or call a method with a specific Id:

```javascript
api.getVideoById({
    videoId: "fUAM4ZFj9X"    
}, function(video) {
    // do stuff with the video
});
```

For a post request, you could do the following:

```javascript
api.addVideo({
    body: {
        categoryId: 1,
        name: "My Video"
    }
}, function(video) {
    // do stuff with the video
});
```

Here's a PUT request example, passing an id (you'd need to ensure you have a <objectId> attribute in the method definition:

```javascript
api.updateVideo({
	objectId: "123",
    body: {
        categoryId: 2,
        name: "My Video2"
    }
}, function(video) {
    // do stuff with the video
});
```

## Local definitions

Those apply when you decide to set those at a method definition level (for one endpoint only).

### onError() and onLoad()

You can also pass the **onLoad** and **onError** handlers within each method - to have a unique response from each. In all cases you always get two params which are the **response** and the **original callback** so you can pass it through, or stop the call. Again with **onError** you can perform a **retry()** at a local level.

### Override the base URL

Since version 1.3.6 it's now possible to have a complete URL in the method definition, for example, if you're using a base URL (`url` top setting) and methods for your primary API, you might want to access another service for Push or Geocoding etc.

In this instance, you would specify a method and specify the **GET**, **PUT** etc as the full URL including the `http://` or `https://` intro. RESTe will ignore the base URL and any global request headers, and use your "local" URL entirely -- so add any headers required to the method definition.

```javascript
api.config({
    ...
    }, {
        name: "pushNotification",
        post: "http://another.api.service.com/push"
    }, {
    ...
});
```

### Override or add request headers

You can use override or add new headers for each method (or endpoint) locally.

You can also use functions for those which will be executed every time this method is used from RESTe, giving you the ability to have dynamic parameters here. Pretty useful for `Authorization` headers using dynamic tokens persisted somewhere else for example.

```javascript
...
{
    name: "getAccounts",
    get: "user/accounts",
    headers: {
        "Authorization": function(){
            return "Something";
        }
    }
}
...
```

**Pro tip:** If for whatever reason you need some settings to be more dynamic (maybe using global functions), you can even have self executed functions for any of those. Something like :

```javascript
api.config({
    ...
    }, {
        name: "pushNotification",
        post: (function(){ return "some/endpoint"; })()
    }, {
    ...
});
```

## Promise support with q.js

[Download the q.js](https://github.com/kriskowal/q) and place in your project (lib folder for Alloy). Then pass it to config as Q property.

```javascript
api.config({
    Q: require('q'),
    ...
});
```

Examples using Promise

```javascript
api.getVideos().then(function(videos){}).then(...).catch(...);
```

Or call a method with a specific Id:

```javascript
api.getVideoById({
    videoId: "fUAM4ZFj9X"
}).then(function(video) {
    // do stuff with the video
});
```

## Helper functions

There are a couple of new functions to help in a couple of areas -- firstly, being able to swap out the base URL of your API -- useful if you're developing and need to switch servers in the app. The second method supports clearing any cookies from the RESTe http client.

The following will temporarily change the config base URL:

```javascript
api.setUrl("http://whatever");
```

(this is lost if you restart the app)

The following will clear any cookies from the baseUrl:

```javascript
api.clearCookies();
```

## Alloy Collections and Model support

RESTe supports collection and model generation. So it supports creating and managing collections and models, binding, and CRUD methods to Create, Update and Delete models.

You can also now perform transform functions at a global (config) level or locally in a controller / view -- this is really useful if you use Alloy and pass models to views using **$model**

In the following example, we've defined a method called **getExpenseQueueFull** elsewhere in the config that gets expense details, and then defined a **transform** function in the config:

```javascript
    models: [{
        name: "expense",
        id: "unid",
        read: "getExpenseById",
        content: "retArray",
        transform: function(m) {
            m = m.toJSON();
            m.hotelAllowance && (m.hotelAllowance = "£" + parseFloat(m.hotelAllowance).toFixed(2));
            m.mileage && (m.mileage = "£" + parseFloat(m.mileage).toFixed(2));
            m.other && (m.other = "£" + parseFloat(m.other).toFixed(2));
            m.total && (m.total = "£" + parseFloat(m.total).toFixed(2));
            return m;
        },
        collections: [{
            name: "expenses",
            content: "retArray",
            read: "getExpensesQueueFull"
        }],
    }
```

So now whenever you want to transform the model, you can do so within a local transform function as follows:

```javascript
function transform(model) {
    var m = model.transform(model);
    return m;
}
```

You can also pass an optional transform parameter in the transform function, which will override the global transform method.

### Defining methods with models / collections

Using the following config you can configure end points that will still work as normal RESTe methods, but also give you collections and model support for (C)reate, (R)ead, (U)pdate, (D)elete. For Collections I use an array of collections so you can have multiple endpoints configured if different collections using the same model. This enables use of for example, Alloy.Collections.locations (for all locations) and Alloy.Collections.locationsByName (for locations by a specific parameter).

(Ideally this should be more elegant, allowing the single locations collection in this case to be used to filter content but I needed a way to make this API independant and it's the best I can do for now!)

```javascript
    models: [{
        name: "location",
        id: "objectId",
        read: "getLocation",
        //content: "results" <- use this is your method returns an array object
        create: "createLocation",        
        update: "updateLocation",
        delete: "deleteLocation",
        collections: [{
            name: "locations",
            content: "results",
            read: "getLocations"
        }, {
            name: "locationsByName",
            content: "results",
            read: "getLocationsByName"
        }],
    }],
    methods: [{
        name: "getLocations",
        get: "classes/locations"
    }, {
        name: "getLocation",
        get: "classes/locations/<id>"
    },{
        name: "getLocationsByName",
        get: 'classes/locations?where={"name": "<name>"}'
    }, {
        name: "updateLocation",
        put: "classes/locations/<objectId>"
    }, {
        name: "createLocation",
        post: "classes/locations/"
    }, {
        name: "deleteLocation",
        delete: "classes/locations/<objectId>"
    }]
```

### Using models / collections

In the example above, I can refresh the data for a collection by using:

```javascript
Alloy.Collections.locations.fetch();
```

and bind it to a tableview as follows:

```xml
<TableView dataCollection="locations" onClick="selectLocation">
    <TableViewRow id="locationRow" model="{objectId}" >
        <Label class="title" top="10"left="20" text="{name}"/>
        <Label class="subTitle" bottom="10" left="20" text="{address}"/>
    </TableViewRow>
 </TableView>
```

You could also send parameters like follows:

```javascript
Alloy.Collections.locationsByName.fetch({
					name: "home"
					});
```

To sort a collection, you need to set the comparator to the collection. Don't do this in the API configuration, but on the collection itself before you fetch it, like shown in the example below.

Calling the sort function at any time after the fetch will try to sort.

```js
Alloy.Collections.locations.comparator = function(a, b){
	// do your sorting here, a & b will be models
};

Alloy.Collections.locations.fetch({
	success: function(a,b,c){
		Alloy.Collections.locations.sort();
	}
});
```

### Creating new models and collections

RESTe provides a couple of useful helper functions to create new models and collections - this is useful if you want to take an array of objects and turn them into a collection for easy binding.

```javascript
.createModel(name, attributes)
.createCollection(name, array)
```
Each return either a model, or collection that can then be used with Alloy.

When working with created models, you can define an instance of a model that you've specified in the config, and if that supports CRUD functions, you can pass options when creating, saving, updating and deleting.

So for example:

```javascript
var user = Alloy.Globals.reste.createModel("user");

user.save({
            username: $.email.value,
            firstname: $.firstname.value,
            lastname: $.lastname.value,
            email: $.email.value,
            password: $.password.value
        }, {
            success: function(e, response) {
                console.log("User saved!");
                console.log(user.toJSON());
            },
            error: function(e, response) {
                console.log("Error saving user!");
                console.log(response);
            }
});
```

## License

<pre>
Copyright 2016 Jason Kneen

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
</pre>
