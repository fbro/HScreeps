let Util = require('Util');
const Factories = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            const memRoom = Memory.MemRooms[gameRoomKey];
            if (memRoom && memRoom.FctrId !== '-' && gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8) {
                let factory;
                if(memRoom.FctrId){
                    factory = Game.getObjectById(memRoom.FctrId);
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
                    const hasOperateFactoryEffect = factory.effects && factory.effects[0] && factory.effects[0].effect === PWR_OPERATE_FACTORY;
                    if(factory.level === 1 && hasOperateFactoryEffect){
                        result = Produce(factory, RESOURCE_PHLEGM, 2000, RESOURCE_OXIDANT, 36, RESOURCE_CELL, 20, RESOURCE_LEMERGIUM_BAR, 16, RESOURCE_ENERGY, 8);
                        if(result !== OK) {
                            result = Produce(factory, RESOURCE_COMPOSITE, 2000, RESOURCE_UTRIUM_BAR, 20, RESOURCE_ZYNTHIUM_BAR, 20, RESOURCE_ENERGY, 20);
                            if(result !== OK){
                                result = Produce(factory, RESOURCE_TUBE, 2000, RESOURCE_ALLOY, 40, RESOURCE_ZYNTHIUM_BAR, 16, RESOURCE_ENERGY, 8);
                            }
                        }
                    }else if(factory.level === 2 && hasOperateFactoryEffect){
                        result = Produce(factory, RESOURCE_TISSUE, 2000, RESOURCE_REDUCTANT, 110, RESOURCE_CELL, 10, RESOURCE_PHLEGM, 10, RESOURCE_ENERGY, 16);
                        if(result !== OK) {
                            result = Produce(factory, RESOURCE_FIXTURES, 2000, RESOURCE_COMPOSITE, 20, RESOURCE_ALLOY, 41, RESOURCE_OXIDANT, 161, RESOURCE_ENERGY, 8);
                        }
                    }else if(factory.level === 3 && hasOperateFactoryEffect){
                        result = Produce(factory, RESOURCE_FRAME, 2000, RESOURCE_FIXTURES, 2, RESOURCE_TUBE, 4, RESOURCE_REDUCTANT, 330, RESOURCE_ZYNTHIUM_BAR, 31, RESOURCE_ENERGY, 16);
                    }
                    if(result !== OK) {
                        result = Produce(factory, RESOURCE_LEMERGIUM_BAR, 1000, RESOURCE_LEMERGIUM, 500, RESOURCE_ENERGY, 200);
                        if(result !== OK) {
                            result = Produce(factory, RESOURCE_ZYNTHIUM_BAR, 1000, RESOURCE_ZYNTHIUM, 500, RESOURCE_ENERGY, 200);
                            if(result !== OK) {
                                result = Produce(factory, RESOURCE_UTRIUM_BAR, 1000, RESOURCE_UTRIUM, 500, RESOURCE_ENERGY, 200);
                                if (result !== OK) {
                                    result = Produce(factory, RESOURCE_OXIDANT, 1000, RESOURCE_OXYGEN, 500, RESOURCE_ENERGY, 200);
                                    if (result !== OK) {
                                        result = Produce(factory, RESOURCE_REDUCTANT, 1000, RESOURCE_HYDROGEN, 500, RESOURCE_ENERGY, 200);
                                        if (result !== OK) {
                                            result = Produce(factory, RESOURCE_CELL, 1000, RESOURCE_BIOMASS, 100, RESOURCE_LEMERGIUM_BAR, 20, RESOURCE_ENERGY, 40);
                                            if (result !== OK) {
                                                result = Produce(factory, RESOURCE_ALLOY, 1000, RESOURCE_METAL, 100, RESOURCE_ZYNTHIUM_BAR, 20, RESOURCE_ENERGY, 40);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }else if(!factory){ // no factory in this room - set FctrId so that it wont look again
                    memRoom.FctrId = '-';
                    Util.InfoLog('Factories', '', 'no factory in ' + gameRoomKey + ' FctrId set to -');
                }
            }
        }

        /**@return {Number}
         * @return {undefined}*/
        function Produce(factory, resToProduceName, resToProduceMaxAmount,
                         res1Name, res1MinAmount,
                         res2Name, res2MinAmount,
                         res3Name, res3MinAmount,
                         res4Name, res4MinAmount,
                         res5Name, res5MinAmount){
            if(    factory.store.getUsedCapacity(res1Name) >= res1MinAmount
                && factory.store.getUsedCapacity(res2Name) >= res2MinAmount
                && (!res3Name || factory.store.getUsedCapacity(res3Name) >= res3MinAmount)
                && (!res4Name || factory.store.getUsedCapacity(res4Name) >= res4MinAmount)
                && (!res5Name || factory.store.getUsedCapacity(res5Name) >= res5MinAmount)
                && (factory.store.getUsedCapacity(resToProduceName) + factory.room.storage.store.getUsedCapacity(resToProduceName) + factory.room.terminal.store.getUsedCapacity(resToProduceName)) < resToProduceMaxAmount
            ){ // res 1 and 2 is always required but 3 - 5 may be undefined
                const result = factory.produce(resToProduceName);
                Util.Info('Factories', 'Produce',
                    factory.pos.roomName + ' producing ' + resToProduceName + ' ' + factory.store.getUsedCapacity(resToProduceName) + ' result ' + result
                    + ' ' + res1Name + ' ' + factory.store.getUsedCapacity(res1Name)
                    + ' ' + res2Name + ' ' + factory.store.getUsedCapacity(res2Name)
                    + (res3Name?' ' + res3Name + ' ' + factory.store.getUsedCapacity(res3Name):'')
                    + (res4Name?' ' + res4Name + ' ' + factory.store.getUsedCapacity(res4Name):'')
                    + (res5Name?' ' + res5Name + ' ' + factory.store.getUsedCapacity(res5Name):''));
                return result;
            }
        }
    }
};
module.exports = Factories;