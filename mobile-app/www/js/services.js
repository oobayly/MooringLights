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

.factory("Chaser", function($window, Channel) {
  var CHANNELS_PER_CHASER = 6;
  var CHANNELS_PER_MIRROR = CHANNELS_PER_CHASER / 2;
  var DEFAULTS = {Name: "", Mirror: true, Channels: []};

  var Chaser = function(defaults) {
    angular.extend(this, DEFAULTS, angular.copy(defaults));

    this.initialize = function() {
      // Pre-populate with the requisite number of channels
      for (var i = 0; i < CHANNELS_PER_CHASER; i++) {
        this.Channels[i] = new Channel();
      }

      if (defaults && defaults.Channels) {
        for (var i = 0; i < CHANNELS_PER_CHASER; i++) {
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

    this.logMessage = function(message, data) {
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

    // Set the current channel values
    this.setChannels = function(channels) {
      if (this.Mirror && (channels.length !== CHANNELS_PER_MIRROR))
        throw CHANNELS_PER_MIRROR + " channels are required for a mirrored chaser";

      if (!this.Mirror && (channels.length !== CHANNELS_PER_CHASER))
        throw CHANNELS_PER_CHASER + " channels are required for standard chaser";

      if (this.Mirror) {
        for (var i = 0; i < CHANNELS_PER_CHASER; i++) {
          var index = (i < CHANNELS_PER_MIRROR) ? i : (CHANNELS_PER_CHASER - 1 - i);
          this.Channels[i].Value = channels[index].Value;
        }

      } else {
        for (var i = 0; i < CHANNELS_PER_CHASER; i++) {
          this.Channels[i].Value = channels[i].Value;
        }
      }
    };

    // Writes the levels to the controller
    this.writeLevels = function(intensity, onClose, onError) {
      var self = this;

      // Default to 0
      intensity = intensity || 0;

      var settings = JSON.parse(localStorage.getItem("settings") || "{}");
      if (!settings.Host || ! settings.Port) {
        if (onError) {
          onError("No network settings have been provided.");
        } else {
          throw "No network settings have been provided.";
        }
      }

      // Nothing to do if we don't have the sockets plugin
      if (!window.Socket) {
        console.log("No Socket is available.");
        return;
      }

      var command = "SET";
      var data = new Uint8Array(command.length + 6 + 2);
      for (var i = 0; i < command.length; i++) {
        data[i] = command.charCodeAt(i);
      }
      for (var i = 0; i < this.Channels.length; i++) {
        data[command.length + i] = this.Channels[i].Value * intensity / 255;
      }
      data[data.length - 2] = 13;
      data[data.length - 1] = 10;

      var socket = new $window.Socket();

      // TODO: Handle data
      socket.onData = function(data) {
        if (data) {
          self.logMessage("Received " + data.length + " bytes from the socket", data);
        }
        socket.shutdownWrite();
      };

      socket.onError = function(errorMessage) {
        if (onError)
          onError("An error occurred connecting to the Lighting Controller.", errorMessage);
      }

      if (onClose)
        socket.onClose = onClose;

      socket.open(settings.Host, settings.Port,
        function() {
          self.logMessage("Writing " + data.length + " bytes to the socket", data);
          socket.write(data);

          // TODO: Handle parsing the response
          socket.shutdownWrite();
        }, function(errorMessage) {
          if (onError)
            onError("An error occurred writing to the Lighting Controller.", errorMessage);

        });
    };

    this.initialize();
  };

  return (Chaser);
})

.service("LightsService", function($window, Chaser){
  // The overall intensity (0 - 255) for all channels
  this.Intensity = {Value: 0};

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

  // Get the specified chaser
  this.getChaser = function(id) {
    var chasers = this.getChasers();

    var found = null;
    angular.forEach(chasers, function(item, index) {
      if (item.ID == id)
        found = new Chaser(item);
    });

    if (found)
      return found;

    throw "No chaser could be found with the ID '" + id + "'";
  }

  // Gets all the chasers from local storage
  this.getChasers = function() {
    var saved = JSON.parse($window.localStorage.getItem("chasers") || "[]");

    var chasers = [];
    for (var i = 0; i < saved.length; i++) {
      chasers[i] = new Chaser(saved[i]);
    }

    return chasers;
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

})

;
