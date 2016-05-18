#include <Arduino.h>

#include "core.h"
#include "rf.h"

RF::RF(const uint8_t * pins) {
  memcpy(this->pins, pins, PWM_COUNT);

  Serial.println(F("Setting up RF..."));
  for (uint8_t i = 0; i < RF_COUNT; i++) {
    uint8_t pin = this->pins[i];
    Serial.print(F("\tDat"));
    Serial.print(i);
    Serial.print(F(" is on pin "));
    Serial.println(pin);
    pinMode(pin, INPUT);
  }
  
  Serial.println(F("\tDAT3 is hard reset"));
  pinMode(RF_TRIGGER, INPUT);

  Serial.print(F("\tRX LED is on pin "));
  Serial.println(RF_RX_LED);
  pinMode(RF_RX_LED, OUTPUT);
}

uint8_t RF::getIndex() {
  return this->index;
}

bool RF::getState() {
  return this->state;
}

bool RF::getState(uint8_t * index,  uint8_t * lastIndex) {
//  uint32_t now = millis();
//  if ((now - this->lastTime) <= RF_DEBOUNCE) {
//    this->lastTime = now;
//    return false;
//  }

  // Read in the state and update the RX LED
  this->state = digitalRead(RF_TRIGGER);
  digitalWrite(RF_RX_LED, this->state);

  // Cache the previous index
  uint8_t last = this->index;
  
  *index = RF_NONE;
  for (uint8_t i = 0; i < RF_COUNT; i++) {
    if (digitalRead(this->pins[i])) {
      *index = i;
      break;
    }
  }

  // If the button has been released, then use the previous index
  if(!this->state) {
    *index = last; 
  }
  
  this->index = *index;

  if (lastIndex != NULL) {
    *lastIndex = last;
  }
  
  return this->state;
}

