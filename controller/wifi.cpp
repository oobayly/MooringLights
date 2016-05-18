#include <Arduino.h>
#include <ESP8266.h>
#include <SoftwareSerial.h>

#include "core.h"
#include "pwm.h"
#include "utils.h"
#include "wifi.h"

WiFi::WiFi() {
}

void WiFi::empty() {
  while (uart->available()) {
    uart->read();
  }
}

bool WiFi::getState() {
  return esp->getMUX();
}

bool WiFi::read(const PWM * const pwm, Chaser * const chaser) {
  uint8_t len = 0;
  uint8_t mux_id;
  bool fromWiFi = false;

  // Read from the 
  if (Serial.available()) {
    len = Serial.readBytes(this->buffer, READ_BUFFER_SIZE);
  } else if (this->uart->available()) {
    len = esp->recv(&mux_id, buffer, READ_BUFFER_SIZE, SERIAL_TIMEOUT);
    fromWiFi = true;
  }

  if (!len) {
    return false;
  }

#ifdef DEBUG
  Serial.print(F("Received "));
  Serial.print(len);
  Serial.print(F(" bytes:\t"));
  for (uint8_t i = 0; i < len; i++) {
    if (buffer[i] < 0x10) {
      Serial.print(0);
    }
    Serial.print(buffer[i], HEX);
    Serial.print(' ');
  }
  Serial.println();
#endif

  bool resp = false;
  if ((len == 8) && (strncmp((char *)this->buffer, "LOAD ", 5) == 0)) {
    // Load c\r\n
    uint8_t number = buffer[5] - 0x30;
    if (number < RF_COUNT) {
      memory_read(number, chaser);
      writeResponse(fromWiFi, mux_id, F("+OK"));
      resp = true;
    }
    
  } else if ((len == 7) && (strncmp((char *)this->buffer, "BLANK\r\n", 7) == 0)) {
    // BLANK\r\n
    chaser->clear();
    writeResponse(fromWiFi, mux_id, F("+OK"));
    resp = true;

  } else if ((len == 4 + PWM_COUNT + 2) && (strncmp((char *)this->buffer, "SET ", 4) == 0)) {
    // SET cccccc\r\n
    chaser->count = 1;
    for (uint8_t i = 0; i < PWM_COUNT; i++) {
      chaser->lights[0][i] = buffer[4 + i];
    }
    writeResponse(fromWiFi, mux_id, F("+OK"));
    resp = true;

  } else if ((len == 6) && (strncmp((char *)this->buffer, "TEMP\r\n", 6) == 0)) {
    // TEMP\r\n
    String message = F("+OK");
    message += ' ';
    message += temperature_read();
    writeResponse(fromWiFi, mux_id, message);
    resp = false;
    
  } else if ((len == 8) && (strncmp((char *)this->buffer, "STATUS\r\n", 8) == 0)) {
    // STATUS\r\n
    uint8_t pins[PWM_COUNT];
    pwm->getState(pins);

    // Can't use String as it may contain nulls
    uint8_t message[4 + PWM_COUNT];
    memcpy(message, "+OK ", 4);
    memcpy(message + 4, pins, PWM_COUNT);

    writeResponse(fromWiFi, mux_id, message, 4 + PWM_COUNT);
    resp = false;
    
  } else {
    // Everything else is unknown
    writeResponse(fromWiFi, mux_id, F("-ER"));
  }

  if (fromWiFi) {
    this->esp->releaseTCP(mux_id);
  }

  return resp;
}

bool WiFi::setup(uint8_t * error) {
  uint8_t resp = this->setup();

  if (error) {
    *error = resp;
  }

  return resp == 0;
}


uint8_t WiFi::setup() {
  // Empty the UART buffer first
  this->empty();
  
  Serial.println(F("Setting up WiFi..."));
  Serial.print(F("\tVersion: "));
  Serial.println(esp->getVersion().c_str());

  // Make sure we're in client mode
  Serial.print(F("\tSetting to Station... "));
  if (esp->setOprToStation()) {
    Serial.println(F("OK"));
  } else {
    Serial.println(F("Failed"));
    return 1;
  }
  
  // Connect to the AP
  Serial.print(F("\tConnecting to "));
  Serial.print(AP_SSID);
  Serial.print(F("... "));
  if (esp->joinAP(AP_SSID, AP_PASS)) {
    Serial.println(F("OK"));
  } else {
    Serial.println(F("Failed"));
    return 2;
  }

  // Enable MUX
  Serial.print(F("\tEnabling MUX... "));
  if (esp->enableMUX()) {
    Serial.println(F("OK"));
  } else {
    Serial.println(F("Failed"));
    return 3;
  }
    
  Serial.print("\tStarting TCP Server... ");
  if (esp->startTCPServer(SERVER_PORT)) {
    Serial.println(F("OK"));
  } else {
    Serial.println(F("Failed"));
    return 4;
  }

  Serial.print(F("\tSetting TCP Server Timout... "));
  if (esp->setTCPServerTimeout(SERVER_TIMEOUT)) {
    Serial.println(F("OK"));
  } else {
    Serial.println(F("Failed"));
  }  

  // Dump the device's IP address
  Serial.print(F("\tServer is listening on "));
  Serial.print(esp->getLocalIP().c_str());
  Serial.print(F(":"));
  Serial.println(SERVER_PORT);
  
  return 0;
}

void WiFi::writeResponse(bool fromWiFi, uint8_t mux_id, uint8_t * message, uint8_t length) {
  if (fromWiFi) {
    esp->send(mux_id, (uint8_t *)message,length);
  } else {
    for (uint8_t i = 0; i < length; i++) {
      Serial.print((char)message[i]);
    }
    Serial.println();
  }
}

void WiFi::writeResponse(bool fromWiFi, uint8_t mux_id, String message) {
  if (fromWiFi) {
    esp->send(mux_id, (uint8_t *)message.c_str(), message.length());
  } else {
    Serial.println(message);
  }
}

