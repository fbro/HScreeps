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
            if (factory && factory.room.storage) {
                if (factory.cooldown === 0) {
                    let result;
                    const hasOperateFactoryEffect = factory.effects && factory.effects[0] && factory.effects[0].effect === PWR_OPERATE_FACTORY;
                    if (factory.level === 1 && hasOperateFactoryEffect) {
                        result = Produce(factory, RESOURCE_COMPOSITE, Util.FACTORY_TARGET_RESOURCE);
                        if (result === OK) return;
                        result = Produce(factory, RESOURCE_PHLEGM, Util.FACTORY_TARGET_RESOURCE);
                        if (result === OK) return;
                        result = Produce(factory, RESOURCE_TUBE, Util.FACTORY_TARGET_RESOURCE);
                        if (result === OK) return;
                    } else if (factory.level === 2 && hasOperateFactoryEffect) {
                        result = Produce(factory, RESOURCE_TISSUE, Util.FACTORY_TARGET_RESOURCE);
                        if (result === OK) return;
                        result = Produce(factory, RESOURCE_FIXTURES, Util.FACTORY_TARGET_RESOURCE);
                        if (result === OK) return;
                    } else if (factory.level === 3 && hasOperateFactoryEffect) {
                        result = Produce(factory, RESOURCE_FRAME, Util.FACTORY_TARGET_RESOURCE);
                        if (result === OK) return;
                    }
                    result = Produce(factory, RESOURCE_LEMERGIUM_BAR, Util.FACTORY_TARGET_RESOURCE);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_ZYNTHIUM_BAR, Util.FACTORY_TARGET_RESOURCE);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_UTRIUM_BAR, Util.FACTORY_TARGET_RESOURCE);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_KEANIUM_BAR, Util.FACTORY_TARGET_RESOURCE);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_OXIDANT, Util.FACTORY_TARGET_RESOURCE);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_REDUCTANT, Util.FACTORY_TARGET_RESOURCE);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_CELL, Util.FACTORY_TARGET_RESOURCE);
                    if (result === OK) return;
                    result = Produce(factory, RESOURCE_ALLOY, Util.FACTORY_TARGET_RESOURCE);
                    if (result === OK) return;
                    if (factory.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.STORAGE_ENERGY_MEDIUM) {
                        result = Produce(factory, RESOURCE_BATTERY, Util.FACTORY_TARGET_RESOURCE);
                        if (result === OK) return;
                    } else if (factory.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) <= Util.STORAGE_ENERGY_LOW && factory.room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) <= Util.TERMINAL_TARGET_ENERGY) {
                        result = Produce(factory, RESOURCE_ENERGY, Number.MAX_SAFE_INTEGER);
                        if (result === OK) {
                            Util.Warning('Factories', '', 'extracting energy from batteries in ' + factory.pos.roomName + ' energy status: storage ' + factory.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) + ' terminal ' + factory.room.terminal.store.getUsedCapacity(RESOURCE_ENERGY));
                            return;
                        }
                    }
                }
            } else { // no factory in this room - set FctrId so that it wont look again
                memRoom.FctrId = '-';
                Util.InfoLog('Factories', '', 'no factory in ' + gameRoomKey + ' FctrId set to -');
            }
        }

        function Produce(factory, resToProduceName, resToProduceMaxAmount) {
            if (factory.store.getUsedCapacity(resToProduceName) < resToProduceMaxAmount) {
                const commodity = COMMODITIES[resToProduceName];
                if (factory.level === undefined || factory.level === commodity.level) {
                    for (const component in commodity.components) {
                        if (factory.store.getUsedCapacity(component) < commodity.components[component]) {
                            return -1;
                        }
                    }
                    const result = factory.produce(resToProduceName);
                    Util.Info('Factories', 'Produce', 'lvl ' + (!factory.level ? 0 : factory.level) + ' ' + factory.pos.roomName + ' producing ' + resToProduceName + ' ' + factory.store.getUsedCapacity(resToProduceName) + ' max ' + resToProduceMaxAmount + ' result ' + result);
                    return result;
                }
            }
            return -1;
        }
    }
};
module.exports = Factories;