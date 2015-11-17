#include <ESP8266.h>
#include <SoftwareSerial.h>
#include <TimerOne.h>

#include "controller.h"

void setup() {                
  uart = new SoftwareSerial(ESP_RX, ESP_TX);
  dbg.begin(DEBUG_BAUD);

  // Timer needs to be configured before the LEDS so the pwm methods are available
  Timer1.initialize(TIMER_INTERVAL);
  setupLEDs();

  // The status LED defaults to off
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);
  
  // One the LEDS have been configured, the interrupt can be attached
  currentmode = POST;
  Timer1.attachInterrupt(timer1_interrupt);
  
  uint8_t code = setupWifi();
  if (code) {
    currentmode = ERROR;
    setLastError(code);
  } else {
    currentmode = SLEEP;
    digitalWrite(STATUS_LED, HIGH);
  }
  clearPWMValues();
}

void loop() {
  uint8_t mux_id;
  
  uint8_t len = esp->recv(&mux_id, buffer, BUFFER_SIZE, 100);
  if (len != 0) {
    if (strncmp((char*)buffer, "HELP\r\n", 6) == 0) {
      writeHelp(mux_id);
      
    } else if (strncmp((char*)buffer, "TEMP\r\n", 6) == 0) {
      writeTemp(mux_id);
      
    } else if (strncmp((char*)buffer, "STATUS\r\n", 8) == 0) {
      writeStatus(mux_id);
      
    } else if ((strncmp((char*)buffer, "SET", 3) == 0) && (len == (3 + LED_COUNT + 2))) { // As long as there are enough PWM values
      currentmode == ON;
      setPWMValues(buffer, 3, true);

      // Respond with the status
      writeStatus(mux_id);
      
    } else {
      dbg.print("Unexpected message:");
      for (uint8_t i = 0; i < len; i++) {
        dbg.print("\t0x");
        dbg.print(buffer[i], HEX);
      }
      dbg.println("");
      
      esp->send(mux_id, (uint8_t *)"-ER\r\n", 5);
      
    }
  }
}

void clearPWMValues() {
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    LED_PWM[i] = 0;
  }
  setPWMValues((uint8_t *)LED_PWM, 0, false);
}

void setLastError(uint8_t code) {
  lasterr->code = code;
  lasterr->step = 0;
  lasterr->blinkSteps = 2 * ((2 * code) - 1); // Blink every 2 intervals
  lasterr->totalSteps = lasterr->blinkSteps + 8; // Followed by 8 intervals
}

void setupLEDs() {
  // Each of the LEDS are set up of PWM output
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    uint8_t pin = LEDS[i];
    pinMode(pin, OUTPUT);
    switch(pin) {
      case TIMER1_A_PIN:
      case TIMER1_B_PIN:
        Timer1.pwm(pin, 0);
        break;
        
      default:
        analogWrite(pin, 0);
        break;
        
    }
  }
  
  dbg.print("THERE. ARE. ");
  dbg.print(LED_COUNT);
  dbg.println(". LIGHTS.");
  
  // Set the defaults
  clearPWMValues();
}


void setPWMValues(const uint8_t * values, uint8_t offset, bool doPrint) {
  if (doPrint)
    dbg.print("Writing PWM values: ");

  for (uint8_t i = 0; i < LED_COUNT; i++) {
    LED_PWM[i] = values[offset + i];

    uint8_t pin = LEDS[i];
    switch (pin) {
      case TIMER1_A_PIN:
      case TIMER1_B_PIN:
        // These pins use Timer1, so we need to use that library to set them
        // They're also 10bit
        Timer1.setPwmDuty(pin, 1023.0 * LED_PWM[i] / 255);
        break;
        
      default:
        analogWrite(pin, LED_PWM[i]);
        break;
    }

    if (doPrint) {
      dbg.print("\t0x");
      dbg.print(LED_PWM[i], HEX);
    }
    
    // Clear the sleep timer
    sleepTicks = 0;
  }
 
  if (doPrint)
    dbg.println();
}

uint8_t setupWifi() {
  esp = new ESP8266(*uart, ESP_BAUD);

  dbg.print("Version: ");
  dbg.println(esp->getVersion().c_str());

  // Make sure we're in client mode
  dbg.print("Setting to Station... ");
  if (esp->setOprToStation()) {
    dbg.println("OK");
  } else {
    dbg.println("Failed");
    return 1;
  }

  // Connect to the AP
  dbg.print("Connecting to ");
  dbg.print(AP_SSID);
  dbg.print("... ");
  if (esp->joinAP(AP_SSID, AP_PASS)) {
    dbg.println("OK");
  } else {
    dbg.println("Failed");
    return 2;
  }

  // Enable MUX
  dbg.print("Enabling MUX... ");
  if (esp->enableMUX()) {
    dbg.println("OK");
  } else {
    dbg.println("Failed");
    return 3;
  }

  // Set the server's timeout and start it on the define port, ignore if this fails
  dbg.print("Setting TCP Server Timout... ");
  if (esp->setTCPServerTimeout(SERVER_TIMEOUT)) {
    dbg.println("OK");
  } else {
    dbg.println("Failed");
  }
  
  dbg.print("Starting TCP Server... ");
  if (esp->startTCPServer(SERVER_PORT)) {
    dbg.println("OK");
  } else {
    dbg.println("Failed");
    return 4;
  }

  // Dump the device's IP address
  dbg.print("Server is listening on ");
  dbg.print(esp->getLocalIP().c_str());
  dbg.print(":");
  dbg.println(SERVER_PORT);
  
  return 0;
}

