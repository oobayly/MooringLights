#include "core.h"

#ifndef PWM_H
#define PWM_H

class PWM {
  public:
    PWM(const uint8_t * pins);
    
    void doStep();
    
    bool getState(uint8_t * values) const;
    
    void setLights(uint8_t * lights, uint16_t steps);
  
  private:
    uint8_t trimValue = 0;

    uint8_t current[PWM_COUNT];
    uint8_t last[PWM_COUNT];
    uint8_t next[PWM_COUNT];
  
    uint8_t pins[PWM_COUNT];
    
    uint16_t index, steps;
    
    void setLight(uint8_t index, uint8_t value);
};

#endif

