angular.module("MooringLights.services", [])

.factory("Channel", function() {
  var ROUND_VALUE = 32;
  var DEFAULTS = {Value: 0};

  var Channel = function(defaults) {
    angular.extend(this, DEFAULTS, defaults);

    this.increment = function(delta) {
      var newValue = parseInt(this.Value) + parseInt(delta);
      newValue = ROUND_VALUE * Math.round(newValue / ROUND_VALUE);

      if (newValue < 0) {
        newValue = 0;
      } else if (newValue > 255) {
        newValue = 255;
      }

      this.Value = newValue;
    };

    this.incrementDown = function(delta) {
      if (delta === undefined || delta === null)
        delta = -ROUND_VALUE;

      this.increment(delta);
    }

    this.incrementUp = function(delta) {
      if (delta === undefined || delta === null)
        delta = ROUND_VALUE;

      this.increment(delta);
    }
  };

  return (Channel);
})

.factory("Scene", function($window, Channel, TCPClient) {
  var CHANNELS_PER_SCENE = 6;
  var CHANNELS_PER_MIRROR = CHANNELS_PER_SCENE / 2;
  var DEFAULTS = {Name: "", Mirror: true, Channels: []};

  var Scene = function(defaults) {
    angular.extend(this, DEFAULTS, angular.copy(defaults));

    this.initialize = function() {
      // Pre-populate with the requisite number of channels
      for (var i = 0; i < CHANNELS_PER_SCENE; i++) {
        this.Channels[i] = new Channel();
      }

      if (defaults && defaults.Channels) {
        for (var i = 0; i < CHANNELS_PER_SCENE; i++) {
          this.Channels[i].Value = defaults.Channels[i].Value;
        }
      }
    };

    // Get the current channel values
    this.getChannels = function() {
      // Return a deep copy of the channel values
      if (this.Mirror) {
        var resp = [];
        for (var i = 0; i < CHANNELS_PER_MIRROR; i++) {
          resp[i] = angular.copy(this.Channels[i]);
        }
        return resp;
      } else {
        return angular.copy(this.Channels);
      }
    };

    // Set the current channel values
    this.setChannels = function(channels) {
      if (this.Mirror && (channels.length !== CHANNELS_PER_MIRROR))
        throw CHANNELS_PER_MIRROR + " channels are required for a mirrored scene";

      if (!this.Mirror && (channels.length !== CHANNELS_PER_SCENE))
        throw CHANNELS_PER_SCENE + " channels are required for standard scene";

      if (this.Mirror) {
        for (var i = 0; i < CHANNELS_PER_SCENE; i++) {
          var index = (i < CHANNELS_PER_MIRROR) ? i : (CHANNELS_PER_SCENE - 1 - i);
          this.Channels[i].Value = channels[index].Value;
        }

      } else {
        for (var i = 0; i < CHANNELS_PER_SCENE; i++) {
          this.Channels[i].Value = channels[i].Value;
        }
      }
    };

    // Writes the levels to the controller
    this.writeLevels = function(intensity) {
      // Default to 0
      intensity = intensity || 0;

      var data = [];
      for (var i = 0; i < this.Channels.length; i++) {
        data[i] = this.Channels[i].Value * intensity / 255;
      }

      var client = new TCPClient({
        Logging: true,
      });

      return client.send("SET", data);
    };

    this.initialize();
  };

  return (Scene);
})

.service("LightsService", function($window, Scene){
  // The overall intensity (0 - 255) for all channels
  this.Intensity = {Value: 0};

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

  // Get the specified scene
  this.getScene = function(id) {
    var scenes = this.getScenes();

    var found = null;
    angular.forEach(scenes, function(item, index) {
      if (item.ID == id)
        found = new Scene(item);
    });

    if (found)
      return found;

    throw "No scene could be found with the ID '" + id + "'";
  }

  // Gets all the scenes from local storage
  this.getScenes = function() {
    var saved = JSON.parse($window.localStorage.getItem("scenes") || "[]");

    var scenes = [];
    for (var i = 0; i < saved.length; i++) {
      scenes[i] = new Scene(saved[i]);
    }

    return scenes;
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

.factory("TCPClient", function($window, $q) {
  var DEFAULTS = {
    Logging: false,
    Timeout: 10000 // Default timeout
  }

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

      var settings = JSON.parse(localStorage.getItem("settings") || "{}");
      if (!settings.Host || ! settings.Port) {
        q.reject({
          message: "No network settings have been provided"
        });

      } else if (!window.Socket) {
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
            var success = true;

            if (received) {
              self.logMessage("Received " + received.length + " bytes from the socket", received);

              // If data is received, then it must start with a plus
              success = received.length && String.fromCharCode(received[0]) === "+";
            }

            if (success) {
              q.resolve({
                data: data
              });
            } else {
              q.reject({
                message: "The controller returned an error.",
                data: data
              });
            }

          }
        };

        // Raised when data is received
        socket.onData = function(data) {
          // Just send the data, the controller will close the connection
          received = data;
        };

        socket.open(settings.Host, settings.Port, function() {
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
    }

  };

  return (TCPClient);
})

;
