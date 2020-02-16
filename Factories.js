let Util = require('Util');
const Factories = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            const memRoom = Memory.MemRooms[gameRoomKey];
            if (memRoom && memRoom.FctrId !== '-' && gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8 && memRoom) {
                let factory;
                if(memRoom.FctrId){
                    factory = Game.getObjectById(memRoom.FctrId)
                }
                if(!factory){
                    factory = gameRoom.find(FIND_MY_STRUCTURES, {
                        filter: function (factory) {
                            return factory.structureType === STRUCTURE_FACTORY && factory.cooldown === 0 && factory.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                        }
                    })[0];
                    if(factory) {
                        memRoom.FctrId = factory.id;
                        Util.InfoLog('Factories', '', 'add new factory in ' + gameRoomKey + ' FctrId ' + memRoom.FctrId);
                    }
                }
                if(factory && factory.cooldown === 0){
                    let result;
                    if(factory.level === 1
                        && factory.store.getUsedCapacity(RESOURCE_OXIDANT) >= 36
                        && factory.store.getUsedCapacity(RESOURCE_CELL) >= 20
                        && factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) >= 16
                        && factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 8
                        && factory.store.getUsedCapacity(RESOURCE_PHLEGM) < 2000
                        && factory.effects[0] && factory.effects[0].effect === PWR_OPERATE_FACTORY
                    ){
                        result = factory.produce(RESOURCE_PHLEGM);
                        Util.Info('Factories', '', factory.pos.roomName + ' producing ' + RESOURCE_PHLEGM + ' ' + factory.store.getUsedCapacity(RESOURCE_PHLEGM) + ' ' + result + ' ' + RESOURCE_LEMERGIUM_BAR + ' ' + factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) + ' ' + RESOURCE_CELL + ' ' + factory.store.getUsedCapacity(RESOURCE_CELL) + ' ' + RESOURCE_OXIDANT + ' ' + factory.store.getUsedCapacity(RESOURCE_OXIDANT) + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY));
                    }
                    else if(factory.level === 2
                        && factory.store.getUsedCapacity(RESOURCE_PHLEGM) >= 10
                        && factory.store.getUsedCapacity(RESOURCE_CELL) >= 10
                        && factory.store.getUsedCapacity(RESOURCE_REDUCTANT) >= 110
                        && factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 16
                        && factory.store.getUsedCapacity(RESOURCE_TISSUE) < 2000
                        && factory.effects[0] && factory.effects[0].effect === PWR_OPERATE_FACTORY
                    ){
                        result = factory.produce(RESOURCE_TISSUE);
                        Util.Info('Factories', '', factory.pos.roomName + ' producing ' + RESOURCE_TISSUE + ' ' + factory.store.getUsedCapacity(RESOURCE_TISSUE) + ' ' + result + ' ' + RESOURCE_REDUCTANT + ' ' + factory.store.getUsedCapacity(RESOURCE_REDUCTANT) + ' ' + RESOURCE_CELL + ' ' + factory.store.getUsedCapacity(RESOURCE_CELL) + ' ' + RESOURCE_PHLEGM + ' ' + factory.store.getUsedCapacity(RESOURCE_PHLEGM) + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY));
                    }
                    else if(factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 200
                        && factory.store.getUsedCapacity(RESOURCE_LEMERGIUM) >= 500
                        && factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) < 1000
                    ){
                        result = factory.produce(RESOURCE_LEMERGIUM_BAR);
                        Util.Info('Factories', '', factory.pos.roomName + ' producing ' + RESOURCE_LEMERGIUM_BAR + ' ' + factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) + ' ' + result + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY) + ' ' + RESOURCE_LEMERGIUM + ' ' + factory.store.getUsedCapacity(RESOURCE_LEMERGIUM));
                    }
                    else if(factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 200
                        && factory.store.getUsedCapacity(RESOURCE_OXYGEN) >= 500
                        && factory.store.getUsedCapacity(RESOURCE_OXIDANT) < 1000
                    ){
                        result = factory.produce(RESOURCE_OXIDANT);
                        Util.Info('Factories', '', factory.pos.roomName + ' producing ' + RESOURCE_OXIDANT + ' ' + factory.store.getUsedCapacity(RESOURCE_OXIDANT) + ' ' + result + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY) + ' ' + RESOURCE_OXYGEN + ' ' + factory.store.getUsedCapacity(RESOURCE_OXYGEN));
                    }
                    else if(factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 200
                        && factory.store.getUsedCapacity(RESOURCE_HYDROGEN) >= 500
                        && factory.store.getUsedCapacity(RESOURCE_REDUCTANT) < 1000
                    ){
                        result = factory.produce(RESOURCE_REDUCTANT);
                        Util.Info('Factories', '', factory.pos.roomName + ' producing ' + RESOURCE_REDUCTANT + ' ' + factory.store.getUsedCapacity(RESOURCE_REDUCTANT) + ' ' + result + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY) + ' ' + RESOURCE_HYDROGEN + ' ' + factory.store.getUsedCapacity(RESOURCE_HYDROGEN));
                    }
                    else if(factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) >= 20
                        && factory.store.getUsedCapacity(RESOURCE_BIOMASS) >= 100
                        && factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 40
                        && factory.store.getUsedCapacity(RESOURCE_CELL) < 1000
                    ){
                        result = factory.produce(RESOURCE_CELL);
                        Util.Info('Factories', '', factory.pos.roomName + ' producing ' + RESOURCE_CELL + ' ' + factory.store.getUsedCapacity(RESOURCE_CELL) + ' ' + result + ' ' + RESOURCE_LEMERGIUM_BAR + ' ' + factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) + ' ' + RESOURCE_BIOMASS + ' ' + factory.store.getUsedCapacity(RESOURCE_BIOMASS) + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY));
                    }
                }else if(!factory){ // no factory in this room - set FctrId so that it wont look again
                    memRoom.FctrId = '-';
                    Util.InfoLog('Factories', '', 'no factory in ' + gameRoomKey + ' FctrId set to -');
                }
            }
        }
    }
};
module.exports = Factories;