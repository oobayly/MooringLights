#include "core.h"
#include "pwm.h"
#include "rf.h"
#include "wifi.h"

#ifndef CONTROLLER_H
#define CONTROLLER_H

WiFi * const wifi = new WiFi();

RF * rf = NULL;
Trigger * const trigger = new Trigger();

PWM * pwm = NULL;

volatile Program * const program = new Program();

// Reset counters
volatile Counter * const counters = new Counter();

// Mode & Error
volatile mode_e mode = POST;
Error * const error = new Error();

void setup();

void setupPrograms();

void setupPWM();

void setupRF();

bool setupWiFi();

void loop();

void clearChaser();

void queueChaser();

void queueChaser(uint8_t index);

void rf_trigger();

void setLastError(uint8_t code);

void timer1_tick();

#endif

