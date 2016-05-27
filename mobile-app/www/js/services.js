/* globals angular: false */
/* globals console: false */
/* globals Uint8Array: false */

angular.module("MooringLights.services", [])

.factory("Chaser", function($q, $window, Scene, TCPClient, Toast) {
  var CHANNELS_PER_SCENE = 6;
  var SCENES_PER_CHASER = 6;
  var DEFAULTS = {Name: "", Interval: 1000, Count: 1, Scenes: []};

  var Chaser = function(defaults) {
    angular.extend(this, angular.copy(DEFAULTS), angular.copy(defaults));

    this.initialize = function() {
      // Pre-populate the scenes
      for (var i = 0; i < SCENES_PER_CHASER; i++) {
        this.Scenes[i] = new Scene({
          Name: "Scene " + (i + 1)
        });
      }

      if (defaults) {
        if (defaults.Count)
          this.Count = defaults.Count;

        if (defaults.Interval)
          this.Interval = defaults.Interval;

        if(defaults.Scenes && defaults.Scenes.length) {
          for (var i = 0; i < defaults.Scenes.length; i++) {
            this.Scenes[i] = new Scene(defaults.Scenes[i]);
          }
        }
      }
    };

    this.deserialize = function(data) {
      /*
      typedef struct Chaser {
        uint16_t interval; // The fade interval (in ms)
        uint8_t count; // Fade count
        uint8_t index = 0;
        uint8_t lights[LIGHTS_MAX_COUNT][PWM_COUNT];
      } Chaser;
      */

      // Deserialize from struct Chaser
      this.Interval = (data[0]) + (data[1] << 8);
      this.Count = Math.min(data[2], SCENES_PER_CHASER); // In case un-initialised data is returned
      for (var i = 0; i < SCENES_PER_CHASER; i++) {
        var scene = this.Scenes[i];
        for (var j = 0; j < CHANNELS_PER_SCENE; j++) {
          scene.Channels[j] = data[4 + (i * CHANNELS_PER_SCENE) + j];
        }

        scene.Mirror = true;
        for (var j = 0; j < scene.Channels.length / 2; j++) {
          if (scene.Channels[j] !== scene.Channels[scene.Channels.length - 1 - j]) {
            scene.Mirror = false;
            break;
          }
        }
      }
    };

    this.load = function(button) {
      var _self = this;

      var q = $q.defer();

      var client = new TCPClient({
        Logging: true,
      });

      client.send("LOAD", [0x30 + button.charCodeAt() - 65])
      .then(function(response) {
        Toast.showLongBottom("Chaser loaded");

        q.resolve(_self);

      }).catch(function(error) {
        console.log("Couldn't load chaser:");
        console.log(JSON.stringify(error));
        Toast.showLongBottom(error.message);

        q.reject();

      });

      return q.promise;
    };

    this.read = function(button) {
      var _self = this;

      var q = $q.defer();

      var client = new TCPClient({
        Logging: true,
      });

      client.send("READ", [0x30 + button.charCodeAt() - 65])
      .then(function(response) {
        // Convert the data to a byte array
        var data = [];
        for (var i = 4; i < response.data.length; i++) {
          data[i - 4] = response.data[i];
        }
        _self.Name = "Button " + button;
        _self.deserialize(data);

        q.resolve(_self);

      }).catch(function(error) {
        console.log("Couldn't read chaser:");
        console.log(JSON.stringify(error));
        Toast.showLongBottom(error.message);

        q.reject(error);

      });

      return q.promise;
    };

    this.serialize = function() {
      // Serialize to struct Chaser
      var data = [];
      data[0] = (this.Interval) & 0xff;
      data[1] = (this.Interval >> 8) & 0xff;
      data[2] = parseInt(this.Count);
      data[3] = 0; // Index is unused client side
      for (var i = 0; i < SCENES_PER_CHASER; i++) {
        for (var j = 0; j < CHANNELS_PER_SCENE; j++) {
          data[4 + (i * CHANNELS_PER_SCENE) + j] = parseInt(this.Scenes[i].Channels[j]);
        }
      }

      return data;
    };

    // Writes the chaser to the controller and the specified button slot.
    // If no button is given, the chaser is simply written to the current chaser
    this.write = function(button) {
      var _self = this;

      var q = $q.defer();

      var client = new TCPClient({
        Logging: true,
      });

      var data = this.serialize();
      var command;
      if (button) {
        // Button given, insert the nutton number
        data.splice(0, 0, [0x30 + button.charCodeAt() - 65]);
        command = "WRITE";
      } else {
        command = "USE";
      }

      client.send(command, data)
      .then(function(response) {
        if (button) {
          Toast.showLongBottom("Chaser has been written to Button " + button);
        } else {
          Toast.showLongBottom("Chaser has been written to the controller");
        }

        q.resolve(_self);

      }).catch(function(error) {
        console.log("Couldn't write chaser:");
        console.log(JSON.stringify(error));
        Toast.showLongBottom(error.message);

        q.reject(error);

      });

      return q.promise;
    };

    this.initialize();
  };

  return (Chaser);
})

