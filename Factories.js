const Factories = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            const memRoom = Memory.MemRooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8 && memRoom && memRoom.FctrId !== '-') {
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
                    if(factory.store.getUsedCapacity(RESOURCE_ENERGY) >= 200 && factory.store.getUsedCapacity(RESOURCE_LEMERGIUM) >= 500){
                        factory.produce(RESOURCE_LEMERGIUM_BAR);
                    }
                    // TODO add others
                }else if(!factory){ // no factory in this room - set FctrId so that it wont look again
                    memRoom.FctrId = '-';
                }
            }
        }
    }
};
module.exports = Factories;