void timer1_interrupt() {
  // We're ticking every 1ms for the PWM, but the biggest interval is LED_BLINK_INTERVAL
  if (++timer1Tick >= LED_BLINK_INTERVAL)
    timer1Tick = 0;
  
  /*
    Depending on the mode, we use different intervals:
    POST    Every 100ms
    ERROR   Every LED_BLINK_INTERVAL
    SLEEP   Do nothing
    ON      Every LED_BLINK_INTERVAL (to make sure the status LED is lit)
  */
  
  /*
    The following need to only need to fire every LED_BLINK_INTERVAL
    POST, ERROR, SLEEP, ON
  */
  if ((timer1Tick % LED_BLINK_INTERVAL) == 0) {
    if (currentmode == POST) {
      // Blink the status led
      digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
      
      // During POST, the LEDs will light in sequence
      uint8_t on = LED_COUNT; // Default to the last being on, so it will wrap to the first item
      for (uint8_t i = 0; i < LED_COUNT; i++) {
        if (LED_PWM[i] != 0)
          on = i + 1;
        LED_PWM[i] = 0; // Make sure they're all zeroed
      }
      
      LED_PWM[on >= LED_COUNT ? 0 : on] = 0x0c; // Do at only 5%
      setPWMValues((const uint8_t *)LED_PWM, 0, false);
     
    } else if (currentmode == ERROR) {
      /* If there's an error code, it blinks <error> times at an interval of
         2 times the timer inteval
         It then waits for 8 intervals before repeating
      */
  
      if (lasterr->step >= lasterr->totalSteps)
        lasterr->step = 0;

      if (lasterr->step >= lasterr->blinkSteps) {
        digitalWrite(STATUS_LED, LOW);
      } else if ((lasterr->step % 2) == 0) {
        digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));      
      }
      
      lasterr->step++;
      
    } else if (currentmode == SLEEP) {
      
    } else if (currentmode == ON) {
      
    }
  }
  
  // TODO: Use this for constant changing sequences
//  if ((timer1Tick % 100) == 0) {
//  }

  // Check if the sleep time has expired, unless there was an boot error
  if (currentmode != ERROR) {
    if ((timer1Tick % LED_BLINK_INTERVAL) == 0) {
      // Sleep after delay
      if (++sleepTicks > SLEEP_AFTER_TICKS) {
        currentmode = SLEEP;
        clearPWMValues();
      }
      
      // HACK: Restart the server after set period to deal with resets
      if (++restartServerTicks >  RESTART_SERVER_AFTER_TICKS) {
        esp->enableMUX();
        esp->setTCPServerTimeout(SERVER_TIMEOUT);
        esp->startTCPServer(SERVER_PORT);
        restartServerTicks = 0;
      }
    }
  }
}

void writeHelp(uint8_t mux_id) {
  String help = "+OK Mooring Lights LED Controller Help\r\n";
  
  // HELP
  help += "+OK\tHELP\tDisplays this message\r\n";
  help += "+OK\tTEMP\tDisplays the current temperature\r\n";
  
  // STATUS
  help += "+OK\tSTATUS\tReturns ";
  help += LED_COUNT;
  help += " uint8_ts containing the PWM level for each LED\r\n";
  
  // SET
  help += "+OK\tSET\tFollowed by ";
  help += LED_COUNT;
  help += " uint8_ts containing the PWM levels to be set\r\n";
  
  esp->send(mux_id, (uint8_t *)help.c_str(), help.length());
  
}

void writeStatus(uint8_t mux_id) {
  // Response is "+OK" + PWD values + "\r\n";
  uint8_t resplen = 3 + LED_COUNT + 2;
  uint8_t resp[resplen];
  
  strncpy((char*)resp, "+OK", 3);
  strncpy((char*)(resp + 3), (char*)LED_PWM, LED_COUNT);
  strncpy((char*)(resp + 3 + LED_COUNT), "\r\n", 2);

  esp->send(mux_id, resp, resplen);
}

void writeTemp(uint8_t mux_id) {
  // Read from the TMP36 - convert to millivolts
  float volts = 5000.0 * analogRead(A0) / 1023;
  
  // Range is 0.1V (-40 deg C) to 2V (150 deg C)
  int16_t temp = (volts - 500) / 10;
  
  // Don't output in binary, just use text
  String resp = "+OK";
  resp += temp;
  resp += "\r\n";
  
  esp->send(mux_id, (uint8_t *)resp.c_str(), resp.length());
}