.factory("Scene", function($q, $window, TCPClient, Toast) {
  var CHANNELS_PER_SCENE = 6;
  var DEFAULTS = {Name: "", Mirror: true, Channels: []};

  var Scene = function(defaults) {
    angular.extend(this, angular.copy(DEFAULTS), angular.copy(defaults));

    this.initialize = function() {
      // Pre-populate with the requisite number of channels
      for (var i = 0; i < CHANNELS_PER_SCENE; i++) {
        this.Channels[i] = 0;
      }

      if (defaults && defaults.Channels) {
        for (var i = 0; i < CHANNELS_PER_SCENE; i++) {
          this.Channels[i] = defaults.Channels[i];
        }
      }
    };

    this.read = function() {
      var _self = this;

      var q = $q.defer();

      var client = new TCPClient({
        Logging: true
      });

      client.send("STATUS", null)
      .then(function(response) {
        for (var i = 0; i < _self.Channels.length; i++) {
          _self.Channels[i] = response.data[i + 4];
        }

        _self.Mirror = true;
        for (var i = 0; i < _self.Channels.length / 2; i++) {
          if (_self.Channels[i] !== _self.Channels[_self.Channels.length - 1 - i]) {
            _self.Mirror = false;
            break;
          }
        }

        q.resolve(_self);

      }).catch(function(error) {
        console.log("Couldn't get status:");
        console.log(JSON.stringify(error));
        Toast.showLongBottom(error.message);

        q.reject();

      });

      return q.promise;
    };

    // Writes the levels to the controller
    this.write = function(intensity) {
      // Default to 0
      intensity = parseInt(intensity) || 0;

      var data = [];
      for (var i = 0; i < this.Channels.length; i++) {
        if (this.Channels[i] == 0) { // Also match "0"
          data[i] = 0;
        } else {
          // Compress non-zero values to be between 1 and intensity
          data[i] = 1 + (parseInt(this.Channels[i]) - 1) * intensity / 255;
        }
      }

      var q = $q.defer();

      var client = new TCPClient({
        Logging: true,
      });

      client.send("SET", data)
      .then(function(response) {
        console.log("Set levels successfuly:");
        console.log(JSON.stringify(response));
        Toast.showLongBottom("Lights have been set");

        q.resolve(response);

      }).catch(function(error) {
        console.log("Couldn't write levels:");
        console.log(JSON.stringify(error));
        Toast.showLongBottom(error.message);

        q.reject();

      });

      return q.promise;
    };

    this.initialize();
  };

  return (Scene);
})

