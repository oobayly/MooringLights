#include "Arduino.h"

#include "passwords.h"

#ifndef CORE_H
#define CORE_H

#ifndef AP_SSID
  #define AP_SSID F("")
#endif
#ifndef AP_PASS
  #define AP_PASS F("")
#endif

// Debug serial
#define DEBUG
#define DEBUG_BAUD 115200
#define READ_BUFFER_SIZE 128
#define SERIAL_TIMEOUT 100 /* Serial read timeout (in ms) */

// ESP8266
#define ESP_BAUD 9600
#define ESP_TX 7
#define ESP_RX 8

// Timer1
#define TIMER1_INTERVAL 50 /* Timer 1 interval (in ms) - can't be too low or it messes with SoftwareSerial */
#define LED_BLINK_INTERVAL 250 /* LED Blink interval (in ms) */
#define LED_BLINK_TICKS (LED_BLINK_INTERVAL / TIMER1_INTERVAL)

// Reset times
#define CHECK_ESP_INTERVAL 60000 /* The interval after which the controller should check if the ESP module has reset (in ms) */
#define RESET_WIFI_INTERVAL 60000 /* The interval after which the controller should reconnect the WiFi after an error (in ms) */
//#define SLEEP_AFTER_INTERVAL 7200000 /* The timer after which the controller should go to sleep (in ms) */

#define CHECK_ESP_TICKS (CHECK_ESP_INTERVAL / TIMER1_INTERVAL)
#define RESET_WIFI_TICKS (RESET_WIFI_INTERVAL / TIMER1_INTERVAL)
//#define SLEEP_AFTER_TICKS (SLEEP_AFTER_INTERVAL / TIMER1_INTERVAL)

// TCP Server settings
#define SERVER_PORT 8888
#define SERVER_TIMEOUT 15

// The Status LED
#define STATUS_LED LED_BUILTIN

// Temperature sensor
#define TEMP_PIN A0

// RF
#define RF_COUNT 3
#define RF_TRIGGER 2
#define RF_INTERRUPT INT0 /* Pin 2 */
#define RF_PINS {A4, A3, 4}
#define RF_NONE 0xff /* index used when no rf pin is active */
#define RF_DEBOUNCE 100 /* Debounce time (in ms) */
#define RF_RX_LED 12

typedef struct Trigger {
  uint8_t from, to;
  bool state, hasChanged;
} Trigger;

// PWM
#define PWM_COUNT 6
//#define PWM_PINS {5, 9, 11, 10, 6, 3} /* In pairs, Outer, Middle, Inner */
#define PWM_PINS {11, 10, 9, 6, 5, 3} /* From left to right */
#define PWM_TIMER1_1 9 /* This pin is needs to use Timer1's pwm method */
#define PWM_TIMER1_2 10 /* This pin is needs to use Timer1's pwm method */

// Trimpots
#define TRIM_0 A7

// Extra pins
#define EXTRA_0 A1
#define EXTRA_1 A2
#define EXTRA_2 A5
#define EXTRA_3 A6

// EEPROM
#define EEPROM_PROG_OFFSET 32

// Lights
#define LIGHTS_MAX_COUNT 6
//#define LIGHTS_FADE_INTERVAL 500 /* Fade interval between programs (is ms) */

// Defines a chaser
typedef struct Chaser {
  uint16_t interval; // The fade interval (in ms)
  uint8_t count; // Fade count
  uint8_t index = 0;
  uint8_t lights[LIGHTS_MAX_COUNT][PWM_COUNT];

  void clear() {
    count = 1;
    for (uint8_t i = 0; i < PWM_COUNT; i++) {
      lights[0][i] = 0;
    }
  };
} Chaser;
typedef struct Program {
  Chaser * const current = new Chaser();
  Chaser * const queued = new Chaser();
  bool hasChanged = false;
};

// Counter
typedef struct Counter {
  uint32_t tick = 0;
  uint32_t timer1 = 0;
  uint32_t check_esp = 0;
  uint32_t reset_wifi = 0;
  uint32_t sleep = 0;
} Counter;

// Errors
typedef struct Error {
  volatile uint8_t code;
  volatile uint16_t step;
  volatile uint16_t blinkSteps;
  volatile uint16_t totalSteps;
} Error;

// Configuration
typedef struct Config {
  uint16_t fade_interval;
  uint32_t sleep_interval;
} Config;

// The mode type
typedef enum {
  POST, // Power on self test
  ERROR, // An error was encountered - check the lasterr variable
  SLEEP, // Timed out, lights are turned off
  ON, // Lights have been set
} mode_e;


#endif

