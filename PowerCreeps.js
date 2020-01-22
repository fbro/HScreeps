let Util = require('Util');
const PowerCreeps = {
    run: function () {
        PowerCreepsActions();

        function PowerCreepsActions() {
            const powerCreepSpawnFlags = _.filter(Game.flags, function (flag) {
                return flag.color === COLOR_BLUE && flag.secondaryColor === COLOR_ORANGE;
            });
            for (const powerCreepKey in Game.powerCreeps) {
                const powerCreep = Game.powerCreeps[powerCreepKey];
                let result;
                const flagWithCreepName = _.filter(powerCreepSpawnFlags, function (flag) {
                    return flag.name === powerCreep.name;
                })[0];
                if(!flagWithCreepName) { // this creep does not have a flag - skip it
                    continue;
                } else if(!powerCreep.room && (!powerCreep.spawnCooldownTime || powerCreep.spawnCooldownTime < Game.time)) { // it has a flag but it is not spawned
                    const powerSpawn = flagWithCreepName.pos.lookFor(LOOK_STRUCTURES, {
                        filter: (s) => {
                            return s.structureType === STRUCTURE_POWER_SPAWN;
                        }
                    })[0];
                    if(powerSpawn){
                        result = powerCreep.spawn(powerSpawn);
                        Util.InfoLog('PowerCreeps', 'PowerCreepsActions','spawning ' + powerCreep.name + ' result ' + result + ' (' + powerSpawn.pos.x + ',' + powerSpawn.pos.y + ',' + powerSpawn.pos.roomName +')');
                    }else{
                        Util.ErrorLog('PowerCreeps', 'PowerCreepsActions','removed flag, powerSpawn not found ' + flagWithCreepName.name + ' (' + flagWithCreepName.pos.x + ',' + flagWithCreepName.pos.y + ',' + flagWithCreepName.pos.roomName +')');
                        flagWithCreepName.remove();
                    }
                } else if (powerCreep.room) { // flag is found and the creep is spawned - do something
                    if (powerCreep.ticksToLive < 500) { // power creep needs to be renewed
                        result = RenewPowerCreep(powerCreep);
                        Util.Info('PowerCreeps', 'PowerCreepsActions','trying to renew ' + powerCreep.name + ' result ' + result + ' ticksToLive ' + powerCreep.ticksToLive);
                    } else if (powerCreep.room.controller && powerCreep.room.controller.my && !powerCreep.room.controller.isPowerEnabled) { // my room is not power enabled
                        result = EnablePowerInRoom(powerCreep);
                        Util.Info('PowerCreeps', 'PowerCreepsActions','trying to EnablePowerInRoom ' + powerCreep.name + ' ' + powerCreep.pos.roomName);
                    } else if (powerCreep.className === POWER_CLASS.OPERATOR) { // power creep is not too old and power is enabled in the room
                        if(!powerCreep.memory.OperateTerminalCooldown || !powerCreep.memory.RegenSource1Cooldown || !powerCreep.memory.RegenSource2Cooldown || !powerCreep.memory.OperateFactoryCooldown || !powerCreep.memory.RegenMineralCooldown){
                            powerCreep.memory.OperateTerminalCooldown = 1;
                            powerCreep.memory.RegenSource1Cooldown = 1;
                            powerCreep.memory.RegenSource2Cooldown = 1;
                            powerCreep.memory.OperateFactoryCooldown = 1;
                            powerCreep.memory.RegenMineralCooldown = 1;
                        }

                        if (powerCreep.powers[PWR_GENERATE_OPS] && powerCreep.powers[PWR_GENERATE_OPS].cooldown === 0 && powerCreep.store.getFreeCapacity() > 0) {
                            result = powerCreep.usePower(PWR_GENERATE_OPS); // if power creep is an operator - always use this power when available
                        } else if(powerCreep.memory.OperateFactoryCooldown < Game.time && powerCreep.powers[PWR_OPERATE_FACTORY] && powerCreep.powers[PWR_OPERATE_FACTORY].cooldown === 0 && powerCreep.store.getUsedCapacity(RESOURCE_OPS) >= 100){
                            result = OperateFactory(powerCreep);
                        } /*else if (powerCreep.memory.OperateTerminalCooldown < Game.time && powerCreep.store.getUsedCapacity(RESOURCE_OPS) >= 100 && powerCreep.powers[PWR_OPERATE_TERMINAL].cooldown === 0 && powerCreep.room.terminal && powerCreep.room.terminal.my) {
                            result = OperateTerminal(powerCreep);
                        }*/ else if ((powerCreep.memory.RegenSource1Cooldown < Game.time || powerCreep.memory.RegenSource2Cooldown < Game.time) && powerCreep.powers[PWR_REGEN_SOURCE] && powerCreep.powers[PWR_REGEN_SOURCE].cooldown === 0) {
                            result = RegenSource(powerCreep);
                        } else if(powerCreep.memory.RegenMineralCooldown < Game.time && powerCreep.powers[PWR_REGEN_MINERAL] && powerCreep.powers[PWR_REGEN_MINERAL].cooldown === 0){
                            result = RegenMineral(powerCreep);
                        } else if (powerCreep.store[RESOURCE_OPS] > 500 || powerCreep.store[RESOURCE_OPS] === powerCreep.store.getCapacity()) {
                            result = DepositOps(powerCreep);
                        }else if(powerCreep.store[RESOURCE_OPS] < 100){
                            result = WithdrawOps(powerCreep);
                        }
                    }
                }
            }
        }

        function WithdrawOps(powerCreep){
            let amountToWithdraw = (300 - powerCreep.store[RESOURCE_OPS]);
            let result;
            let target;
            if(powerCreep.room.storage && powerCreep.room.storage.store[RESOURCE_OPS] > 0){
                target = powerCreep.room.storage;
            }else if(powerCreep.room.terminal && powerCreep.room.terminal.store[RESOURCE_OPS] > 0){
                target = powerCreep.room.terminal;
            }
            if(target){
                if(amountToWithdraw > target.store[RESOURCE_OPS]){
                    amountToWithdraw = target.store[RESOURCE_OPS];
                }
                if(amountToWithdraw > powerCreep.store.getFreeCapacity()){
                    amountToWithdraw = powerCreep.store.getFreeCapacity();
                }
                result = powerCreep.withdraw(target, RESOURCE_OPS, amountToWithdraw);
                Util.Info('PowerCreeps', 'WithdrawOps', powerCreep.name + ' ' + result + ' target amount ' + target.store[RESOURCE_OPS]);
            }
            if (result === ERR_NOT_IN_RANGE) {
                result = powerCreep.moveTo(target);
            }
            return result;
        }

        function DepositOps(powerCreep) {
            let opsToDeposit = powerCreep.store[RESOURCE_OPS] - 100;
            let result = powerCreep.transfer(powerCreep.room.storage, RESOURCE_OPS, opsToDeposit);
            Util.Info('PowerCreeps', 'DepositOps', powerCreep.name + ' ' + result + ' amount ' + powerCreep.store[RESOURCE_OPS]);
            if (result === ERR_NOT_IN_RANGE) {
                result = powerCreep.moveTo(powerCreep.room.storage);
            }
            return result;
        }

        function OperateTerminal(powerCreep) {
            let result;
            let operateTerminalEffectExist = false;
            if (powerCreep.room.terminal.effects) {
                for (const effectKey in powerCreep.room.terminal.effects) {
                    const effect = powerCreep.room.terminal.effects[effectKey];
                    if (effect.effect === PWR_OPERATE_TERMINAL) {
                        operateTerminalEffectExist = true;
                        break;
                    }
                }
            }
            if (!operateTerminalEffectExist) {
                result = powerCreep.usePower(PWR_OPERATE_TERMINAL, powerCreep.room.terminal);
                Util.Info('PowerCreeps', 'OperateTerminal', powerCreep.name + ' on terminal in ' + powerCreep.room.terminal.pos.roomName);
                if (result === ERR_NOT_IN_RANGE) {
                    result = powerCreep.moveTo(powerCreep.room.terminal);
                }else if(result === OK){
                    powerCreep.memory.OperateTerminalCooldown = Game.time + 1000; // add duration
                }
            }
            return result;
        }

        function RegenSource(powerCreep) {
            let result;
            let source1;
            let source2;

            if (powerCreep.memory.Source1Id) {
                source1 = Game.getObjectById(powerCreep.memory.Source1Id);
                if (powerCreep.memory.Source2Id) {
                    source2 = Game.getObjectById(powerCreep.memory.Source2Id);
                }
            } else {
                const sources = powerCreep.room.find(FIND_SOURCES);
                if (sources[0]) {
                    source1 = sources[0];
                    powerCreep.memory.Source1Id = source1.id;
                    if (sources[1]) {
                        source2 = sources[1];
                        powerCreep.memory.Source2Id = source2.id;
                    }
                }
            }
            let selectedSource = source1;
            if (source1 && source1.effects) {
                for (const effectKey in source1.effects) {
                    const effect = source1.effects[effectKey];
                    if (effect.effect === PWR_REGEN_SOURCE && effect.ticksRemaining > 30) {
                        selectedSource = undefined;
                        break;
                    }
                }
            }
            if (!selectedSource && source2) {
                selectedSource = source2;
                if (source2.effects) {
                    selectedSource = source2;
                    for (const effectKey in source2.effects) {
                        const effect = source2.effects[effectKey];
                        if (effect.effect === PWR_REGEN_SOURCE && effect.ticksRemaining > 30) {
                            selectedSource = undefined;
                            break;
                        }
                    }
                }
            }
            if (selectedSource) {
                result = powerCreep.usePower(PWR_REGEN_SOURCE, selectedSource);

                //Util.Info('PowerCreeps', 'RegenSource', powerCreep.name + ' on (' + selectedSource.pos.x + ',' + selectedSource.pos.y + ',' + selectedSource.pos.roomName + ')');
                if (result === ERR_NOT_IN_RANGE) {
                    result = powerCreep.moveTo(selectedSource);
                }else if(result === OK){
                    if(selectedSource.id === source1.id){
                        powerCreep.memory.RegenSource1Cooldown = Game.time + 270; // add duration
                    }else if(selectedSource.id === source2.id){
                        powerCreep.memory.RegenSource2Cooldown = Game.time + 270; // add duration
                    }
                }
            }
            return result;
        }

        function RegenMineral(powerCreep){
            let result;
            let mineral;
            if (powerCreep.memory.MineralId) {
                mineral = Game.getObjectById(powerCreep.memory.MineralId);
            }
            if(!mineral){
                mineral = powerCreep.room.find(FIND_MINERALS)[0];
                if (mineral) {
                    powerCreep.memory.MineralId = mineral.id;
                }
            }
            if (mineral && mineral.mineralAmount > 0) {
                result = powerCreep.usePower(PWR_REGEN_MINERAL, mineral);
                if (result === ERR_NOT_IN_RANGE) {
                    result = powerCreep.moveTo(mineral);
                }else if(result === OK){
                    powerCreep.memory.RegenMineralCooldown = Game.time + 100; // add duration
                }
            }else if(mineral && mineral.mineralAmount === 0){
                // mineral is in the regen period
                result = OK;
                powerCreep.memory.RegenMineralCooldown = Game.time + mineral.ticksToRegeneration;
                Util.Info('PowerCreeps', 'RegenMineral', powerCreep.name + ' in ' + powerCreep.pos.roomName + ' mineral is empty waiting ' + mineral.ticksToRegeneration + ' ticks');
            }
            return result;
        }

        function EnablePowerInRoom(powerCreep) {
            let result = powerCreep.enableRoom(powerCreep.room.controller);
            if (result === ERR_NOT_IN_RANGE) {
                result = powerCreep.moveTo(powerCreep.room.controller);
            }
            return result;
        }

        function OperateFactory(powerCreep){ // PWR_OPERATE_FACTORY
            let result;
            let factory;
            if (powerCreep.memory.FactoryId) {
                factory = Game.getObjectById(powerCreep.memory.FactoryId);
            }
            if(!factory){
                factory = powerCreep.room.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_FACTORY;
                    }
                })[0];
            }
            if(factory){
                result = powerCreep.usePower(PWR_OPERATE_FACTORY, factory);
                if (result === ERR_NOT_IN_RANGE) {
                    result = powerCreep.moveTo(factory);
                }else if(result === OK){
                    powerCreep.memory.OperateFactoryCooldown = Game.time + 1000; // add duration
                }
            }
            return result;
        }

        // TODO only looks for renew sources in the current room
        /**@return {number}*/
        function RenewPowerCreep(powerCreep) {
            let powerSpawnOrBank;
            if (powerCreep.memory.PowerSpawnOrBankId) {
                powerSpawnOrBank = Game.getObjectById(powerCreep.memory.PowerSpawnOrBankId);
                if(powerSpawnOrBank && powerSpawnOrBank.pos.roomName !== powerCreep.pos.roomName){
                    powerSpawnOrBank = undefined;
                }
            }
            if (!powerSpawnOrBank) {
                powerSpawnOrBank = powerCreep.room.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_POWER_SPAWN || s.structureType === STRUCTURE_POWER_BANK;
                    }
                })[0];
                powerCreep.memory.PowerSpawnOrBankId = powerSpawnOrBank.id;
            }

            let result = ERR_INVALID_TARGET;
            if (powerSpawnOrBank) {
                result = powerCreep.renew(powerSpawnOrBank);
                if (result === ERR_NOT_IN_RANGE) {
                    result = powerCreep.moveTo(powerSpawnOrBank);
                } else if (result === OK) {
                    powerCreep.memory.PowerSpawnOrBankId = undefined;
                }
            }
            return result;
        }
    }
};
module.exports = PowerCreeps;