const PowerCreeps = {
    run: function () {
        PowerCreepsActions();

        function PowerCreepsActions(){
            for (const powerCreepKey in Game.powerCreeps) {
                const powerCreep = Game.powerCreeps[powerCreepKey];
                let result;
                if(!powerCreep.pos && !powerCreep.spawnCooldownTime) {
                    powerCreep.spawn(Game.getObjectById('5daecf40eb466e8543e2f82d'));
                }else if(!powerCreep.spawnCooldownTime){
                    if(powerCreep.ticksToLive < 500){ // power creep needs to be renewed
                        result = RenewPowerCreep(powerCreep);
                        console.log('PowerCreeps trying to renew ' + powerCreep.name + ' result ' + result + ' ticksToLive ' + powerCreep.ticksToLive);
                    }else if(powerCreep.room.controller && powerCreep.room.controller.my && !powerCreep.room.controller.isPowerEnabled){ // my room is not power enabled
                        result = EnablePowerInRoom(powerCreep);
                        console.log('PowerCreeps trying to EnablePowerInRoom ' + powerCreep.name + ' ' + powerCreep.pos.roomName);
                    }else if(powerCreep.className === POWER_CLASS.OPERATOR){ // power creep is not too old and power is enabled in the room
                        if(powerCreep.powers[PWR_GENERATE_OPS].cooldown === 0 && powerCreep.store.getFreeCapacity() > 0){
                            result = powerCreep.usePower(PWR_GENERATE_OPS); // if power creep is an operator - always use this power when available
                        }else if(powerCreep.store.getUsedCapacity(RESOURCE_OPS) >= 100 && powerCreep.powers[PWR_OPERATE_TERMINAL].cooldown === 0 && powerCreep.room.terminal && powerCreep.room.terminal.my){
                            result = OperateTerminal(powerCreep);
                        }else if(powerCreep.store[RESOURCE_OPS] > 400) {
                            result = DepositOps(powerCreep);
                        }
                    }
                }
            }
        }

        // TODO add withdraw ops

        function DepositOps(powerCreep){
            let result = powerCreep.transfer(powerCreep.room.storage, RESOURCE_OPS, powerCreep.store[RESOURCE_OPS] - 300);
            console.log('PowerCreeps DepositOps ' + powerCreep.name + ' amount ' + powerCreep.store[RESOURCE_OPS]);
            if(result === ERR_NOT_IN_RANGE){
                result = powerCreep.moveTo(powerCreep.room.storage);
            }
            return result;
        }

        function OperateTerminal(powerCreep){
            let result;
            let operateTerminalEffectExist = false;
            if(powerCreep.room.terminal.effects){
                for(const effectKey in powerCreep.room.terminal.effects){
                    const effect = powerCreep.room.terminal.effects[effectKey];
                    if(effect.effect === PWR_OPERATE_TERMINAL){
                        operateTerminalEffectExist = true;
                        break;
                    }
                }
            }
            if(!operateTerminalEffectExist){
                result = powerCreep.usePower(PWR_OPERATE_TERMINAL, powerCreep.room.terminal);
                console.log('PowerCreeps OperateTerminal ' + powerCreep.name + ' on terminal in ' + powerCreep.room.terminal.pos.roomName);
                if(result === ERR_NOT_IN_RANGE){
                    result = powerCreep.moveTo(powerCreep.room.terminal);
                }
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