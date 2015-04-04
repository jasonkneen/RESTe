# RESTe

LATEST: Updated with support for collections and models in Alloy - currently supporting binding, create, delete, update methods on models.

## Why?

I build a lot of apps that integrate with APIs. These could be written in cloud services like Parse.com etc, but more often they are custom APIs written by another developer. I was using a basic api.js library to handle the API integration, but this involved implementing the api.js file into a separate library file specific to the project.

### The Old Way 

Previously I'd end up writing methods like this:

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

So the idea behind RESTe was to have a single JS library I could drop in a project, then apply a simple config to it and have *it* generate the methods for me.

The main things I wanted were:-

* Simple to implement in an new project, or replace an existing API layer
* Supports headers, tokens, events
* Minimal code


## Quick Start
* [Download the latest version](https://github.com/jasonkneen/reste).
* Place in your lib folder

Wherever you want to initialise the API interface, put this:-

```javascript
var api = require("reste");

api.config({
    debug: true, // allows logging to console of ::REST:: messages
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
    onError: function(e) {
        alert("There was an error accessing the API");
    },
    onLoad: function(e, callback) {
        callback(e);
    }
});
```

You can pass the _optional_ **onError** and **onLoad** handlers, which will intercept the error or retrieved data before it's passed to the calling function's callback. This way you can change, test, do-what-you-want-with-it before passing it on.

You can also pass the onLoad and onError handlers within each method - to have a unique response from each. In all cases you always get two params which are the **response** and the **original callback** so you can pass it through, or stop the call.

If you specify parameters required e.g. **videoId** then RESTe will automatically check for these in the parameters passed to the method, and raise an error if they're missing.

Once you've done all this (and assuming no errors), you'll have new methods available:

```javascript
api.getAllVideos(function(videos) {
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

## Alloy Collections and Model support

As of 1.0.5, RESTe now supports collection and model generation. So far I've got collections working and defintiions of models so you can iterate them, bind to controls etc. The framework is there to do the CRUD calls - that's next on my list.

### Defining methods with models / collections

Using the following config you can configure end points that will still work as normal RESTe methods, but also give you collections and model support for CRUD.

```javascript
methods: [{
        name: "getLocations",
        get: "classes/locations",
        model: {
            name: "location",
            id: "objectId",
            update: "updateLocation",
            create: "createLocation",
            delete: "deleteLocation",
            collection: {
                name: "locations",
                content: "results"
            },
        },
        onLoad: function(e, callback) {            
            callback(e);
        },
        onError: function(e, callback) {
            callback(e);
        }
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

## To add

* auto-config from remote API
* better support for Session Tokens

## License

<pre>
Copyright 2015 Jason Kneen

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
