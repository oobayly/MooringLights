#include <Arduino.h>
#include <ESP8266.h>
#include <SoftwareSerial.h>

#include "core.h"
#include "pwm.h"

#ifndef WIFI_H
#define WIFI_H

class WiFi {
  public:
    WiFi();

    bool getState();

    bool setup(uint8_t * error);

    bool read(Config * const config, const PWM * const pwm, Chaser * const chaser);

  private:
    uint8_t * const buffer = new uint8_t[READ_BUFFER_SIZE];
  
    SoftwareSerial * const uart = new SoftwareSerial(ESP_RX, ESP_TX);
    ESP8266 * const esp = new ESP8266(*this->uart, ESP_BAUD);

    void empty();

    uint8_t setup();

    void writeResponse(bool fromWiFi, uint8_t mux_id, uint8_t * message, uint8_t length);
    void writeResponse(bool fromWiFi, uint8_t mux_id, String message);
  
};

#endif

