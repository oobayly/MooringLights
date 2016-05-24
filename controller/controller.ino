#include <ESP8266.h>
#include <SoftwareSerial.h> 
#include <TimerOne.h>

#include "core.h"
#include "controller.h"
#include "pwm.h"
#include "rf.h"
#include "utils.h"
#include "wifi.h"

void setup() {
#ifdef DEBUG
  Serial.begin(DEBUG_BAUD);
  Serial.setTimeout(SERIAL_TIMEOUT);
#endif

  // Read in the saved configuration, and make sure it's with acceptable bounds
  Serial.println("Loading configuration...");
  config_read((Config *)config);
  if (config->fade_interval < 250) {
    config->fade_interval = 250;
  }
  if (config->sleep_interval < 30000) {
    config->sleep_interval = 7200000;
  }
  Serial.print("\tFade Interval:\t");
  Serial.println(config->fade_interval);
  Serial.print("\tSleep Interval:\t");
  Serial.println(config->sleep_interval);

  pinMode(STATUS_LED, OUTPUT);
  pinMode(TEMP_PIN, INPUT); // TMP36

  // Need to initialise this before any further calls are made to it
  Timer1.initialize(1000);
  Timer1.attachInterrupt(timer1_tick);

  setupChasers();
  setupPWM();
  setupRF();
  setupWiFi();

  clearChaser();
  
  // Wait for any debug output to be sent
#ifdef DEBUG
  delay(1000);
#endif
}

void setupChasers() {
  Chaser l;
  l.count = 4;
  l.interval = 500;
  l.lights[0][0] = 0xff;
  l.lights[0][1] = 0x00;
  l.lights[0][2] = 0x00;
  l.lights[0][3] = 0x00;
  l.lights[0][4] = 0x00;
  l.lights[0][5] = 0xff;
  l.lights[1][0] = 0x00;
  l.lights[1][1] = 0xff;
  l.lights[1][2] = 0x00;
  l.lights[1][3] = 0x00;
  l.lights[1][4] = 0xff;
  l.lights[1][5] = 0x00;
  l.lights[2][0] = 0x00;
  l.lights[2][1] = 0x00;
  l.lights[2][2] = 0xff;
  l.lights[2][3] = 0xff;
  l.lights[2][4] = 0x00;
  l.lights[2][5] = 0x00;
  l.lights[3][0] = 0x00;
  l.lights[3][1] = 0x00;
  l.lights[3][2] = 0x00;
  l.lights[3][3] = 0x00;
  l.lights[3][4] = 0x00;
  l.lights[3][5] = 0x00;
  chaser_write(0, &l);

  l.count=2;
  l.interval = 2000;
  l.lights[0][0] = 0xff;
  l.lights[0][1] = 0xff;
  l.lights[0][2] = 0xff;
  l.lights[0][3] = 0xff;
  l.lights[0][4] = 0xff;
  l.lights[0][5] = 0xff;
  l.lights[1][0] = 0x0;
  l.lights[1][1] = 0x0;
  l.lights[1][2] = 0x0;
  l.lights[1][3] = 0x0;
  l.lights[1][4] = 0x0;
  l.lights[1][5] = 0x0;
  chaser_write(1, &l);

  l.count=1;
  l.interval = 10000;
  l.lights[0][0] = 0xff;
  l.lights[0][1] = 0xff;
  l.lights[0][2] = 0xff;
  l.lights[0][3] = 0xff;
  l.lights[0][4] = 0xff;
  l.lights[0][5] = 0xff;
  chaser_write(2, &l);
}

void setupPWM() {
  const uint8_t pins[] = PWM_PINS;
  pwm = new PWM(pins);
}

void setupRF() {
  const uint8_t pins[] = RF_PINS;
  rf = new RF(pins);
  attachInterrupt(RF_INTERRUPT, rf_trigger, CHANGE);

}

bool setupWiFi() {
  uint8_t error;
  bool resp = wifi->setup(&error);

  if (resp) {
    mode = ON;
    digitalWrite(STATUS_LED, HIGH);
  } else {
    mode = ERROR;
    setLastError(error);
  }
  
  return resp;
}

