#include <Arduino.h>
#include <TimerOne.h>

#include "core.h";
#include "pwm.h";

PWM::PWM(const uint8_t * pins) {
  memcpy(this->pins, pins, PWM_COUNT);
  
  // Pins are initialised to off
  Serial.println(F("Setting up PWM..."));
  for (uint8_t i = 0; i < PWM_COUNT; i++) {
    uint8_t pin = this->pins[i];
    
    Serial.print(F("\tPWM"));
    Serial.print(i);
    Serial.print(F(" is on pin "));
    Serial.println(pin); 
    if ((pin == PWM_TIMER1_1) || (pin == PWM_TIMER1_2)) {
      Timer1.pwm(pin, 0); // Sets the pin mode and the sets the duty cycle
    } else {
      pinMode(pin, OUTPUT);
      analogWrite(pin, 0);
    }

    // Trimpot acts as limiter
    pinMode(TRIM_0, INPUT);
    Serial.print(F("Light limiter is on pin "));
    Serial.println(TRIM_0); 

    this->current[i] = 0;
    this->last[i] = 0;
    this->next[i] = 0;
  }
}

void PWM::doStep() {
  if (this->index == this->steps)
    return;

  // Cache the trim value as a 8 bit value
  this->trimValue = analogRead(TRIM_0) >> 2;
  
  int16_t from, to;
  for (uint8_t i = 0; i < PWM_COUNT; i++) {
    from = this->last[i];
    to = this->next[i];
    
    // Cast to float, as ints get prompted to uint
    this->setLight(i, (from + ((float)(to - from) * (this->index + 1) / this->steps)));
  }
  
  this->index++;
}

bool PWM::getState(uint8_t * values) const {
  if (values) {
    memcpy(values, this->current, PWM_COUNT);
  }
  for (uint8_t i = 0; i < PWM_COUNT; i++) {
    if (this->current[i]) {
      return true;
    }
  }
  
  return false;
}

void PWM::setLight(uint8_t index, uint8_t value) {
  this->current[index] = value;

  // The actual value written is compressed between 1 and 255 using the trimpot
  if (value != 0) {
    value = 1 + (uint16_t)(value - 1) * this->trimValue / 255;
    
  }

  if ((pins[index] == PWM_TIMER1_1) || (pins[index] == PWM_TIMER1_2)) {
    Timer1.setPwmDuty(this->pins[index], (uint16_t)value << 2); // Timer1 pwm is 10bit
  } else {
    analogWrite(this->pins[index], value);
  }
}

void PWM::setLights(uint8_t * lights, uint16_t steps) {
  // Copy the current light setting into the last
  memcpy(this->last, this->current, PWM_COUNT);

  // Copy the new lights into the next
  memcpy(this->next, lights, PWM_COUNT);
  
  // Reset the fade index
  this->index = 0;
  this->steps = steps;
  
  this->doStep();
}


