let Util = require('Util');
const RoomDefences = {
    run: function (gameRoom) {
        let anyTowerActionLastTick = Memory.MemRooms[gameRoom.name].AnyTowerAction;
        if (anyTowerActionLastTick || Game.time % Util.GAME_TIME_MODULO_1 === 0) {
            const towers = FindTowers(gameRoom);
            let anyTowerAction = HostileCreeps(gameRoom, towers);
            if (!anyTowerAction) {
                anyTowerAction = DamagedCreeps(towers);
            }
            if (!anyTowerAction && (Game.time % Util.GAME_TIME_MODULO_4 === 0 || anyTowerActionLastTick)) {
                anyTowerAction = EmergencyRepair(towers);
            }
            if (anyTowerActionLastTick !== anyTowerAction) {
                if (anyTowerAction) {
                    Memory.MemRooms[gameRoom.name].AnyTowerAction = anyTowerAction;
                } else {
                    delete Memory.MemRooms[gameRoom.name].AnyTowerAction;
                }
            }
        }

        function FindTowers(gameRoom) {
            let towers = [];
            let towersLoaded = true;
            if (Memory.MemRooms[gameRoom.name].TowerIds) {
                if (Memory.MemRooms[gameRoom.name].TowerIds.length !== Util.FindNumberOfBuildableStructures(gameRoom, STRUCTURE_TOWER)) {
                    towersLoaded = false;
                } else {
                    for (let i = 0; i < Memory.MemRooms[gameRoom.name].TowerIds.length; i++) {
                        towers[i] = Game.getObjectById(Memory.MemRooms[gameRoom.name].TowerIds[i]);
                        if (!towers[i]) {
                            Util.ErrorLog('RoomDefences', 'FindTowers', 'tower number ' + i + ' not found!');
                            delete Memory.MemRooms[gameRoom.name].TowerIds;
                            towersLoaded = false;
                            break;
                        }
                    }
                }
            } else {
                towersLoaded = false;
            }
            if (!towersLoaded) {
                towers = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (tower) {
                        return tower.structureType === STRUCTURE_TOWER && tower.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                let towerIds = [];
                for (let i = 0; i < towers.length; i++) {
                    towerIds[i] = towers[i].id;
                }
                Memory.MemRooms[gameRoom.name].TowerIds = towerIds;
            }
            return towers;
        }

        /**@return {boolean}*/
        function EmergencyRepair(towers) {
            const damagedStructures = gameRoom.find(FIND_STRUCTURES, {
                filter: function (structure) {
                    return (structure.hits < structure.hitsMax / 4
                        && structure.structureType !== STRUCTURE_WALL
                        && structure.structureType !== STRUCTURE_RAMPART)
                        ||
                        ((structure.structureType === STRUCTURE_RAMPART
                            || structure.structureType === STRUCTURE_WALL)
                            && structure.hits < 500);
                }
            });

            if (damagedStructures.length > 0) {
                for (let i = 0; i < towers.length; i++) {
                    if (towers[i].store.getUsedCapacity(RESOURCE_ENERGY) > 700) {
                        const val = ((i + 1) % damagedStructures.length);
                        towers[i].repair(damagedStructures[val]);
                    }
                }
                return true;
            }
            return false;
        }

        /**@return {boolean}*/
        function HostileCreeps(gameRoom, towers) {
            const hostileTargets = gameRoom.find(FIND_HOSTILE_CREEPS, {
                filter: function (hostile) {
                    return hostile.hits < hostile.hitsMax || hostile.pos.findInRange(FIND_STRUCTURES, 4).length >= 0 || hostile.pos.findInRange(FIND_MY_CREEPS, 3).length >= 0;
                }
            });
            if (hostileTargets.length > 0) {
                ActivateDefensiveMeasures(gameRoom, hostileTargets, towers);
                for (let i = 0; i < towers.length; i++) {
                    towers[i].attack(hostileTargets[((i + 1) % hostileTargets.length)]);
                }
                return true;
            }
            return false;
        }

        function ActivateDefensiveMeasures(gameRoom, hostileTargets, towers) {
            let numOfDefendersToSpawn = 0;
            for (const hostileTargetCount in hostileTargets) {
                const hostileTarget = hostileTargets[hostileTargetCount];
                if (towers.length === 0 || hostileTarget.owner.username !== 'Invader' && (hostileTarget.getActiveBodyparts(RANGED_ATTACK) || hostileTarget.getActiveBodyparts(ATTACK) || hostileTarget.getActiveBodyparts(HEAL))) {
                    const isBoosted = _.find(hostileTarget.body, function (bodypart) {
                        return bodypart.boost !== undefined;
                    });
                    if (isBoosted && hostileTarget.owner.username !== 'Invader') {
                        Util.InfoLog('RoomDefences', 'ActivateSafemode', gameRoom.name + ' attacked from ' + hostileTarget.owner.username + ' towers ' + towers.length);
                        if (!gameRoom.controller.safeMode && !gameRoom.controller.safeModeCooldown && gameRoom.controller.safeModeAvailable > 0) {
                            const result = gameRoom.controller.activateSafeMode();
                            Util.InfoLog('RoomDefences', 'ActivateSafemode', gameRoom.name + ' ' + result + ' attacked from ' + hostileTarget.owner.username + ' towers ' + towers.length + ' time ' + Game.time);
                            Game.notify('safemode have been activated for room ' + gameRoom.name + ' activateSafeMode result ' + result + ' shard ' + Game.shard.name + ' attacked from ' + hostileTarget.owner.username + ' time ' + Game.time, 0);
                        } else {
                            Util.InfoLog('RoomDefences', 'ActivateSafemode', gameRoom.name + ' cannot activate safemode! controller.safeMode ' + gameRoom.controller.safeMode + ' controller.safeModeCooldown ' + gameRoom.controller.safeModeCooldown + ' controller.safeModeAvailable ' + gameRoom.controller.safeModeAvailable);
                        }
                    }
                    numOfDefendersToSpawn++;
                }
            }
            if (numOfDefendersToSpawn > 0) {
                SpawnDefenders(gameRoom, numOfDefendersToSpawn);
            }
        }

        function SpawnDefenders(gameRoom, numOfDefendersToSpawn) {
            let spawn = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (spawn) {
                    return spawn.structureType === STRUCTURE_SPAWN
                }
            })[0];
            let numOfDefenderFlagsPlaced = 0;
            if (spawn) {
                for (let x = spawn.pos.x - 2; x <= spawn.pos.x + 2; x++) {
                    for (let y = spawn.pos.y - 2; y <= spawn.pos.y + 2; y++) {
                        if (y === spawn.pos.y + 2 || y === spawn.pos.y - 2 || x === spawn.pos.x + 2 || x === spawn.pos.x - 2) { // a ring of flags is created
                            const existingDefendFlags = _.filter(gameRoom.lookForAt(LOOK_FLAGS, x, y), function (flag) {
                                return flag.name.startsWith('defend');
                            });
                            if (existingDefendFlags.length > 0) {
                                numOfDefenderFlagsPlaced = numOfDefenderFlagsPlaced + existingDefendFlags.length;
                            } else {
                                const nameOfFlag = 'defend_' + gameRoom.name + '_' + (numOfDefenderFlagsPlaced + 1);
                                const result = gameRoom.createFlag(x, y, nameOfFlag, COLOR_RED, COLOR_BLUE);
                                Util.InfoLog('RoomDefences', 'SpawnDefenders', 'placed defender flag at (' + x + ',' + y + ',' + gameRoom.name + ') result ' + result + ' numOfDefenderFlagsPlaced ' + numOfDefenderFlagsPlaced);
                                if (result === nameOfFlag) {
                                    numOfDefenderFlagsPlaced++;
                                }
                            }
                            if (numOfDefenderFlagsPlaced >= numOfDefendersToSpawn) {
                                return;
                            }
                        }
                    }
                }
            }
        }

        /**@return {boolean}*/
        function DamagedCreeps(towers) {
            let damagedCreeps = gameRoom.find(FIND_MY_CREEPS, {
                filter: function (creep) {
                    return creep.hits < creep.hitsMax;
                }
            });
            if (gameRoom.controller.isPowerEnabled) {
                damagedCreeps = damagedCreeps.concat(gameRoom.find(FIND_MY_POWER_CREEPS, {
                    filter: function (powerCreep) {
                        return powerCreep.hits < powerCreep.hitsMax;
                    }
                }));
            }
            if (damagedCreeps.length > 0) {
                for (let i = 0; i < towers.length; i++) {
                    towers[i].heal(damagedCreeps[((i + 1) % damagedCreeps.length)]);
                }
                return true;
            }
            return false;
        }
    }
};
module.exports = RoomDefences;