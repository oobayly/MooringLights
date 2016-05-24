#ifndef UTILS_H
#define UTILS_H

#include "core.h"

void chaser_read(uint8_t number, Chaser * const chaser);

void chaser_write(uint8_t number, const Chaser * const chaser);

void config_read(Config * const config);

void config_write(const Config * const config);

int16_t temperature_read();

#endif

