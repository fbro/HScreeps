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
                            return factory.structureType === STRUCTURE_FACTORY && factory.cooldown === 0 && factory.store[RESOURCE_ENERGY] > 0;
                        }
                    })[0];
                    if(factory) {
                        memRoom.FctrId = factory.id;
                    }
                }
                if(factory && factory.cooldown === 0){
                    let result;
                    if(factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 200
                        && factory.store.getUsedCapacity(RESOURCE_LEMERGIUM) >= 500
                        && factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) < 500){
                        result = factory.produce(RESOURCE_LEMERGIUM_BAR);
                        console.log('Factories ' + factory.pos.roomName + ' producing ' + RESOURCE_LEMERGIUM_BAR + ' ' + factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) + ' ' + result + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY) + ' ' + RESOURCE_LEMERGIUM + ' ' + factory.store.getUsedCapacity(RESOURCE_LEMERGIUM));
                    }
                    else if(factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 200
                        && factory.store.getUsedCapacity(RESOURCE_OXYGEN) >= 500
                        && factory.store.getUsedCapacity(RESOURCE_OXIDANT) < 500){
                        result = factory.produce(RESOURCE_OXIDANT);
                        console.log('Factories ' + factory.pos.roomName + ' producing ' + RESOURCE_OXIDANT + ' ' + factory.store.getUsedCapacity(RESOURCE_OXIDANT) + ' ' + result + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY) + ' ' + RESOURCE_OXYGEN + ' ' + factory.store.getUsedCapacity(RESOURCE_OXYGEN));
                    }
                    else if(factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) >= 20
                        && factory.store.getUsedCapacity(RESOURCE_BIOMASS) >= 100
                        && factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 40
                        && factory.store.getUsedCapacity(RESOURCE_CELL) < 500){
                        result = factory.produce(RESOURCE_CELL);
                        console.log('Factories ' + factory.pos.roomName + ' producing ' + RESOURCE_CELL + ' ' + factory.store.getUsedCapacity(RESOURCE_CELL) + ' ' + result + ' ' + RESOURCE_LEMERGIUM_BAR + ' ' + factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) + ' ' + RESOURCE_BIOMASS + ' ' + factory.store.getUsedCapacity(RESOURCE_BIOMASS) + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY));
                    }
                    else if(factory.store.getUsedCapacity(RESOURCE_OXIDANT) >= 36
                        && factory.store.getUsedCapacity(RESOURCE_CELL) >= 20
                        && factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) >= 16
                        && factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 8
                        && factory.store.getUsedCapacity(RESOURCE_PHLEGM) < 500
                        ){
                        result = factory.produce(RESOURCE_PHLEGM);
                        console.log('Factories ' + factory.pos.roomName + ' producing ' + RESOURCE_PHLEGM + ' ' + factory.store.getUsedCapacity(RESOURCE_PHLEGM) + ' ' + result + ' ' + RESOURCE_LEMERGIUM_BAR + ' ' + factory.store.getUsedCapacity(RESOURCE_LEMERGIUM_BAR) + ' ' + RESOURCE_CELL + ' ' + factory.store.getUsedCapacity(RESOURCE_CELL) + ' ' + RESOURCE_OXIDANT + ' ' + factory.store.getUsedCapacity(RESOURCE_OXIDANT) + ' ' + RESOURCE_ENERGY + ' ' + factory.store.getUsedCapacity(RESOURCE_ENERGY));
                    }
                }else if(!factory){ // no factory in this room - set FctrId so that it wont look again
                    memRoom.FctrId = '-';
                }
            }
        }
    }
};
module.exports = Factories;