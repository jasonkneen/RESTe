const reste = require('../reste');
const assert = require('assert');

describe('RESTe React Tests', function() {
  let api;

  beforeEach(function() {
    api = new reste();
    api.config({
      debug: true,
      errorsAsObjects: true,
      autoValidateParams: false,
      validatesSecureCertificate: false,
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
        onError: function(e, callback, globalOnError){
          console.error("There was an error getting the courses!");
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
        console.error("There was an error connecting to the server, check your network connection and retry.");
        retry();
      },
      onLoad: function(e, callback) {
        callback(e);
      }
    });
  });

  it('should fetch videos', function(done) {
    api.getVideos().then(videos => {
      assert(Array.isArray(videos), 'Expected videos to be an array');
      done();
    }).catch(error => {
      done(error);
    });
  });

  it('should fetch video by id', function(done) {
    api.getVideoById({ videoId: "fUAM4ZFj9X" }).then(video => {
      assert(video, 'Expected video to be defined');
      done();
    }).catch(error => {
      done(error);
    });
  });

  it('should add a video', function(done) {
    api.addVideo({ body: { categoryId: 1, name: "My Video" } }).then(video => {
      assert(video, 'Expected video to be defined');
      done();
    }).catch(error => {
      done(error);
    });
  });
});
