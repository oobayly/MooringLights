#include "core.h"

#ifndef RF_H
#define RF_H

class RF {
  public:
    RF(const uint8_t * pins);
    
     
    uint8_t getIndex();

    bool getState();

    bool getState(uint8_t * index,  uint8_t * lastIndex = NULL);
 
  private:
    bool state = false;
  
    uint8_t index = RF_NONE;
    
    uint32_t lastTime = 0;
    
    uint8_t pins[RF_COUNT];
};

#endif
