let Util = require('Util');
const Towers = {
    run: function (gameRoom) {
        let anyTowerActionLastTick = Memory.MemRooms[gameRoom.name].AnyTowerAction;
        if (anyTowerActionLastTick || Game.time % Util.GAME_TIME_MODULO_1 === 0) {
            const towers = FindTowers(gameRoom);
            let anyTowerAction = HostileCreeps(towers);
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
                            Util.ErrorLog('Towers', 'FindTowers', 'tower number ' + i + ' not found!');
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
                    return (structure.hits < structure.hitsMax / 2
                        && structure.structureType !== STRUCTURE_WALL
                        && structure.structureType !== STRUCTURE_RAMPART)
                        ||
                        ((structure.structureType === STRUCTURE_RAMPART
                            || structure.structureType === STRUCTURE_WALL)
                            && structure.hits < Util.RAMPART_WALL_HITS_U_LVL5);
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
        function HostileCreeps(towers) {
            const hostileTargets = gameRoom.find(FIND_HOSTILE_CREEPS, {
                filter: function (hostile) {
                    return hostile.hits < hostile.hitsMax || hostile.pos.findInRange(FIND_STRUCTURES, 4).length >= 0 || hostile.pos.findInRange(FIND_MY_CREEPS, 3).length >= 0;
                }
            });
            if (hostileTargets.length > 0) {
                ActivateSafemode(hostileTargets);
                SpawnDefenders(hostileTargets);
                for (let i = 0; i < towers.length; i++) {
                    towers[i].attack(hostileTargets[((i + 1) % hostileTargets.length)]);
                }
                return true;
            }
            return false;
        }

        function ActivateSafemode(hostileTargets) {
            if (hostileTargets.length > 2) {
                for (const hostileTargetCount in hostileTargets) {
                    const hostileTarget = hostileTargets[hostileTargetCount];
                    if (hostileTarget.owner.username !== 'Invader' && hostileTarget.body.length > 40 && !gameRoom.controller.safeMode && !gameRoom.controller.safeModeCooldown && gameRoom.controller.safeModeAvailable > 0) {
                        const isBoosted = _.find(hostileTarget.body, function (bodypart) {
                            return bodypart.boost !== undefined;
                        });
                        if (isBoosted) {
                            const result = gameRoom.controller.activateSafeMode();
                            Util.InfoLog('Towers', 'ActivateSafemode', gameRoom.name + ' ' + result + ' attacked from ' + hostileTarget.owner.username);
                            Game.notify('safemode have been activated for room ' + gameRoom.name + ' ' + result + ' shard ' + Game.shard + ' attacked from ' + hostileTarget.owner.username, 0);
                        }
                    }
                }
            }
        }

        function SpawnDefenders(hostileTargets) {
            // TODO spawn defenders in room if under heavy attack

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
module.exports = Towers;