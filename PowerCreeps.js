let Util = require('Util');
const PowerCreeps = {
    run: function () {
        const NO_RESULT_FOUND = -20;
        RunPowerCreeps();

        function RunPowerCreeps() {
            const powerCreepSpawnFlags = _.filter(Game.flags, function (flag) {
                return flag.color === COLOR_BLUE && flag.secondaryColor === COLOR_ORANGE;
            });
            for (const powerCreepKey in Game.powerCreeps) {
                const powerCreep = Game.powerCreeps[powerCreepKey];
                if (!powerCreep.shard || powerCreep.shard === Game.shard.name) { // if the creep is in another shard then just skip
                    let result = NO_RESULT_FOUND;
                    const flagWithCreepName = _.filter(powerCreepSpawnFlags, function (flag) {
                        return flag.name === powerCreep.name;
                    })[0];
                    if (!flagWithCreepName && powerCreep.shard) { // this creep does not have a flag and is spawned - despawn it
                        Util.InfoLog('PowerCreeps', 'PowerCreepsActions', 'no flag for ' + powerCreep.name + ' (' + powerCreep.pos.x + ',' + powerCreep.pos.y + ',' + powerCreep.pos.roomName + ') despawning creep');
                        powerCreep.suicide();
                    } else if (flagWithCreepName && !powerCreep.shard && (!powerCreep.spawnCooldownTime || powerCreep.spawnCooldownTime < Game.time)) { // it has a flag but it is not spawned
                        const powerSpawn = flagWithCreepName.pos.lookFor(LOOK_STRUCTURES, {
                            filter: (s) => {
                                return s.structureType === STRUCTURE_POWER_SPAWN;
                            }
                        })[0];
                        if (powerSpawn) {
                            result = powerCreep.spawn(powerSpawn);
                            Util.InfoLog('PowerCreeps', 'PowerCreepsActions', 'spawning ' + powerCreep.name + ' result ' + result + ' (' + powerSpawn.pos.x + ',' + powerSpawn.pos.y + ',' + powerSpawn.pos.roomName + ')');
                        } else {
                            Util.ErrorLog('PowerCreeps', 'PowerCreepsActions', 'removed flag, powerSpawn not found ' + flagWithCreepName.name + ' (' + flagWithCreepName.pos.x + ',' + flagWithCreepName.pos.y + ',' + flagWithCreepName.pos.roomName + ')');
                            flagWithCreepName.remove();
                        }
                    } else if (powerCreep.shard) { // flag is found and the creep is spawned - do something
                        if (Memory.powerCreeps[powerCreep.name].JobName && !Memory.powerCreeps[powerCreep.name].JobName.startsWith('Unemployed')) {
                            result = PowerCreepsActions(powerCreep);
                        } else {
                            result = FindPowerCreepsActions(powerCreep);
                        }
                    }
                }
            }
        }

        function PowerCreepsActions(powerCreep) {
            let result = NO_RESULT_FOUND;
            const jobName = Memory.powerCreeps[powerCreep.name].JobName;
            switch (true) {
                case jobName.startsWith('RenewPowerCreep'):
                    result = RenewPowerCreep(powerCreep);
                    break;
                case jobName.startsWith('EnablePowerInRoom'):
                    result = EnablePowerInRoom(powerCreep);
                    break;
                case jobName.startsWith('GenerateOps'):
                    result = GenerateOps(powerCreep);
                    break;
                case jobName.startsWith('OperateFactory'):
                    result = OperateFactory(powerCreep);
                    break;
                case jobName.startsWith('RegenSource'):
                    result = RegenSource(powerCreep);
                    break;
                case jobName.startsWith('RegenMineral'):
                    result = RegenMineral(powerCreep);
                    break;
                case jobName.startsWith('DepositOps'):
                    result = DepositOps(powerCreep);
                    break;
                case jobName.startsWith('WithdrawOps'):
                    result = WithdrawOps(powerCreep);
                    break;
                case jobName.startsWith('OperateTerminal'):
                    result = OperateTerminal(powerCreep);
                    break;
                case jobName.startsWith('OperateSpawn'):
                    result = OperateSpawn(powerCreep);
                    break;
                default:
                    Util.ErrorLog('PowerCreeps', 'PowerCreepsActions', 'job not found ' + jobName + ' ' + powerCreep.name);
            }
            return result;
        }

        function FindPowerCreepsActions(powerCreep) {
            let result = NO_RESULT_FOUND;
            if (powerCreep.ticksToLive < 500) { // power creep needs to be renewed
                Memory.powerCreeps[powerCreep.name].JobName = 'RenewPowerCreep';
                result = RenewPowerCreep(powerCreep);
                //Util.Info('PowerCreeps', 'PowerCreepsActions', 'trying to renew ' + powerCreep.name + ' result ' + result + ' ticksToLive ' + powerCreep.ticksToLive);
            } else if (powerCreep.room.controller && powerCreep.room.controller.my && !powerCreep.room.controller.isPowerEnabled) { // my room is not power enabled
                Memory.powerCreeps[powerCreep.name].JobName = 'EnablePowerInRoom';
                result = EnablePowerInRoom(powerCreep);
                Util.Info('PowerCreeps', 'PowerCreepsActions', 'trying to EnablePowerInRoom ' + powerCreep.name + ' ' + powerCreep.pos.roomName);
            } else if (powerCreep.className === POWER_CLASS.OPERATOR) { // power creep is not too old and power is enabled in the room
                if (!Memory.powerCreeps[powerCreep.name].OperateTerminalCooldown || !Memory.powerCreeps[powerCreep.name].RegenSource1Cooldown || !Memory.powerCreeps[powerCreep.name].RegenSource2Cooldown || !Memory.powerCreeps[powerCreep.name].OperateFactoryCooldown || !Memory.powerCreeps[powerCreep.name].RegenMineralCooldown) {
                    Memory.powerCreeps[powerCreep.name].OperateTerminalCooldown = 1;
                    Memory.powerCreeps[powerCreep.name].RegenSource1Cooldown = 1;
                    Memory.powerCreeps[powerCreep.name].RegenSource2Cooldown = 1;
                    Memory.powerCreeps[powerCreep.name].OperateFactoryCooldown = 1;
                    Memory.powerCreeps[powerCreep.name].RegenMineralCooldown = 1;
                }

                if (powerCreep.powers[PWR_GENERATE_OPS] && powerCreep.powers[PWR_GENERATE_OPS].cooldown === 0 && powerCreep.store.getFreeCapacity() > 0) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'GenerateOps';
                    result = GenerateOps(powerCreep);
                } else if (Memory.powerCreeps[powerCreep.name].OperateFactoryCooldown < Game.time && powerCreep.powers[PWR_OPERATE_FACTORY] && powerCreep.powers[PWR_OPERATE_FACTORY].cooldown === 0 && powerCreep.store.getUsedCapacity(RESOURCE_OPS) >= 100) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'OperateFactory';
                    result = OperateFactory(powerCreep);
                } else if ((Memory.powerCreeps[powerCreep.name].RegenSource1Cooldown < Game.time || Memory.powerCreeps[powerCreep.name].RegenSource2Cooldown < Game.time) && powerCreep.powers[PWR_REGEN_SOURCE] && powerCreep.powers[PWR_REGEN_SOURCE].cooldown === 0) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'RegenSource';
                    result = RegenSource(powerCreep);
                } else if (Memory.powerCreeps[powerCreep.name].RegenMineralCooldown < Game.time && powerCreep.powers[PWR_REGEN_MINERAL] && powerCreep.powers[PWR_REGEN_MINERAL].cooldown === 0) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'RegenMineral';
                    result = RegenMineral(powerCreep);
                } else if (powerCreep.store.getUsedCapacity(RESOURCE_OPS) > 500 || powerCreep.store.getUsedCapacity(RESOURCE_OPS) === powerCreep.store.getCapacity()) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'DepositOps';
                    result = DepositOps(powerCreep);
                } else if (powerCreep.store.getUsedCapacity(RESOURCE_OPS) < 100) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'WithdrawOps';
                    result = WithdrawOps(powerCreep);
                } /*else if (Memory.powerCreeps[powerCreep.name].OperateTerminalCooldown < Game.time && powerCreep.store.getUsedCapacity(RESOURCE_OPS) >= 100 && powerCreep.powers[PWR_OPERATE_TERMINAL] && powerCreep.powers[PWR_OPERATE_TERMINAL].cooldown === 0 && powerCreep.room.terminal && powerCreep.room.terminal.my) {
                    result = OperateTerminal(powerCreep);
                }*/ /*else if ((!Memory.powerCreeps[powerCreep.name].spawns || _.filter(Memory.powerCreeps[powerCreep.name].spawns, function (s) {return s < Game.time;}).length > 0) && powerCreep.store.getUsedCapacity(RESOURCE_OPS) >= 100 && powerCreep.powers[PWR_OPERATE_SPAWN] && powerCreep.powers[PWR_OPERATE_SPAWN].cooldown === 0) {
                    result = OperateSpawn(powerCreep);
                }*/
                else {
                    Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
                }
            }
            return result;
        }

        /**@return {number}*/
        function RenewPowerCreep(powerCreep) {
            let powerSpawnOrBank;
            if (Memory.powerCreeps[powerCreep.name].PowerSpawnOrBankId) {
                powerSpawnOrBank = Game.getObjectById(Memory.powerCreeps[powerCreep.name].PowerSpawnOrBankId);
                if (powerSpawnOrBank && powerSpawnOrBank.pos.roomName !== powerCreep.pos.roomName) {
                    powerSpawnOrBank = undefined;
                }
            }
            if (!powerSpawnOrBank) {
                powerSpawnOrBank = powerCreep.room.find(FIND_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_POWER_SPAWN || s.structureType === STRUCTURE_POWER_BANK;
                    }
                })[0];
                if (!powerSpawnOrBank) { // look in other visible rooms for a renew source
                    let bestRange = Number.MAX_SAFE_INTEGER;
                    for (const gameRoomKey in Game.rooms) {
                        const room = Game.rooms[gameRoomKey];
                        let s = room.find(FIND_STRUCTURES, {
                            filter: (s) => {
                                return s.structureType === STRUCTURE_POWER_SPAWN && room.controller && room.controller.my || s.structureType === STRUCTURE_POWER_BANK;
                            }
                        })[0];
                        const range = Game.map.getRoomLinearDistance(powerCreep.pos.roomName, powerSpawnOrBank.pos.roomName);
                        if (range < bestRange) {
                            powerSpawnOrBank = s;
                            bestRange = range;
                        }
                    }
                }
                if (powerSpawnOrBank) {
                    Util.Info('PowerCreeps', 'RenewPowerCreep', powerCreep.name + ' in ' + powerCreep.pos.roomName + ' trying to renew at ' + JSON.stringify(powerSpawnOrBank.pos));
                    Memory.powerCreeps[powerCreep.name].PowerSpawnOrBankId = powerSpawnOrBank.id;
                }
            }
            let result = ERR_INVALID_TARGET;
            if (powerSpawnOrBank) {
                result = powerCreep.renew(powerSpawnOrBank);
                if (result === ERR_NOT_IN_RANGE) {
                    result = powerCreep.moveTo(powerSpawnOrBank);
                } else if (result === OK) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
                    Memory.powerCreeps[powerCreep.name].PowerSpawnOrBankId = undefined;
                }
            }
            return result;
        }

        function EnablePowerInRoom(powerCreep) {
            let result = powerCreep.enableRoom(powerCreep.room.controller);
            if (result === ERR_NOT_IN_RANGE) {
                result = powerCreep.moveTo(powerCreep.room.controller);
            } else {
                Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
            }
            return result;
        }

        function GenerateOps(powerCreep) {
            const result = powerCreep.usePower(PWR_GENERATE_OPS); // if power creep is an operator - always use this power when available
            Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
            return result;
        }

        function OperateFactory(powerCreep) { // PWR_OPERATE_FACTORY
            let result;
            let factory;
            if (Memory.powerCreeps[powerCreep.name].FactoryId) {
                factory = Game.getObjectById(Memory.powerCreeps[powerCreep.name].FactoryId);
            }
            if (!factory) {
                factory = powerCreep.room.find(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_FACTORY;
                    }
                })[0];
            }
            if (factory) {
                result = powerCreep.usePower(PWR_OPERATE_FACTORY, factory);
                if (result === ERR_NOT_IN_RANGE) {
                    result = powerCreep.moveTo(factory);
                } else if (result === OK) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
                    Memory.powerCreeps[powerCreep.name].OperateFactoryCooldown = Game.time + 1000; // add duration
                }
            }
            return result;
        }

        function RegenSource(powerCreep) {
            let result;
            let source1;
            let source2;

            if (Memory.powerCreeps[powerCreep.name].Source1Id) {
                source1 = Game.getObjectById(Memory.powerCreeps[powerCreep.name].Source1Id);
                if (Memory.powerCreeps[powerCreep.name].Source2Id) {
                    source2 = Game.getObjectById(Memory.powerCreeps[powerCreep.name].Source2Id);
                }
            } else {
                const sources = powerCreep.room.find(FIND_SOURCES);
                if (sources[0]) {
                    source1 = sources[0];
                    Memory.powerCreeps[powerCreep.name].Source1Id = source1.id;
                    if (sources[1]) {
                        source2 = sources[1];
                        Memory.powerCreeps[powerCreep.name].Source2Id = source2.id;
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
                } else if (result === OK) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
                    if (selectedSource.id === source1.id) {
                        Memory.powerCreeps[powerCreep.name].RegenSource1Cooldown = Game.time + 270; // add duration
                    } else if (selectedSource.id === source2.id) {
                        Memory.powerCreeps[powerCreep.name].RegenSource2Cooldown = Game.time + 270; // add duration
                    }
                }
            }
            return result;
        }

        function RegenMineral(powerCreep) {
            let result;
            let mineral;
            if (Memory.powerCreeps[powerCreep.name].MineralId) {
                mineral = Game.getObjectById(Memory.powerCreeps[powerCreep.name].MineralId);
            }
            if (!mineral) {
                mineral = powerCreep.room.find(FIND_MINERALS)[0];
                if (mineral) {
                    Memory.powerCreeps[powerCreep.name].MineralId = mineral.id;
                }
            }
            if (mineral && mineral.mineralAmount > 0) {
                result = powerCreep.usePower(PWR_REGEN_MINERAL, mineral);
                if (result === ERR_NOT_IN_RANGE) {
                    result = powerCreep.moveTo(mineral);
                } else if (result === OK) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
                    Memory.powerCreeps[powerCreep.name].RegenMineralCooldown = Game.time + 100; // add duration
                }
            } else if (mineral && mineral.mineralAmount === 0) {
                // mineral is in the regen period
                result = OK;
                Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
                Memory.powerCreeps[powerCreep.name].RegenMineralCooldown = Game.time + mineral.ticksToRegeneration;
                Util.Info('PowerCreeps', 'RegenMineral', powerCreep.name + ' in ' + powerCreep.pos.roomName + ' mineral is empty waiting ' + mineral.ticksToRegeneration + ' ticks');
            }
            return result;
        }

        function DepositOps(powerCreep) {
            let opsToDeposit = powerCreep.store.getUsedCapacity(RESOURCE_OPS) - 100;
            let result = powerCreep.transfer(powerCreep.room.storage, RESOURCE_OPS, opsToDeposit);
            Util.Info('PowerCreeps', 'DepositOps', powerCreep.name + ' ' + result + ' amount ' + powerCreep.store.getUsedCapacity(RESOURCE_OPS));
            if (result === ERR_NOT_IN_RANGE) {
                result = powerCreep.moveTo(powerCreep.room.storage);
            } else {
                Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
            }
            return result;
        }

        function WithdrawOps(powerCreep) {
            let amountToWithdraw = (300 - powerCreep.store.getUsedCapacity(RESOURCE_OPS));
            let result;
            let target;
            if (powerCreep.room.storage && powerCreep.room.storage.store.getUsedCapacity(RESOURCE_OPS) > 0) {
                target = powerCreep.room.storage;
            } else if (powerCreep.room.terminal && powerCreep.room.terminal.store.getUsedCapacity(RESOURCE_OPS) > 0) {
                target = powerCreep.room.terminal;
            }
            if (target) {
                if (amountToWithdraw > target.store.getUsedCapacity(RESOURCE_OPS)) {
                    amountToWithdraw = target.store.getUsedCapacity(RESOURCE_OPS);
                }
                if (amountToWithdraw > powerCreep.store.getFreeCapacity()) {
                    amountToWithdraw = powerCreep.store.getFreeCapacity();
                }
                result = powerCreep.withdraw(target, RESOURCE_OPS, amountToWithdraw);
                Util.Info('PowerCreeps', 'WithdrawOps', powerCreep.name + ' ' + result + ' target amount ' + target.store.getUsedCapacity(RESOURCE_OPS));
            }
            if (result === ERR_NOT_IN_RANGE) {
                result = powerCreep.moveTo(target);
            } else {
                Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
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
                } else if (result === OK) {
                    Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
                    Memory.powerCreeps[powerCreep.name].OperateTerminalCooldown = Game.time + 1000; // add duration
                }
            }
            return result;
        }

        function OperateSpawn(powerCreep) {
            let result;
            if (!Memory.powerCreeps[powerCreep.name].spawns) {
                const spawns = powerCreep.room.find(FIND_MY_SPAWNS);
                const spawnIDs = {};
                for (const spawnKey in spawns) {
                    const spawn = spawns[spawnKey];
                    spawnIDs[spawn.id] = 1;
                }
                Memory.powerCreeps[powerCreep.name].spawns = spawnIDs;
            }
            for (const spawnId in Memory.powerCreeps[powerCreep.name].spawns) {
                const spawn = Game.getObjectById(spawnId);
                if (spawn) {
                    let spawnHasBuff = false;
                    for (const effectKey in spawn.effects) {
                        const effect = spawn.effects[effectKey];
                        if (effect.effect === PWR_OPERATE_SPAWN && effect.ticksRemaining > 30) {
                            spawnHasBuff = true;
                            break;
                        }
                    }
                    if (!spawnHasBuff) {
                        result = powerCreep.usePower(PWR_OPERATE_SPAWN, spawn);
                        Util.Info('PowerCreeps', 'OperateSpawn', powerCreep.name + ' on (' + spawn.pos.x + ',' + spawn.pos.y + ',' + spawn.pos.roomName + ')');
                        if (result === ERR_NOT_IN_RANGE) {
                            result = powerCreep.moveTo(spawn);
                        } else if (result === OK) {
                            Memory.powerCreeps[powerCreep.name].JobName = 'Unemployed';
                            Memory.powerCreeps[powerCreep.name].spawns[spawn.id] = Game.time + 1000; // add duration
                        }
                        break;
                    }
                }
            }
            return result;
        }
    }
};
module.exports = PowerCreeps;