.service("LightsService", function($window, Chaser, Scene){
  // Deletes the specified chaser
  this.deleteChaser = function(id) {
    var chasers = this.getChasers();

    var found = -1;
    angular.forEach(chasers, function(item, index) {
      if ((found === -1) && (item.ID == id))
        found = index;
    });

    if (found === -1)
      throw "No chaser could be found with the ID '" + id + "'";

    chasers.splice(found, 1);
    this.saveChasers(chasers);
  };

  // Deletes the specified scene
  this.deleteScene = function(id) {
    var scenes = this.getScenes();

    var found = -1;
    angular.forEach(scenes, function(item, index) {
      if ((found === -1) && (item.ID == id))
        found = index;
    });

    if (found === -1)
      throw "No scene could be found with the ID '" + id + "'";

    scenes.splice(found, 1);
    this.saveScenes(scenes);
  };

  // Get the specified chaser
  this.getChaser = function(id) {
    var chasers = this.getChasers();

    var found = null;
    angular.forEach(chasers, function(item, index) {
      if (item.ID == id)
        found = item;
    });

    if (found)
      return found;

    throw "No chaser could be found with the ID '" + id + "'";
  };

  // Gets all the chasers from local storage
  this.getChasers = function() {
    var saved = JSON.parse($window.localStorage.getItem("chasers") || "[]");
    var chasers = [];
    for (var i = 0; i < saved.length; i++) {
      chasers.push(new Chaser(saved[i]));
    }

    return chasers;
  };

  // Gets the intensity used for all channels
  this.getIntensity = function() {
    return parseInt($window.localStorage.getItem("intensity")) || 0;
  };

  // Get the specified scene
  this.getScene = function(id) {
    var scenes = this.getScenes();

    var found = null;
    angular.forEach(scenes, function(item, index) {
      if (item.ID == id)
        found = item;
    });

    if (found)
      return found;

    throw "No scene could be found with the ID '" + id + "'";
  };

  // Gets all the scenes from local storage
  this.getScenes = function() {
    var saved = $window.localStorage.getItem("scenes");
    var scenes = [];
    if (saved) {
      // Parse the saved list
      saved = JSON.parse(saved);
      for (var i = 0; i < saved.length; i++) {
        scenes[i] = new Scene(saved[i]);
      }
    } else {
      // Create a default set
      scenes.push(new Scene({ID: 0, Name: "All Off", Mirror: true, Channels: [0, 0, 0, 0, 0, 0] }));
      scenes.push(new Scene({ID: 1, Name: "All On", Mirror: true, Channels: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff] }));
      scenes.push(new Scene({ID: 2, Name: "Gradient", Mirror: true, Channels: [0x20, 0x80, 0xff, 0xff, 0x80, 0x20] }));
      this.saveScenes(scenes);
    }

    return scenes;
  };

  // Sets the specified chaser
  this.saveChaser = function(chaser) {
    var chasers = this.getChasers();

    var found = -1;
    var maxID = 0;
    angular.forEach(chasers, function(item, index) {
      if ((found === -1) && (item.ID == chaser.ID))
        found = index;

      if (item.ID >= maxID)
        maxID = item.ID;
    });

    if (!chaser.ID)
      chaser.ID = maxID + 1;

    chasers[found === -1 ? chasers.length : found] = chaser;

    this.saveChasers(chasers);
  };

  // Saves all the chasers to localstorage
  this.saveChasers = function(chasers) {
    $window.localStorage.setItem("chasers", JSON.stringify(chasers));
  };

  // Saves the intensity used for all channels
  this.saveIntensity = function(value) {
    $window.localStorage.setItem("intensity", value);
  };

  // Sets the specified scene
  this.saveScene = function(scene) {
    var scenes = this.getScenes();

    var found = -1;
    var maxID = 0;
    angular.forEach(scenes, function(item, index) {
      if ((found === -1) && (item.ID == scene.ID))
        found = index;

      if (item.ID >= maxID)
        maxID = item.ID;
    });

    if (!scene.ID)
      scene.ID = maxID + 1;

    scenes[found === -1 ? scenes.length : found] = scene;

    this.saveScenes(scenes);
  };

  // Saves all the scenes to localstorage
  this.saveScenes = function(scenes) {
    $window.localStorage.setItem("scenes", JSON.stringify(scenes));
  };

})

