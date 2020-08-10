let Util = require('Util');
const Factories = {
    run: function (gameRoom, gameRoomKey) {
        const memRoom = Memory.MemRooms[gameRoomKey];
        if (memRoom && memRoom.FctrId !== '-') {
            let factory;
            if (memRoom.FctrId) {
                factory = Game.getObjectById(memRoom.FctrId);
            }
            if (!factory) {
                factory = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (factory) {
                        return factory.structureType === STRUCTURE_FACTORY;
                    }
                })[0];
                if (factory) {
                    memRoom.FctrId = factory.id;
                    Util.InfoLog('Factories', '', 'add new factory in ' + gameRoomKey + ' FctrId ' + memRoom.FctrId);
                }
            }
            if (factory) {
                if (factory.cooldown === 0) {
                    let result;
                    const hasOperateFactoryEffect = factory.effects && factory.effects[0] && factory.effects[0].effect === PWR_OPERATE_FACTORY;
                    if (factory.level === 1 && hasOperateFactoryEffect) {
                        result = Produce(factory, RESOURCE_COMPOSITE, Util.FACTORY_TARGET_RESOURCE, RESOURCE_UTRIUM_BAR, 20, RESOURCE_ZYNTHIUM_BAR, 20, RESOURCE_ENERGY, 20);
                        if (result === OK) return;
                        result = Produce(factory, RESOURCE_PHLEGM, Util.FACTORY_TARGET_RESOURCE, RESOURCE_OXIDANT, 36, RESOURCE_CELL, 20, RESOURCE_LEMERGIUM_BAR, 16, RESOURCE_ENERGY, 8);
                        if (result === OK) return;
                        result = Produce(factory, RESOURCE_TUBE, Util.FACTORY_TARGET_RESOURCE, RESOURCE_ALLOY, 40, RESOURCE_ZYNTHIUM_BAR, 16, RESOURCE_ENERGY, 8);
                        if (result === OK) return;
                    } else if (factory.level === 2 && hasOperateFactoryEffect) {
                        result = Produce(factory, RESOURCE_TISSUE, Util.FACTORY_TARGET_RESOURCE, RESOURCE_REDUCTANT, 110, RESOURCE_CELL, 10, RESOURCE_PHLEGM, 10, RESOURCE_ENERGY, 16);
                        if (result === OK) return;
                        result = Produce(factory, RESOURCE_FIXTURES, Util.FACTORY_TARGET_RESOURCE, RESOURCE_COMPOSITE, 20, RESOURCE_ALLOY, 41, RESOURCE_OXIDANT, 161, RESOURCE_ENERGY, 8);
                        if (result === OK) return;
                    } else if (factory.level === 3 && hasOperateFactoryEffect) {
                        result = Produce(factory, RESOURCE_FRAME, Util.FACTORY_TARGET_RESOURCE, RESOURCE_FIXTURES, 2, RESOURCE_TUBE, 4, RESOURCE_REDUCTANT, 330, RESOURCE_ZYNTHIUM_BAR, 31, RESOURCE_ENERGY, 16);
                        if (result === OK) return;
                    }
                    result = Produce(factory, RESOURCE_LEMERGIUM_BAR, Util.FACTORY_TARGET_RESOURCE, RESOURCE_LEMERGIUM, 500, RESOURCE_ENERGY, 200);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_ZYNTHIUM_BAR, Util.FACTORY_TARGET_RESOURCE, RESOURCE_ZYNTHIUM, 500, RESOURCE_ENERGY, 200);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_UTRIUM_BAR, Util.FACTORY_TARGET_RESOURCE, RESOURCE_UTRIUM, 500, RESOURCE_ENERGY, 200);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_KEANIUM_BAR, Util.FACTORY_TARGET_RESOURCE, RESOURCE_KEANIUM, 500, RESOURCE_ENERGY, 200);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_OXIDANT, Util.FACTORY_TARGET_RESOURCE, RESOURCE_OXYGEN, 500, RESOURCE_ENERGY, 200);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_REDUCTANT, Util.FACTORY_TARGET_RESOURCE, RESOURCE_HYDROGEN, 500, RESOURCE_ENERGY, 200);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_CELL, Util.FACTORY_TARGET_RESOURCE, RESOURCE_BIOMASS, 100, RESOURCE_LEMERGIUM_BAR, 20, RESOURCE_ENERGY, 40);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_ALLOY, Util.FACTORY_TARGET_RESOURCE, RESOURCE_METAL, 100, RESOURCE_ZYNTHIUM_BAR, 20, RESOURCE_ENERGY, 40);
                    if (result === OK) return;
                    if(factory.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.STORAGE_ENERGY_MEDIUM){
                        result = Produce(factory, RESOURCE_BATTERY, Util.FACTORY_TARGET_RESOURCE, RESOURCE_ENERGY, 600);
                        if (result === OK) return;
                    }else if(factory.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) <= Util.STORAGE_ENERGY_LOW && factory.room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) <= Util.TERMINAL_TARGET_ENERGY){
                        result = Produce(factory, RESOURCE_ENERGY, Number.MAX_SAFE_INTEGER, RESOURCE_BATTERY, 50);
                        Util.Warning('Factories', '', 'extracting energy from batteries! energy status: storage ' + factory.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) + ' terminal ' + factory.room.terminal.store.getUsedCapacity(RESOURCE_ENERGY));
                        if (result === OK) return;
                    }
                }
            } else { // no factory in this room - set FctrId so that it wont look again
                memRoom.FctrId = '-';
                Util.InfoLog('Factories', '', 'no factory in ' + gameRoomKey + ' FctrId set to -');
            }
        }

        /**@return {Number}
         * @return {undefined}*/
        function Produce(factory, resToProduceName, resToProduceMaxAmount,
                         res1Name, res1MinAmount,
                         res2Name, res2MinAmount,
                         res3Name, res3MinAmount,
                         res4Name, res4MinAmount,
                         res5Name, res5MinAmount) {
            if (                 factory.store.getUsedCapacity(res1Name) >= res1MinAmount
                && (!res2Name || factory.store.getUsedCapacity(res2Name) >= res2MinAmount)
                && (!res3Name || factory.store.getUsedCapacity(res3Name) >= res3MinAmount)
                && (!res4Name || factory.store.getUsedCapacity(res4Name) >= res4MinAmount)
                && (!res5Name || factory.store.getUsedCapacity(res5Name) >= res5MinAmount)
                && factory.store.getUsedCapacity(resToProduceName) < resToProduceMaxAmount
            ) { // res 1 and 2 is always required but 3 - 5 may be undefined
                const result = factory.produce(resToProduceName);
                /**/
                Util.Info('Factories', 'Produce',
                    'lvl ' + (!factory.level ? 0 : factory.level) + ' ' + factory.pos.roomName + ' producing ' + resToProduceName + ' ' + factory.store.getUsedCapacity(resToProduceName) + ' result ' + result
                    + ' ' + res1Name + ' ' + factory.store.getUsedCapacity(res1Name)
                    + (res2Name ? ' ' + res2Name + ' ' + factory.store.getUsedCapacity(res2Name) : '')
                    + (res3Name ? ' ' + res3Name + ' ' + factory.store.getUsedCapacity(res3Name) : '')
                    + (res4Name ? ' ' + res4Name + ' ' + factory.store.getUsedCapacity(res4Name) : '')
                    + (res5Name ? ' ' + res5Name + ' ' + factory.store.getUsedCapacity(res5Name) : ''));

                return result;
            }
            return -1;
        }
    }
};
module.exports = Factories;