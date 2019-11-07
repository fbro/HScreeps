const PowerCreeps = {
    run: function () {
        for (const powerCreepKey in Game.powerCreeps) {
            const powerCreep = Game.powerCreeps[powerCreepKey];
            let result = OK;
            if(powerCreep.spawnCooldownTime && !(powerCreep.spawnCooldownTime > Date.now())) {
                powerCreep.spawn(Game.getObjectById('5daecf40eb466e8543e2f82d'));
            }else if(!powerCreep.spawnCooldownTime){
                if(powerCreep.ticksToLive < 500){
                    result = RenewPowerCreep(powerCreep);
                    console.log('PowerCreeps trying to renew ' + powerCreep.name + ' ' + powerCreep.memory.JobName + ' ' + result + ' ticksToLive ' + powerCreep.ticksToLive);
                }else if(powerCreep.className === POWER_CLASS.OPERATOR){
                    let target;
                    powerCreep.memory.JobName = 'GenOps'; // all POWER_CLASS.OPERATOR should just PWR_GENERATE_OPS right now
                    if(powerCreep.memory.JobName === 'GenOps' && powerCreep.powers[PWR_GENERATE_OPS].cooldown === 0){ // PWR_GENERATE_OPS
                        if(powerCreep.store.getUsedCapacity() !== 0 || powerCreep.memory.SecondaryJobName === 'depositInventory'){
                            powerCreep.memory.SecondaryJobName = 'depositInventory';
                            for (const resourceType in powerCreep.store) {
                                if (powerCreep.store[resourceType] > 0) {
                                    result = powerCreep.transfer(powerCreep.room.storage, resourceType);
                                    if(result === OK && powerCreep.store[resourceType] !== powerCreep.store.getUsedCapacity()){
                                        result = ERR_BUSY;
                                    }
                                    break;
                                }
                            }
                        }else if(!powerCreep.memory.SecondaryJobName){
                            result = powerCreep.usePower(PWR_GENERATE_OPS);
                        }else if(powerCreep.memory.SecondaryJobName === 'enableRoom'){
                            target = powerCreep.room.controller;
                            result = powerCreep.enableRoom(target);
                        }

                        if(result === ERR_INVALID_ARGS){ // Using powers is not enabled on the Room Controller.
                            powerCreep.memory.SecondaryJobName = 'enableRoom';
                        }else if(powerCreep.memory.SecondaryJobName === 'enableRoom' && result === ERR_NOT_IN_RANGE){
                            result = powerCreep.moveTo(target);
                        }else if(powerCreep.memory.SecondaryJobName === 'depositInventory' && result === ERR_NOT_IN_RANGE){
                            result = powerCreep.moveTo(powerCreep.room.storage);
                        }else if((powerCreep.memory.SecondaryJobName === 'enableRoom' || powerCreep.memory.SecondaryJobName === 'depositInventory') && result === OK){
                            powerCreep.memory.SecondaryJobName = undefined;
                        }
                        console.log('PowerCreeps ' + powerCreep.name + ' ' + powerCreep.memory.JobName + ' ' + result);
                    }
                }
            }else{
                console.log('PowerCreep ' + powerCreep.name + ' hours left ' + ((((powerCreep.spawnCooldownTime - Date.now()) / 1000) / 60) / 60));
            }
        }

        // TODO only looks for it in the current room
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
                }
            }
            return result;
        }
    }
};
module.exports = PowerCreeps;