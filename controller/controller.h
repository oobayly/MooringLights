#include <ESP8266.h>
#include <SoftwareSerial.h>

#ifndef CONTROLLER_H
#define CONTROLLER_H

// Debugging serial configuration
#define DEBUG_BAUD 115200

// How many LEDs are there
const uint8_t LED_COUNT = 6;

// The number of seconds after which the controller should check if the ESP module has reset
#define CHECK_ESP_AFTER_SECONDS 60

// The number of seconds after which the wifi should reconnect when an error was encountered
#define RESET_WIFI_AFTER_SECONDS 60

// The number of seconds after which the lights will be turned off
#define SLEEP_AFTER_SECONDS 7200

// The status led blink interval in milliseconds
#define LED_BLINK_INTERVAL 250

// Wireless Access point configuration
#define AP_SSID "TipsTradePublic"
#define AP_PASS "notorrentingrich"

// TCP server configuration
#define SERVER_TIMEOUT 10
#define SERVER_PORT 8888

// Soft serial configuration used for the WiFi board
const uint8_t ESP_RX = 7;
const uint8_t ESP_TX = 8;
const uint16_t ESP_BAUD = 9600;


/*
  Type definitions
*/

// The error container 
typedef struct {
  volatile uint8_t code;
  volatile uint16_t step;
  volatile uint16_t blinkSteps;
  volatile uint16_t totalSteps;
} error;

// The mode type
typedef enum {
  POST, // Power on self test
  ERROR, // An error was encountered - check the lasterr variable
  SLEEP, // Timed out, lights are turned off
  ON, // Lights have been set
} mode; 


/*
  Globals
*/

// The current last error encountered
error * const lasterr = new error();

// The current
volatile mode currentmode = POST;

// 
ESP8266 * esp;
SoftwareSerial * uart;

// The buffer for reading from the serial port
#define BUFFER_SIZE 128
uint8_t * const buffer = new uint8_t[BUFFER_SIZE];

// Use UART for debug output
#define dbg Serial

// The LED that is used for showing the status, errors, etc
const uint8_t STATUS_LED = LED_BUILTIN;
volatile uint16_t timer1Tick = 0;

// The LED configuration
const uint8_t * LEDS = new uint8_t[LED_COUNT] {3, 6, 10, 11, 9, 5};
volatile uint8_t * LED_PWM = new uint8_t[LED_COUNT];

// The timer interval in microseconds - this should give us a PWM of 1kHz
const uint16_t TIMER_INTERVAL = 1000;

// Restart server time
const uint16_t CHECK_ESP_AFTER_TICKS = CHECK_ESP_AFTER_SECONDS * (1000 / LED_BLINK_INTERVAL);
volatile uint16_t checkESPTicks = 0;

// Wifi reset interval
const uint16_t RESET_WIFI_AFTER_TICKS = RESET_WIFI_AFTER_SECONDS * (1000 / LED_BLINK_INTERVAL);
volatile uint16_t resetWifiTicks = 0;

// Sleep time
const uint16_t SLEEP_AFTER_TICKS = SLEEP_AFTER_SECONDS * (1000 / LED_BLINK_INTERVAL);
volatile uint16_t sleepTicks = 0;

/*
  Methods
*/

// Clears all the PWM values and writes them to the pins
void clearPWMValues();

// Sets the PWM values (using the specified offset) and writes them to the pins
void setPWMValues(const uint8_t * values, uint8_t offset, bool doPrint);

// Sets the Last error
void setLastError(uint8_t code);

// Configures the LED pins
void setupLEDs();

// Configures the WiFi adapter
uint8_t setupWifi();

// The interrupt for Timer1
void timer1_interrupt();

// Writes the help text to the TCP socket
void writeHelp(uint8_t mux_id);

// Writes the current Status to the TCP socket
void writeStatus(uint8_t mux_id);

// Writes the temperature to the TCP socket
void writeTemp(uint8_t mux_id);

#endif

