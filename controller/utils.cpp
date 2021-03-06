#include <EEPROM.h>

#include "core.h"
#include "utils.h"

void chaser_read(uint8_t number, Chaser * const chaser) {
  uint16_t offset = EEPROM_PROG_OFFSET + (number * sizeof(Chaser));

  uint8_t * buffer = (uint8_t *)chaser;

  for (uint8_t i = 0; i < sizeof(Chaser); i++) {
    buffer[i] = EEPROM.read(offset + i);
  }
  
  // Reset the index to zero
  chaser->index = 0;
}

void chaser_write(uint8_t number, const Chaser * const chaser) {
  uint16_t offset = EEPROM_PROG_OFFSET + (number * sizeof(Chaser));

  uint8_t * buffer = (uint8_t *)chaser;

  // Don't write unless the EEPROM data has actually changed
  uint8_t old;
  for (uint8_t i = 0; i < sizeof(Chaser); i++) {
    old = EEPROM.read(offset + i);
    if (buffer[i] != old) {
      EEPROM.write(offset + i, buffer[i]);
    }
  }
}

void config_read(Config * const config) {
  uint8_t * buffer = (uint8_t *)config;

  for (uint8_t i = 0; i < sizeof(Config); i++) {
    buffer[i] = EEPROM.read(i);
  }
}

void config_write(const Config * const config) {
  uint8_t * buffer = (uint8_t *)config;

  // Don't write unless the EEPROM data has actually changed
  uint8_t old;
  for (uint8_t i = 0; i < sizeof(Config); i++) {
    old = EEPROM.read(i);
    if (buffer[i] != old) {
      EEPROM.write(i, buffer[i]);
    }
  }
}
int16_t temperature_read() {
  // Read from the TMP36 - convert to millivolts
  float level = 5.0 * 1000 * analogRead(TEMP_PIN) / 1023;
  
  // Range is 0.1V (-40 deg C) to 2V (150 deg C)
  return (int16_t)((level - 500) / 10);
}

