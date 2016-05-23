#ifndef UTILS_H
#define UTILS_H

#include "core.h"

void memory_read(uint8_t number, Chaser * const chaser);

void memory_write(uint8_t number, const Chaser * const chaser);

int16_t temperature_read();

#endif