.factory("TCPClient", function($window, $q, $timeout) {
  var DEFAULTS = {
    Logging: false,
  };

  var TCPClient = function(defaults) {
    this.defaults = angular.extend(DEFAULTS, defaults);

    this.logMessage = function(message, data) {
      if (!this.defaults.Logging)
        return;

      var msg = message;

      if (data && data.length) {
        msg += "; Data: {";
        for (var i = 0; i < data.length; i++) {
          if (i !== 0)
            msg += ", ";
          msg += data[i];
        }
        msg += "}";
      }

      console.log(msg);
    };

    this.send = function(command, data) {
      var self = this;
      var q = $q.defer();

      var settings = JSON.parse($window.localStorage.getItem("settings") || "{}");
      if (!settings.Host || ! settings.Port) {
        q.reject({
          message: "No network settings have been provided"
        });

      } else if (!$window.Socket) {
        // If the socket plugin isn't available
        q.reject({
          message: "Socket plugin is not available"
        });

      } else {
        // Data should be an array
        if (!data || !data.length)
          data = [];

        var byteCount = command.length + (data.length ? 1 : 0) + data.length + 2;
        var bytes = new Uint8Array(byteCount);
        for (var i = 0; i < command.length; i++) {
          bytes[i] = command.charCodeAt(i);
        }

        if (data.length) {
          bytes[command.length] = 0x20; // Space delimited
          for (var i = 0; i < data.length; i++) {
            bytes[command.length + 1 + i] = data[i];
          }
        }

        // Terminated by \r\n
        bytes[byteCount - 2] = 13;
        bytes[byteCount - 1] = 10;

        // Create the socket
        var socket = new $window.Socket();

        // Container for any received data
        var received = null;

        // Raised when the socket is closed
        socket.onClose = function(hasError) {
          if (hasError) {
            q.reject({
              message: "Socket closed with an error"
            });

          } else {
            // Data must be received
            if (received) {
              self.logMessage("Received " + received.length + " bytes from the socket", received);

              if (received.length && String.fromCharCode(received[0]) === "+") {
                q.resolve({
                  data: received
                });

              } else {
                q.reject({
                  message: "The controller returned an error.",
                  data: received
                });

              }

            } else {
              q.reject({
                message: "The controller returned no data"
              });

            }
          }
        };

        // Raised when data is received
        socket.onData = function(data) {
          // Just send the data, the controller will close the connection
          received = data;
        };

        // Open connection timer
        var timeout = $timeout(function() {
          console.log("Connection timed out.");
          socket.close(function() {
            q.reject({
              message: "The connection to the controller timed out",
            });

          }, function(error) {
            q.reject({
              message: "The connection to the controller timed out",
              error: error
            });

          });
        }, settings.Timeout || 10000);

        socket.open(settings.Host, settings.Port, function() {
          // Once the connection is open, immediately cancel the timeout timer
          $timeout.cancel(timeout);

          // Write the data once opened
          self.logMessage("Writing " + bytes.length + " bytes to the socket", bytes);
          socket.write(bytes);

        }, function(error) {
          q.reject({
            message: "An error occurred connecting to the controller",
            error: error
          });

        });

      }

      return q.promise;
    };

  };

  return (TCPClient);
})

// Wrapper for toast so it doesn't break when serving it locally
.service("Toast", function($cordovaToast) {
  this.show = function(message, duration, position) {
    try {
      $cordovaToast.show(message, duration, position);
    } catch (er) {}
  };

  this.showLongBottom = function(message) {
    this.show(message, "long", "bottom");
  };

  this.showLongCenter = function(message) {
    this.show(message, "long", "center");
  };

  this.showLongTop = function(message) {
    this.show(message, "long", "top");
  };

  this.showShortBottom = function(message) {
    this.show(message, "short", "bottom");
  };

  this.showShortCenter = function(message) {
    this.show(message, "short", "center");
  };

  this.showShortTop = function(message) {
    this.show(message, "short", "top");
  };
})

;