void loop() {
  if (wifi->read((Config *)config, pwm, program->queued)) {
    queueChaser();
  }
  
  if (trigger->hasChanged) {
    trigger->hasChanged = false;
    Serial.print(F("Tigger changed: "));
    Serial.print(trigger->state ? F("HIGH ") : F("LOW "));
    Serial.print(trigger->from);
    Serial.print(F(" -> "));
    Serial.println(trigger->to);
  }

  if (counters->check_esp > CHECK_ESP_TICKS) {
    if (!wifi->getState()) {
      Serial.println(F("Multiplexing disabled - restarting TCP Server"));
      setupWiFi();
    }
    counters->check_esp = 0;
  
  } else if (counters->reset_wifi > RESET_WIFI_TICKS) {
    Serial.print(F("Got WiFi error #"));
    Serial.print(error->code);
    Serial.println(F(": Resetting..."));
    setupWiFi();
    counters->reset_wifi = 0;
    
  }
}

void clearChaser() {
  program->queued->clear();
  queueChaser();
}

void queueChaser(uint8_t index) {
  chaser_read(index, program->queued);
  queueChaser();
}

void queueChaser() {
  program->hasChanged = true;
  mode = ON;
  counters->sleep = 0;
}

void rf_trigger() {
  uint8_t index, lastIndex;
  bool state = rf->getState(&index, &lastIndex);
  if (state && (index != RF_NONE)) {
    // If the same button was pressed as last time, switch the lights off
    if ((lastIndex == index) && pwm->getState(NULL)) {
      clearChaser();
    } else {
      queueChaser(index);
    }
  }

  // Used for signalling the main loop that the RF trigger has changed so that it can be logged
  trigger->from = lastIndex;
  trigger->to = index;
  trigger->state = state;
  trigger->hasChanged = true;
}

void setLastError(uint8_t code) {
  error->code = code;
  error->step = 0;
  error->blinkSteps = 2 * ((2 * code) - 1); // Blink every 2 intervals
  error->totalSteps = error->blinkSteps + 8; // Followed by 8 intervals
}

void timer1_tick() {
  // Ticks every 1ms, but on work every TIMER1_INTERVAL
  if (counters->tick = (counters->tick + 1) % TIMER1_INTERVAL) {
    return;
  }
  
  if (mode == POST) {
    // Every LED_BLINK_INTERVAL
    counters->timer1 = (counters->timer1 + 1) % LED_BLINK_TICKS;
    if (counters->timer1 == 0) {
      digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
    }
    
  } else if (mode == ERROR) {
    counters->reset_wifi++;
    
    // Every LED_BLINK_INTERVAL
    counters->timer1 = (counters->timer1 + 1) % LED_BLINK_TICKS;
    if (counters->timer1 == 0) {
      /* If there's an error code, it blinks <error> times at an interval of
         2 times the timer inteval
         It then waits for 8 intervals before repeating
      */
  
      if (error->step >= error->blinkSteps) {
        digitalWrite(STATUS_LED, LOW);
      } else if ((error->step % 2) == 0) {
        digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
      }
      
      error->step = (error->step + 1) % error->totalSteps;
    }
    
  } else if (mode == ON) {
    // Every TIMER1_INTERVAL
    counters->timer1++;
    counters->check_esp++;
    if (++counters->sleep > (config->sleep_interval / TIMER1_INTERVAL)) {
      counters->sleep = 0;
      clearChaser();
    }
    
    if (program->hasChanged) {
      counters->timer1 = 0;
      program->hasChanged = false;
      
      // Copy in the queued program, and make sure were' on the first light scheme
      memcpy(program->current, program->queued, sizeof(Chaser));
      program->current->index = 0;
      
      pwm->setLights(program->current->lights[program->current->index], config->fade_interval / TIMER1_INTERVAL);
      
    } else if ((program->current->count > 1) && (counters->timer1 % (program->current->interval / TIMER1_INTERVAL)) == 0) {
      // Multiple settings and program fade interval has elapsed
      program->current->index = (program->current->index + 1) % program->current->count;
      
      pwm->setLights(program->current->lights[program->current->index], program->current->interval / TIMER1_INTERVAL);
      
    } else {
      pwm->doStep();
      
    }
  }
}


