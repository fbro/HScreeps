const PowerCreeps = {
    run: function () {
        for (const powerCreepKey in Game.powerCreeps) {
            const powerCreep = Game.powerCreeps[powerCreepKey];
            let result = OK;
            if(!powerCreep.pos && !powerCreep.spawnCooldownTime) {
                powerCreep.spawn(Game.getObjectById('5daecf40eb466e8543e2f82d'));
            }else if(!powerCreep.spawnCooldownTime){
                if(powerCreep.ticksToLive < 500){ // power creep needs to be renewed
                    result = RenewPowerCreep(powerCreep);
                    console.log('PowerCreeps trying to renew ' + powerCreep.name + ' ' + powerCreep.memory.JobName + ' ' + result + ' ticksToLive ' + powerCreep.ticksToLive);
                }else if(powerCreep.room.controller && powerCreep.room.controller.my && !powerCreep.room.controller.isPowerEnabled){ // my room is not power enabled
                    result = EnablePowerInRoom(powerCreep);
                    console.log('PowerCreeps trying to EnablePowerInRoom ' + powerCreep.name + ' ' + powerCreep.pos.roomName);
                }else if(powerCreep.className === POWER_CLASS.OPERATOR){ // power creep is not too old and power is enabled in the room
                    result = GenerateOps(powerCreep);
                }
            }else{
                console.log('PowerCreep ' + powerCreep.name + ' hours left ' + ((((powerCreep.spawnCooldownTime - Date.now()) / 1000) / 60) / 60));
            }
        }

        function GenerateOps(powerCreep){
            let result;
            if(powerCreep.powers[PWR_GENERATE_OPS].cooldown === 0){
                result = powerCreep.usePower(PWR_GENERATE_OPS);
                console.log('PowerCreeps ' + powerCreep.name + ' generating OPS ' + powerCreep.name + ' ' + powerCreep.memory.JobName + ' ' + result + ' in ' + powerCreep.pos.roomName);
            }
            if(powerCreep.store.getUsedCapacity() > 0){
                for (const resourceType in powerCreep.store) {
                    if (powerCreep.store[resourceType] > 0) {
                        result = powerCreep.transfer(powerCreep.room.storage, resourceType);
                        break;
                    }
                }
            }
            if(result === ERR_NOT_IN_RANGE){
                result = powerCreep.moveTo(powerCreep.room.storage);
            }
            return result;
        }

        function EnablePowerInRoom(powerCreep){
            let result = powerCreep.enableRoom(powerCreep.room.controller);
            if(result === ERR_NOT_IN_RANGE){
                result = powerCreep.moveTo(powerCreep.room.controller);
            }
            return result;
        }

        // TODO only looks for renew sources in the current room
        /**@return {number}*/
        function RenewPowerCreep(powerCreep){
            let powerSpawnOrBank;
            if(powerCreep.memory.PowerSpawnOrBankId){
                powerSpawnOrBank = Game.getObjectById(powerCreep.memory.PowerSpawnOrBankId);
            }
            if(!powerSpawnOrBank){
                powerSpawnOrBank = powerCreep.room.find(FIND_MY_STRUCTURES, {filter: (s) => {return s.structureType === STRUCTURE_POWER_SPAWN || s.structureType === STRUCTURE_POWER_BANK;}})[0];
                powerCreep.memory.PowerSpawnOrBankId = powerSpawnOrBank.id;
            }

            let result = ERR_INVALID_TARGET;
            if(powerSpawnOrBank){
                result = powerCreep.renew(powerSpawnOrBank);
                if(result === ERR_NOT_IN_RANGE){
                    result = powerCreep.moveTo(powerSpawnOrBank);
                }else if(result === OK){
                    powerCreep.memory.PowerSpawnOrBankId = undefined;
                }
            }
            return result;
        }
    }
};
module.exports = PowerCreeps;