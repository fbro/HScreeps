let Util = require('Util');
const ExecuteJobs = {
    run: function () {

        const ERR_NO_RESULT_FOUND = -20; // job flow did not encounter any actions that lead to any results!
        const JOB_IS_DONE = -21; // when the job should be removed but there are no ERR codes
        const JOB_MOVING = -22; // when the creep os moving to complete its job
        const JOB_OBJ_DISAPPEARED = -23; // getObjectById returned null

        const NO_FETCH_FOUND = -24; // creep could not find any fetch object - end job
        const SHOULD_FETCH = -25;
        const SHOULD_ACT = -26;

        // enums for what the creep did when hostile creeps are in the room
        const CREEP_IGNORED_HOSTILE = -27;
        const CREEP_ATTACKED_HOSTILE = -28;
        const CREEP_FLED_HOSTILE = -29;

        ExecuteRoomJobs();

        //region Execute jobs

        function ExecuteRoomJobs() {
            for (const creepName in Memory.creeps) {
                //const startCpu = Game.cpu.getUsed(); // TODO cputest
                const creepMemory = Memory.creeps[creepName];
                const gameCreep = Game.creeps[creepName];
                if (!creepMemory.JobName) {
                    Util.ErrorLog('ExecuteJobs', 'ExecuteRoomJobs', 'creep JobName is undefined ' + creepName);
                    if (!gameCreep) {
                        Util.ErrorLog('ExecuteJobs', 'ExecuteRoomJobs', 'gameCreep is undefined ' + creepName);
                        delete Memory.creeps[creepName];
                    } else {
                        Util.Warning('ExecuteJobs', 'ExecuteRoomJobs', 'setting undefined JobName to idle ' + creepName + ' ' + gameCreep.pos.roomName);
                        creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                    }
                    continue;
                }
                const jobRoomName = creepMemory.JobName.split(')').pop();
                let result = ERR_NO_RESULT_FOUND;
                if (!creepMemory.JobName.startsWith('idle') && Memory.MemRooms[jobRoomName]) {
                    result = CreepActive(jobRoomName, creepMemory, gameCreep, creepName, result);
                } else {
                    result = CreepIdle(jobRoomName, gameCreep, creepName, result);
                }

                if (result !== OK && gameCreep) { // ConstantCreepActions should mostly be run when a creep is on the move, if it did an action it should not be cancelled by a newer action
                    result = ConstantCreepActions(creepMemory, gameCreep); // creep actions that should always be fired no matter what the creep is doing
                }

                //const elapsed = Game.cpu.getUsed() - startCpu; // TODO cputest
                //if(elapsed > 2 && gameCreep && creepMemory){ // only print heavy tasks
                //    Util.Info('ExecuteJobs', 'CPU', creepName + '(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ',' + gameCreep.pos.roomName + ') ' + elapsed + ' ' + creepMemory.JobName);
                //}
            }
        }

        /**@return {number}*/
        function CreepActive(jobRoomName, creepMemory, gameCreep, creepName, result) {
            const job = Memory.MemRooms[jobRoomName].RoomJobs[creepMemory.JobName];
            if (job && gameCreep) { // creep is alive and its job is found
                if (!gameCreep.spawning) {
                    result = JobAction(gameCreep, job);
                    if (result === JOB_IS_DONE) {
                        if (Memory.MemRooms[jobRoomName].RoomJobs[creepMemory.JobName]) {
                            Util.DeleteJob(job, creepMemory.JobName, jobRoomName);
                        } else {
                            Util.ErrorLog('ExecuteJobs', 'ExecuteRoomJobs', 'job done delete failed ' + gameCreep.name + ' ' + jobRoomName + ' ' + creepMemory.JobName + ' gameCreep.pos.roomName ' + gameCreep.pos.roomName);
                        }
                        let assignedToNewJob = false;
                        for (const roomJobKey in Memory.MemRooms[jobRoomName].RoomJobs) {
                            let roomJob = Memory.MemRooms[jobRoomName].RoomJobs[roomJobKey];
                            if (roomJob && roomJob.Creep === 'vacant' && creepName.startsWith(roomJob.CreepType)) {
                                assignedToNewJob = true;
                                for (const memoryElementKey in creepMemory) {
                                    if (memoryElementKey !== 'JobName') {
                                        creepMemory[memoryElementKey] = undefined;
                                    }
                                }
                                creepMemory.JobName = roomJobKey;
                                roomJob.Creep = creepName;
                                break;
                            }
                        }
                        if (!assignedToNewJob) {
                            creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                        }
                        if (creepMemory.JobName === undefined) {
                            Util.ErrorLog('ExecuteJobs', ' ExecuteRoomJobs', 'creep job is undefined! ' + creepName + ' ' + gameCreep.pos.roomName);
                        }
                    }
                }
            } else { // creep is not able to do the job
                ActiveCreepCleanup(job, gameCreep, creepMemory, creepName, jobRoomName)
            }
            return result;
        }

        function ActiveCreepCleanup(job, gameCreep, creepMemory, creepName, jobRoomName) {
            if (!job && gameCreep) { // job is outdated and removed from Memory and creep is still alive
                Util.ErrorLog('ExecuteJobs', ' ActiveCreepCleanup', creepName + ' job unexpectedly disappeared! ' + creepMemory.JobName);
                creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
            } else { // creep is dead
                if (job && !gameCreep) { // job exists and creep is dead, remove job
                    Util.DeleteJob(job, creepMemory.JobName, jobRoomName);
                }
                const removedMaxCreepsInRoom = FindAndRemoveMaxCreeps(jobRoomName, creepName);
                delete Memory.creeps[creepName];
            }
        }

        /**@return {number}*/
        function CreepIdle(jobRoomName, gameCreep, creepName, result) {
            if (!gameCreep) { // idle creep is dead
                const removedMaxCreepsInRoom = FindAndRemoveMaxCreeps(jobRoomName, creepName);
                delete Memory.creeps[creepName];
            } else { // idle creep is alive
                // TODO if creep can repair or build - do that before depositing
                // if idle creep is carrying something - move it to storage
                if (gameCreep.room.storage && gameCreep.room.storage.store.getUsedCapacity() < gameCreep.room.storage.store.getCapacity() && gameCreep.store.getUsedCapacity() > 0) {
                    result = DepositCreepStore(gameCreep, gameCreep.room.storage);
                    if (result === ERR_NOT_IN_RANGE) {
                        result = Move(gameCreep, gameCreep.room.storage);
                    }
                    gameCreep.say('idle 📦' + result);
                } else if (result === ERR_NO_RESULT_FOUND && gameCreep.getActiveBodyparts(ATTACK)) { // idle creep can attack
                    result = IdleCreepAttack(gameCreep);
                } else if (result === ERR_NO_RESULT_FOUND && gameCreep.getActiveBodyparts(RANGED_ATTACK)) { // idle creep can ranged attack
                    result = IdleCreepRangedAttack(gameCreep);
                } else if (result === ERR_NO_RESULT_FOUND && gameCreep.getActiveBodyparts(HEAL)) { // idle creep can heal
                    result = IdleCreepHeal(gameCreep);
                }
                if (result === ERR_NO_RESULT_FOUND && (!gameCreep.room.controller
                    || !gameCreep.room.controller.my
                    || gameCreep.memory.MoveHome
                    || Memory.MemRooms[gameCreep.pos.roomName]
                    && Memory.MemRooms[gameCreep.pos.roomName].MaxCreeps[creepName.substring(0, 1)]
                    && !Memory.MemRooms[gameCreep.pos.roomName].MaxCreeps[creepName.substring(0, 1)][creepName])) { // I do not own the room the idle creep is in - move it to an owned room!
                    result = IdleCreepMoveHome(creepName, gameCreep, jobRoomName);
                }
                if (result === ERR_NO_RESULT_FOUND && Memory.MemRooms[gameCreep.pos.roomName]) {
                    result = RecycleIdleCreep(creepName, gameCreep)
                }
            }
            return result;
        }

        /**@return {number}*/
        function IdleCreepAttack(gameCreep) {
            let result = ERR_NO_RESULT_FOUND;
            const hostileCreeps = gameCreep.room.find(FIND_HOSTILE_CREEPS);
            if (hostileCreeps[0]) {
                const hostileCreep = hostileCreeps[0];
                Util.Info('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + gameCreep.name + ' found ' + hostileCreeps.length + ' hostile creeps! targeting ' + hostileCreep + ' attack in ' + gameCreep.pos.roomName);
                gameCreep.say('ATK ' + hostileCreep.pos.x + ',' + hostileCreep.pos.y);
                result = gameCreep.attack(hostileCreep);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(gameCreep, hostileCreep);
                }
            }
            return result;
        }

        /**@return {number}*/
        function IdleCreepRangedAttack(gameCreep) {
            let result = ERR_NO_RESULT_FOUND;
            const hostileCreeps = gameCreep.room.find(FIND_HOSTILE_CREEPS);
            if (hostileCreeps[0]) {
                const hostileCreep = hostileCreeps[0];
                Util.Info('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + gameCreep.name + ' found ' + hostileCreeps.length + ' hostile creeps! targeting ' + hostileCreep + ' ranged attack in ' + gameCreep.pos.roomName);
                gameCreep.say('RATK ' + hostileCreep.pos.x + ',' + hostileCreep.pos.y);
                result = gameCreep.rangedAttack(hostileCreep);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(gameCreep, hostileCreep);
                }
            }
            return result;
        }

        /**@return {number}*/
        function IdleCreepHeal(gameCreep) {
            let result = ERR_NO_RESULT_FOUND;
            const damagedCreeps = gameCreep.room.find(FIND_MY_CREEPS, {
                filter: (creep) => {
                    return creep.hits < creep.hitsMax;
                }
            });
            if (damagedCreeps[0]) {
                const damagedCreep = damagedCreeps[0];
                Util.Info('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + gameCreep.name + ' found ' + damagedCreeps.length + ' damaged creeps! targeting ' + damagedCreep + ' heal');
                gameCreep.say('HEAL ' + damagedCreep.pos.x + ',' + damagedCreep.pos.y);
                result = gameCreep.heal(damagedCreep);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(gameCreep, damagedCreep);
                }
            }
            return result;
        }

        /**@return {int}*/
        function IdleCreepMoveHome(creepName, gameCreep, jobRoomName) {
            let result = ERR_NO_RESULT_FOUND;
            let closestOwnedRoom;
            if (!gameCreep.memory.MoveHome) {
                let bestDistance = Number.MAX_SAFE_INTEGER;
                for (const memRoomKey in Memory.MemRooms) {
                    if (Game.rooms[memRoomKey] && Game.rooms[memRoomKey].controller && Game.rooms[memRoomKey].controller.my) { // exist and has room
                        const distance = Game.map.getRoomLinearDistance(gameCreep.pos.roomName, memRoomKey);
                        if (distance < bestDistance) {
                            closestOwnedRoom = memRoomKey;
                            bestDistance = distance;
                        }
                    }
                }
                if (closestOwnedRoom) {
                    const removedMaxCreepsInRoom = FindAndRemoveMaxCreeps(jobRoomName, creepName); // remove from the origin room
                    if (!Memory.MemRooms[closestOwnedRoom].MaxCreeps[creepName.substring(0, 1)]) {
                        Memory.MemRooms[closestOwnedRoom].MaxCreeps[creepName.substring(0, 1)] = {};
                    }
                    Memory.MemRooms[closestOwnedRoom].MaxCreeps[creepName.substring(0, 1)][creepName] = creepName; // add to the new home room
                    gameCreep.memory.MoveHome = closestOwnedRoom;
                    Util.Info('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + creepName + ' in ' + gameCreep.pos.roomName + ' moving to ' + closestOwnedRoom);
                } else {
                    Util.ErrorLog('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + creepName + ' in ' + gameCreep.pos.roomName + ' cannot find a new home!');
                }
            } else {
                closestOwnedRoom = gameCreep.memory.MoveHome;
            }

            if (Game.rooms[closestOwnedRoom] && closestOwnedRoom && (closestOwnedRoom !== gameCreep.pos.roomName || gameCreep.pos.getRangeTo(Game.rooms[closestOwnedRoom].controller) > 4)) {
                result = Move(gameCreep, Game.rooms[closestOwnedRoom].controller);
                gameCreep.say('🏠🏃');
            } else {
                gameCreep.memory.MoveHome = undefined;
                gameCreep.say('🏠🏃✔');
            }
            return result;
        }

        /**@return {int}*/
        function RecycleIdleCreep(creepName, gameCreep) {
            let result = ERR_NO_RESULT_FOUND;
            const creepType = creepName.substring(0, 1);
            const maxCreeps = Memory.MemRooms[gameCreep.pos.roomName].MaxCreeps;
            if (maxCreeps && maxCreeps[creepType] && ((Object.keys(maxCreeps[creepType]).length - 1) > maxCreeps[creepType]['M'] || !maxCreeps[creepType]['M'])) { // check if creepType is overrepresented in this room - recycle creep
                const closestSpawn = gameCreep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    filter: (s) => {
                        return s.structureType === STRUCTURE_SPAWN;
                    }
                });
                if (closestSpawn) {
                    result = closestSpawn.recycleCreep(gameCreep);
                    if (result === ERR_NOT_IN_RANGE) {
                        result = Move(gameCreep, closestSpawn);
                    } else {
                        Util.Info('ExecuteJobs', 'RecycleIdleCreep', 'idle ' + gameCreep.name + ' recycled. MaxCreeps ' + maxCreeps[creepType]['M'] + ' current ' + (Object.keys(maxCreeps[creepType]).length - 1) + ' in ' + gameCreep.pos.roomName);
                    }
                }
            }
            return result;
        }

        /**@return {number}*/
        function ConstantCreepActions(creepMemory, gameCreep) {
            let result = ERR_NO_RESULT_FOUND;
            const energyUsers = gameCreep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                filter: (structure) => {
                    return structure.structureType === STRUCTURE_TOWER
                        || structure.structureType === STRUCTURE_EXTENSION
                        || structure.structureType === STRUCTURE_SPAWN;
                }
            });
            if (gameCreep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) { // fill adjacent spawns, extensions and towers or repair or construct on the road
                result = TryFillOrRepairOrBuild(creepMemory, gameCreep, energyUsers, result);
            }
            if (!creepMemory.Boost/*do not renew if creep is boosted*/ && (600 / gameCreep.body.length + gameCreep.ticksToLive) <= 1500) { // spawn renew functionality
                result = TryRenewCreepAdjacentToSpawn(creepMemory, gameCreep, energyUsers, result);
            }
            if (result === ERR_NO_RESULT_FOUND && gameCreep.store.getUsedCapacity() < gameCreep.store.getCapacity()) { // pickup adjacent resources
                result = TryPickupDropOrTombstone(creepMemory, gameCreep, result);
            }
            return result;
        }

        /**@return {number}*/
        function TryFillOrRepairOrBuild(creepMemory, gameCreep, energyUsers, result) {
            const energyUsersNeedsEnergy = energyUsers.filter(structure => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            if (energyUsersNeedsEnergy[0]) { // fill adjacent spawns, extensions
                result = gameCreep.transfer(energyUsersNeedsEnergy[0], RESOURCE_ENERGY); // it may do that 'double' but it really does not matter
                //Util.Info('ExecuteJobs', 'ExecuteRoomJobs', creep.name + ' transferred energy to adjacent spawn tower or extension (' + energyUsers.pos.x + ',' + energyUsers.pos.y + ',' + energyUsers.pos.roomName + ')');
            } else if (gameCreep.name.startsWith('H') || gameCreep.name.startsWith('B') || gameCreep.name.startsWith('D')) { // repair on the road
                const toRepair = gameCreep.pos.findInRange(FIND_STRUCTURES, 2, {
                    filter: (structure) => {
                        return (structure.structureType !== STRUCTURE_WALL
                            && structure.structureType !== STRUCTURE_RAMPART) && structure.hits < structure.hitsMax;
                    }
                })[0];
                if (toRepair) { // repair on the road
                    result = gameCreep.repair(toRepair);
                    //Util.Info('ExecuteJobs', 'ExecuteRoomJobs', creep.name + ' repaired ' + toRepair.structureType + ' (' + toRepair.pos.x + ',' + toRepair.pos.y + ',' + toRepair.pos.roomName + ',' + toRepair.hits + ',' + toRepair.hitsMax + ')');
                } else {
                    const toBuild = gameCreep.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0];
                    if (toBuild) { // construct on the road
                        result = gameCreep.build(toBuild);
                    }
                }
            }
            return result;
        }

        /**@return {number}*/
        function TryPickupDropOrTombstone(creepMemory, gameCreep, result) {
            const drop = gameCreep.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
            if (drop && (!gameCreep.name.startsWith('H') && !gameCreep.name.startsWith('D') || drop.resourceType === RESOURCE_SILICON || drop.resourceType === RESOURCE_BIOMASS || drop.resourceType === RESOURCE_METAL || drop.resourceType === RESOURCE_MIST)) {
                result = gameCreep.pickup(drop); // it may do that 'double' but it really does not matter
                //Util.Info('ExecuteJobs', 'ExecuteRoomJobs', gameCreep.name + ' picked up adjacent resource (' + drop.pos.x + ',' + drop.pos.y + ',' + drop.pos.roomName + ',' + drop.amount + ',' + drop.resourceType + ')');
            } else {
                const tombstone = gameCreep.pos.findInRange(FIND_TOMBSTONES, 1, {
                    filter: (t) => {
                        return t.store.getUsedCapacity() > 0;
                    }
                })[0];
                if (tombstone) {
                    for (const resourceType in tombstone.store) {
                        result = gameCreep.withdraw(tombstone, resourceType);
                        break;
                    }
                }
            }
            return result;
        }

        /**@return {number}*/
        function TryRenewCreepAdjacentToSpawn(creepMemory, gameCreep, energyUsers, result) {
            const spawns = energyUsers.filter(structure => structure.structureType === STRUCTURE_SPAWN && !structure.spawning);
            if (spawns[0]) {
                result = spawns[0].renewCreep(gameCreep);
                //Util.Info('ExecuteJobs', 'TryRenewCreepAdjacentToSpawn', 'result ' + result + ' on ' + gameCreep + ' with ' + gameCreep.ticksToLive + ' in ' + gameCreep.pos.roomName);
            }
            return result;
        }

        /**@return {number}*/
        function JobAction(creep, roomJob) {
            const jobKey = creep.memory.JobName;
            let result = ERR_NO_RESULT_FOUND;
            if (roomJob.JobType === Util.OBJECT_JOB) {
                switch (true) {
                    // obj jobs
                    case jobKey.startsWith('Src'):
                        result = JobSource(creep, roomJob);
                        break;
                    case jobKey.startsWith('Ctrl'):
                        result = JobController(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillCtrlCon'):
                        result = JobFillControllerContainer(creep, roomJob);
                        break;
                    case jobKey.startsWith('Rep'):
                        result = JobRepair(creep, roomJob);
                        break;
                    case jobKey.startsWith('Constr'):
                        result = JobConstruction(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillSpwnEx'):
                        result = JobFillSpawnExtension(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillTwr'):
                        result = JobFillTower(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillStrg'):
                        result = JobFillStorage(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillRsvStrg'):
                        result = JobFillStorageReserved(creep, roomJob);
                        break;
                    case jobKey.startsWith('ExtrMin'):
                        result = JobExtractMineral(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillTerm'):
                        result = JobFillTerminal(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillFctr'):
                        result = JobFillFactory(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillLabE'):
                        result = JobFillLabEnergy(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillPSpwnE'):
                        result = JobFillPowerSpawnEnergy(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillPSpwnP'):
                        result = JobFillPowerSpawnPower(creep, roomJob);
                        break;
                    default:
                        Util.ErrorLog('ExecuteJobs', 'JobAction', 'object type job not found ' + jobKey + ' ' + creep.name);
                }
            } else { // roomJob.JobType === Util.FLAG_JOB
                switch (true) {
                    // flag jobs
                    case jobKey.startsWith('TagCtrl'):
                        result = JobTagController(creep, roomJob);
                        break;
                    case jobKey.startsWith('ScoutPos'):
                    case jobKey.startsWith('BuildPos'):
                    case jobKey.startsWith('ClaimPos'):
                    case jobKey.startsWith('HarvestPos'):
                    case jobKey.startsWith('TransPos'):
                        result = JobMoveToPosition(creep, roomJob);
                        break;
                    case jobKey.startsWith('ClaimCtrl'):
                        result = JobClaimController(creep, roomJob);
                        break;
                    case jobKey.startsWith('ReserveCtrl'):
                        result = JobReserveController(creep, roomJob);
                        break;
                    case jobKey.startsWith('GuardPos'):
                        result = JobGuardPosition(creep, roomJob);
                        break;
                    case jobKey.startsWith('GuardGunPos'):
                        result = JobGuardGunnerPosition(creep, roomJob);
                        break;
                    case jobKey.startsWith('GuardMedPos'):
                        result = JobGuardMedicPosition(creep, roomJob);
                        break;
                    case jobKey.startsWith('FillLabMin'):
                        result = JobFillLabMineral(creep, roomJob);
                        break;
                    case jobKey.startsWith('EmptyLabMin'):
                        result = JobEmptyLabMineral(creep, roomJob);
                        break;
                    case jobKey.startsWith('AtkP'):
                        result = JobAttackPowerBank(creep, roomJob);
                        break;
                    case jobKey.startsWith('MedP'):
                        result = JobMedicPowerBank(creep, roomJob);
                        break;
                    case jobKey.startsWith('TrnsprtP'):
                        result = JobTransportPowerBank(creep, roomJob);
                        break;
                    case jobKey.startsWith('HrvstDpst'):
                        result = JobHarvestDeposit(creep, roomJob);
                        break;
                    case jobKey.startsWith('DefRsv'):
                        result = JobDefendReserved(creep, roomJob);
                        break;
                    default:
                        Util.ErrorLog('ExecuteJobs', 'JobAction', 'flag type job not found ' + jobKey + ' ' + creep.name);
                }
            }

            if (result === OK) {
                //creep.say('OK'); // job is done everyone is happy, nothing to do.
            } else if (result === ERR_TIRED) {
                creep.say('😫 ' + creep.fatigue); // creep has fatigue and is limited in movement
            } else if (result === ERR_BUSY) {
                creep.say('🕒'); // The creep might is still being spawned
            } else if (result === JOB_MOVING) {
                creep.say('🏃'); // The creep is just moving to its target
            } else { // results where anything else than OK - one should end the job!
                if (result === ERR_NO_RESULT_FOUND) {
                    Util.ErrorLog('ExecuteJobs', 'JobAction', 'ERR_NO_RESULT_FOUND ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠😞' + result);
                } else if (result === ERR_INVALID_TARGET || result === ERR_INVALID_ARGS) {
                    Util.ErrorLog('ExecuteJobs', 'JobAction', 'error invalid ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠♿' + result);
                } else if (result === JOB_OBJ_DISAPPEARED) {
                    creep.say('🙈' + result);
                } else if (result === NO_FETCH_FOUND) {
                    Util.Warning('ExecuteJobs', 'JobAction', 'no fetch object found ' + result + ' ' + jobKey + ' ' + roomJob.Creep); // most likely no energy to withdraw
                    creep.say('⚠⚡' + result);
                } else {
                    if (!result) {
                        Util.Info('ExecuteJobs', 'JobAction', 'removing ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                        Util.ErrorLog('ExecuteJobs', 'JobAction', 'undefined result ' + creep.name + ' ' + jobKey);
                        creep.say('⚠' + result);
                    } else if (result === JOB_IS_DONE) {
                        creep.say('✔');
                    } else {
                        creep.say('✔' + result);
                    }
                }
                result = JOB_IS_DONE;
            }
            return result;
        }

        //endregion

        //region room jobs

        /**@return {int}*/
        function JobSource(creep, roomJob) {
            let result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (creep.store.getFreeCapacity() === 0 || creep.memory.FetchObjectId) {
                        return SHOULD_FETCH;
                    } else {
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    let result = creep.harvest(jobObject);
                    return result;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store.getFreeCapacity() <= creep.getActiveBodyparts(WORK) * HARVEST_POWER) { // predict that creep will be full and make a transfer that wont stop the harvesting flow
                        let fetchObject;
                        let result = ERR_NO_RESULT_FOUND;
                        if (creep.memory.LinkId) {
                            fetchObject = Game.getObjectById(creep.memory.LinkId);
                            if (fetchObject) {
                                result = creep.transfer(fetchObject, RESOURCE_ENERGY);
                            }
                        }
                        if (result !== OK) {
                            fetchObject = Game.getObjectById(creep.memory.ClosestFreeStoreId);
                            if (fetchObject) {
                                result = creep.transfer(fetchObject, RESOURCE_ENERGY);
                                if (result === OK && (fetchObject.pos.x !== creep.pos.x || fetchObject.pos.y !== creep.pos.y)) {
                                    creep.moveTo(fetchObject); // force harvester to be on top of container
                                }
                            }
                        }
                        if (result === OK) {
                            creep.memory.FetchObjectId = undefined;
                            return SHOULD_ACT;
                        }
                    }
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    let fetchObject;
                    const isOnlyEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) === creep.store.getUsedCapacity();
                    if (isOnlyEnergy) {
                        fetchObject = FindClosestFreeStore(creep, 2, creep.store.getUsedCapacity(RESOURCE_ENERGY), RESOURCE_ENERGY);
                    } else {
                        fetchObject = FindClosestFreeStore(creep, 2);
                    }
                    if (!fetchObject && Memory.MemRooms[jobObject.room.name].MissingSpawn) {
                        const spawnConstruction = jobObject.room.find(FIND_MY_CONSTRUCTION_SITES, { // if there is a spawn that should be built - then build it
                            filter: function (c) {
                                return c.structureType === STRUCTURE_SPAWN;
                            }
                        })[0];
                        if (spawnConstruction) {
                            fetchObject = spawnConstruction;
                        }
                    }
                    if (!fetchObject) {
                        const nearbyConstruction = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2)[0];
                        if (nearbyConstruction) {
                            fetchObject = nearbyConstruction;
                        }
                    }
                    if (!fetchObject) { // nothing can be found then drop
                        fetchObject = 'DROP';
                    } else if (!creep.memory.LinkId && fetchObject.structureType === STRUCTURE_LINK && creep.pos.getRangeTo(fetchObject.pos) < 2) { // if fetchObject is link then save in memory
                        creep.memory.LinkId = fetchObject.id
                    } else if (creep.memory.LinkId && fetchObject.structureType !== STRUCTURE_LINK) { // if fetchObject is not link and a link is saved in memory then take that instead
                        const link = Game.getObjectById(creep.memory.LinkId);
                        if (link && link.store && link.store.getFreeCapacity(RESOURCE_ENERGY) > 200 && isOnlyEnergy) {
                            fetchObject = link;
                            creep.memory.ClosestFreeStoreId = fetchObject.id;
                        }
                    }
                    return fetchObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = ERR_NO_RESULT_FOUND;
                    if (!jobObject.energy) {
                        result = ERR_NOT_ENOUGH_RESOURCES;
                    } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        if (fetchObject.progressTotal) {
                            result = creep.build(fetchObject);
                            if (result === OK && creep.store.getFreeCapacity() > (creep.getActiveBodyparts(WORK) * BUILD_POWER)) {
                                result = ERR_BUSY; // keep building
                            }
                        } else if (fetchObject === 'DROP') {
                            for (const resourceType in creep.store) {
                                if (creep.store.getUsedCapacity(resourceType) > 0) {
                                    result = creep.drop(resourceType);
                                    break;
                                }
                            }
                        } else if (result === ERR_NO_RESULT_FOUND) {
                            result = DepositCreepStore(creep, fetchObject);
                        }
                    } else {
                        result = OK;
                    }
                    return result;
                },
            });
            if (result === ERR_NOT_ENOUGH_RESOURCES) { // repair when source is empty
                if (!creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
                    const energyDeposit = Game.getObjectById(creep.memory.ClosestFreeStoreId);
                    if (energyDeposit && energyDeposit.store.getUsedCapacity(RESOURCE_ENERGY)) {
                        result = creep.withdraw(energyDeposit, RESOURCE_ENERGY);
                    }
                } else {
                    const repair = creep.pos.findInRange(FIND_STRUCTURES, 2, {
                        filter: function (c) {
                            return c.hits < c.hitsMax;
                        }
                    })[0];
                    result = creep.repair(repair);
                }
                result = ERR_BUSY;
            } else if (result !== OK && result !== JOB_MOVING && result !== ERR_TIRED && result !== ERR_BUSY) {
                Util.Warning('ExecuteJobs', 'JobSource', 'harvester result is not OK ' + result + ' ' + creep.name + '(' + creep.pos.x + ',' + creep.pos.y + ',' + creep.pos.roomName + ')');
            }
            return result;
        }

        /**@return {int}*/
        function JobController(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.store.getUsedCapacity(RESOURCE_ENERGY) || creep.memory.FetchObjectId) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.upgradeController(jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    const labThatCanBoostOrUnBoost = HandleCreepBoost(creep, jobObject, RESOURCE_CATALYZED_GHODIUM_ACID, WORK);
                    if (labThatCanBoostOrUnBoost) {
                        return labThatCanBoostOrUnBoost;
                    }
                    let energySupply = FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                    if (!energySupply && creep.room.controller && creep.room.controller.my && creep.room.controller.level < 3) { // try and harvest
                        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                        if (source) {
                            return source;
                        }
                    }
                    return energySupply
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = ERR_NO_RESULT_FOUND;
                    if (fetchObject.structureType === STRUCTURE_LAB) {
                        if (creep.ticksToLive > 1000) {
                            result = BoostCreep(creep, fetchObject, RESOURCE_CATALYZED_GHODIUM_ACID, WORK);
                        } else if (creep.ticksToLive < 100) {
                            result = UnBoostCreep(creep, fetchObject, RESOURCE_CATALYZED_GHODIUM_ACID, WORK);
                        }
                    } else {
                        if (fetchObject.energyCapacity && creep.room.controller && creep.room.controller.my && creep.room.controller.level < 3) { // this is a source - harvest it
                            result = creep.harvest(fetchObject);
                            if (result === ERR_NOT_IN_RANGE) {
                                result = Move(creep, fetchObject);
                            }
                            if (result === OK && creep.store.getFreeCapacity() > 0) {
                                result = ERR_BUSY;
                            }
                        } else {
                            result = FetchResource(creep, fetchObject, RESOURCE_ENERGY);
                        }
                    }
                    return result;
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillControllerContainer(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store.getFreeCapacity() === 0) {
                        return JOB_IS_DONE;
                    } else if (!creep.store.getUsedCapacity(RESOURCE_ENERGY)) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) + jobObject.store.getUsedCapacity(RESOURCE_ENERGY) >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, RESOURCE_ENERGY);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobRepair(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.hits === jobObject.hitsMax) {
                        return JOB_IS_DONE;
                    } else if (!creep.store.getUsedCapacity(RESOURCE_ENERGY)) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.repair(jobObject);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    const calculatedHits = jobObject.hits + (creep.getActiveBodyparts(WORK) * REPAIR_POWER);
                    if (calculatedHits >= jobObject.hitsMax) {
                        // predict that the creep will be done
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, RESOURCE_ENERGY);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobConstruction(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.store.getUsedCapacity(RESOURCE_ENERGY) || creep.memory.FetchObjectId) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.build(jobObject);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    let energySupply = FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                    if (!energySupply) { // try and harvest
                        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                        if (source) {
                            return source;
                        }
                    }
                    return energySupply
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (fetchObject.energyCapacity && !fetchObject.structureType) { // this is a source - harvest it
                        let result = creep.harvest(fetchObject);
                        if (result === ERR_NOT_IN_RANGE) {
                            result = Move(creep, fetchObject);
                        }
                        if (result === OK && creep.store.getFreeCapacity() > 0) {
                            result = ERR_BUSY;
                        }
                        return result;
                    }
                    return FetchResource(creep, fetchObject, RESOURCE_ENERGY);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillSpawnExtension(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store.getUsedCapacity(RESOURCE_ENERGY) === jobObject.store.getCapacity(RESOURCE_ENERGY)) { // is job done?
                        return JOB_IS_DONE;
                    } else if (!creep.store.getUsedCapacity(RESOURCE_ENERGY)) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if ((jobObject.store.getUsedCapacity(RESOURCE_ENERGY) + creep.store.getUsedCapacity(RESOURCE_ENERGY)) >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        // predict that the creep will be done
                        return JOB_IS_DONE;
                    } else { // action not done yet
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, RESOURCE_ENERGY);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillTower(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store.getUsedCapacity(RESOURCE_ENERGY) === jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else if (!creep.store.getUsedCapacity(RESOURCE_ENERGY)) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (jobObject.store.getUsedCapacity(RESOURCE_ENERGY) + creep.store.getUsedCapacity(RESOURCE_ENERGY) >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        // predict that the creep will be done
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, RESOURCE_ENERGY);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillStorage(creep, roomJob) {
            let resourceType = creep.memory.resourceType;
            if (!resourceType) {
                resourceType = creep.memory.JobName.split(/[(,)]+/).filter(function (e) {
                    return e;
                })[3];
                creep.memory.resourceType = resourceType;
            }
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.store.getUsedCapacity()) { // if creep is not carrying anything
                        // if the target is a dropped resource it may just disappear because it was picked up
                        if (!jobObject ||
                            !jobObject.resourceType/*drop*/ && jobObject.store.getUsedCapacity(resourceType) <= GetDesiredLeftoverResource(jobObject.structureType, resourceType, jobObject.room.storage) // check if target is "empty"
                        ) {
                            return JOB_IS_DONE;
                        } else {
                            return SHOULD_ACT; // get resources from target
                        }
                    } else {
                        return SHOULD_FETCH; // place in storage
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) { // get the resource
                    if (jobObject.resourceType) { // drop type
                        return creep.pickup(jobObject);
                    } else {
                        return creep.withdraw(jobObject, resourceType);
                    }
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return OK;
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (jobObject.room && jobObject.room.storage) {
                        return jobObject.room.storage;
                    } else if (creep.room.storage && (jobObject.room && jobObject.room.name !== creep.room.name || !jobObject.room)) {
                        return creep.room.storage;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) { // deposit the resource
                    return DepositCreepStore(creep, fetchObject, jobObject);
                },
            });
            return result;
        }

        /**@return {number}*/
        function GetDesiredLeftoverResource(structureType, resourceType, storage) {
            if (structureType === STRUCTURE_TERMINAL) {
                if (resourceType === RESOURCE_ENERGY) {
                    if (storage.store.getUsedCapacity(RESOURCE_ENERGY) < Util.STORAGE_ENERGY_LOW) {
                        return 0;
                    } else {
                        return Util.TERMINAL_TARGET_ENERGY;
                    }
                } else {
                    return Util.TERMINAL_TARGET_RESOURCE;
                }
            } else {
                return 0;
            }
        }

        /**@return {int}*/
        function JobFillStorageReserved(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.store.getUsedCapacity()) {
                        return SHOULD_ACT; // get resources from target
                    } else {
                        return SHOULD_FETCH; // place in storage
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) { // get the resource
                    return FetchResource(creep, jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return OK;
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (
                        Memory.MemRooms[jobObject.pos.roomName]
                        && Memory.MemRooms[jobObject.pos.roomName].MainRoom
                        && Game.rooms[Memory.MemRooms[jobObject.pos.roomName].MainRoom]
                        && Game.rooms[Memory.MemRooms[jobObject.pos.roomName].MainRoom].storage
                    ) {
                        return Game.rooms[Memory.MemRooms[jobObject.pos.roomName].MainRoom].storage;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) { // deposit the resource
                    return DepositCreepStore(creep, fetchObject, jobObject);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobExtractMineral(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.mineralAmount === 0) { // is job done?
                        return JOB_IS_DONE;
                    } else if (creep.store.getUsedCapacity() === creep.store.getCapacity()) { // fetch - drop minerals in nearby container
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.harvest(jobObject);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if ((jobObject.mineralAmount - (creep.getActiveBodyparts(WORK))) <= 0) {
                        // predict that the creep will be done
                        return JOB_IS_DONE;
                    } else { // action not done yet
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    let fetchObject = FindClosestFreeStore(creep, 2);
                    if (!fetchObject) {
                        Util.Warning('ExecuteJobs', 'JobExtractMineral', 'no nearby store ' + creep.name + ' ' + creep.memory.JobName);
                        fetchObject = jobObject.room.storage;
                    }
                    return fetchObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return DepositCreepStore(creep, fetchObject, jobObject);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillTerminal(creep, roomJob) {
            let resourceType = creep.memory.resourceType;
            if (!resourceType) {
                resourceType = creep.memory.JobName.split(/[()]+/).filter(function (e) {
                    return e;
                })[1];
                creep.memory.resourceType = resourceType;
            }
            const creepCarry = creep.store.getCapacity(); // when a creep withdraws from storage then the amount is diminished - the job might end because of that diminish - it should not
            let storageResourceAmount = 0;
            let High = Util.STORAGE_HIGH - creepCarry;
            let HighTransfer = Util.STORAGE_HIGH_TRANSFER;
            let Medium = Util.STORAGE_MEDIUM - creepCarry;
            let MediumTransfer = Util.STORAGE_MEDIUM_TRANSFER;
            let Low = Util.STORAGE_LOW - creepCarry;
            let LowTransfer = Util.STORAGE_LOW_TRANSFER;
            if (resourceType === RESOURCE_ENERGY) {
                High = Util.STORAGE_ENERGY_HIGH - creepCarry;
                HighTransfer = Util.STORAGE_ENERGY_HIGH_TRANSFER;
                Medium = Util.STORAGE_ENERGY_MEDIUM - creepCarry;
                MediumTransfer = Util.STORAGE_ENERGY_MEDIUM_TRANSFER;
                Low = Util.STORAGE_ENERGY_LOW - creepCarry;
                LowTransfer = Util.STORAGE_ENERGY_LOW_TRANSFER;
            }
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (terminal) {
                    const storage = terminal.room.storage;
                    storageResourceAmount = storage.store.getUsedCapacity(resourceType);
                    if (!creep.store.getUsedCapacity(resourceType)) {
                        if (storageResourceAmount <= Low && resourceType === RESOURCE_ENERGY // low resource in storage abort only if energy

                            || storageResourceAmount === 0

                            || storageResourceAmount >= High
                            && terminal.store.getUsedCapacity(resourceType) >= HighTransfer

                            || storageResourceAmount <= High
                            && terminal.store.getUsedCapacity(resourceType) >= MediumTransfer

                            || storageResourceAmount <= Medium
                            && terminal.store.getUsedCapacity(resourceType) >= LowTransfer
                        ) {
                            return JOB_IS_DONE;
                        } else if (!creep.store.getUsedCapacity(resourceType)) { // fetch
                            return SHOULD_FETCH;
                        }
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(jobObject, resourceType);
                },
                /**@return {int}*/
                IsJobDone: function (terminal) {
                    const newAmountInTerminal = creep.store.getUsedCapacity(resourceType) + terminal.store.getUsedCapacity(resourceType);
                    if (
                        storageResourceAmount <= Low && resourceType === RESOURCE_ENERGY // low resource in storage abort only if energy

                        || storageResourceAmount <= Medium
                        && newAmountInTerminal >= LowTransfer

                        || storageResourceAmount <= High
                        && newAmountInTerminal >= MediumTransfer

                        || storageResourceAmount >= High
                        && newAmountInTerminal >= HighTransfer
                    ) {
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(terminal);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (resourceType === RESOURCE_ENERGY) {
                        return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                    } else if (creep.room.storage && creep.room.storage.store.getUsedCapacity(resourceType) > 0) {
                        return creep.room.storage;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, resourceType);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillFactory(creep, roomJob) {
            let resourceType = creep.memory.resourceType;
            if (!resourceType) {
                resourceType = creep.memory.JobName.split(/[()]+/).filter(function (e) {
                    return e;
                })[1];
                creep.memory.resourceType = resourceType;
            }
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    const usedCapacity = jobObject.store.getUsedCapacity(resourceType);
                    if (resourceType === RESOURCE_ENERGY && usedCapacity >= Util.FACTORY_TARGET_ENERGY
                        || resourceType !== RESOURCE_ENERGY && usedCapacity >= Util.FACTORY_TARGET_RESOURCE
                        || creep.store.getUsedCapacity(resourceType) === 0 && !creep.room.storage.store.getUsedCapacity(resourceType) && !creep.room.terminal.store.getUsedCapacity(resourceType)
                    ) {
                        return JOB_IS_DONE;
                    } else if (!creep.store.getUsedCapacity(resourceType)) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(jobObject, resourceType);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (resourceType === RESOURCE_ENERGY && (creep.store.getUsedCapacity(resourceType) + jobObject.store.getUsedCapacity(resourceType)) >= Util.FACTORY_TARGET_ENERGY
                        || resourceType !== RESOURCE_ENERGY && (creep.store.getUsedCapacity(resourceType) + jobObject.store.getUsedCapacity(resourceType)) >= Util.FACTORY_TARGET_RESOURCE) {
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (resourceType === RESOURCE_ENERGY) {
                        return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                    } else if (creep.room.storage && creep.room.storage.store.getUsedCapacity(resourceType) > 0) {
                        return creep.room.storage;
                    } else if (creep.room.terminal && creep.room.terminal.store.getUsedCapacity(resourceType) > 0) {
                        return creep.room.terminal;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let max = -1;
                    if (resourceType === RESOURCE_ENERGY) {
                        max = Util.FACTORY_TARGET_ENERGY;
                    } else {
                        max = Util.FACTORY_TARGET_RESOURCE;
                    }
                    return FetchResource(creep, fetchObject, resourceType, max - jobObject.store.getUsedCapacity(resourceType));
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillLabEnergy(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store.getUsedCapacity(RESOURCE_ENERGY) === jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else if (!creep.store.getUsedCapacity(RESOURCE_ENERGY)) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) + jobObject.store.getUsedCapacity(RESOURCE_ENERGY) >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, RESOURCE_ENERGY);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillPowerSpawnEnergy(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store.getUsedCapacity(RESOURCE_ENERGY) === jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else if (!creep.store.getUsedCapacity(RESOURCE_ENERGY)) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    let result = creep.transfer(jobObject, RESOURCE_ENERGY);
                    if (result === OK && jobObject.store.getUsedCapacity(RESOURCE_ENERGY) > 4000) {
                        return JOB_IS_DONE;
                    }
                    return result;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) + jobObject.store.getUsedCapacity(RESOURCE_ENERGY) >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, RESOURCE_ENERGY);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillPowerSpawnPower(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store.getFreeCapacity(RESOURCE_POWER) === 0) {
                        return JOB_IS_DONE;
                    } else if (!creep.store.getUsedCapacity(RESOURCE_POWER)) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    let result = creep.transfer(jobObject, RESOURCE_POWER);
                    if (result === OK) {
                        return JOB_IS_DONE;
                    } else {
                        return result;
                    }
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store.getUsedCapacity(RESOURCE_POWER) + jobObject.store.getUsedCapacity(RESOURCE_POWER) >= jobObject.store.getCapacity(RESOURCE_POWER)) {
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined} */
                FindFetchObject: function (jobObject) {
                    return FindFetchResource(creep, jobObject, RESOURCE_POWER);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, RESOURCE_POWER, jobObject.store.getFreeCapacity(RESOURCE_POWER));
                },
            });
            return result;
        }

        //endregion

        //region flag jobs

        /**@return {int}*/
        function JobTagController(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject.room) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (jobObject.room && jobObject.room.controller) {
                        return jobObject.room.controller;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = creep.signController(fetchObject, jobObject.name);
                    if (result === OK) {
                        Util.InfoLog('ExecuteJobs', 'JobTagController', 'JobTagController done ' + creep.name + ' in ' + jobObject.pos.roomName + ' tag ' + jobObject.name);
                        jobObject.remove();
                        return JOB_IS_DONE;
                    } else {
                        return result;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobClaimController(creep, roomJob) {
            Game.map.visual.circle(creep.pos, {
                radius: 4,
                fill: '#00ff00',
                stroke: '#00ff00',
                lineStyle: 'dotted',
                strokeWidth: 2
            });
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject.room) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (jobObject.room && jobObject.room.controller) {
                        return jobObject.room.controller;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (!fetchObject.my && fetchObject.owner) {
                        let result = creep.attackController(fetchObject);
                        if (result === OK) {
                            Util.InfoLog('ExecuteJobs', 'JobClaimController', 'attackController ' + creep.name + ' in ' + jobObject.pos.roomName + ' flag ' + jobObject.name);
                        }
                        return result;
                    } else {
                        let result = creep.claimController(fetchObject);
                        if (result === OK) {
                            Util.InfoLog('ExecuteJobs', 'JobClaimController', 'done ' + creep.name + ' in ' + jobObject.pos.roomName + ' flag ' + jobObject.name);
                            jobObject.remove();
                            return JOB_IS_DONE;
                        } else {
                            if (result === ERR_GCL_NOT_ENOUGH) {
                                Util.Warning('ExecuteJobs', 'JobClaimController', 'ERR_GCL_NOT_ENOUGH ' + creep.name + ' in ' + jobObject.pos.roomName + ' flag ' + jobObject.name);
                            }
                            return result;
                        }
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobReserveController(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject.room) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (jobObject.room && jobObject.room.controller) {
                        return jobObject.room.controller;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = creep.reserveController(fetchObject);
                    if (result === ERR_INVALID_TARGET) {
                        result = creep.attackController(fetchObject);
                    }
                    return result
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobGuardPosition(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject.room || jobObject.room.name !== creep.pos.roomName) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    const hostileCreep = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
                    if (hostileCreep && (hostileCreep.pos.getRangeTo(creep.pos) < 6 || creep.room.controller && creep.room.controller.my)) {
                        return hostileCreep;
                    } else {
                        if (jobObject) {
                            const structure = jobObject.pos.findInRange(FIND_STRUCTURES, 0)[0];
                            if (structure) {
                                return structure;
                            }
                            const hostileStructure = jobObject.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
                            if (hostileStructure) {
                                return hostileStructure;
                            }
                        }
                    }
                    return jobObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (jobObject !== fetchObject) { // hostileCreep or hostileStructure
                        if (fetchObject.structureType === STRUCTURE_PORTAL) {
                            Util.InfoLog('ExecuteJobs', 'JobGuardPosition', 'entering portal! ' + fetchObject.pos.roomName);
                            return ERR_NOT_IN_RANGE;
                        }
                        return creep.attack(fetchObject);
                    } else if (creep.pos.x === jobObject.pos.x && creep.pos.y === jobObject.pos.y && creep.pos.roomName === jobObject.pos.roomName) {
                        return OK; // when OK is returned FindFetchObject is checking each tick for new hostileCreeps
                    } else if (jobObject === fetchObject) { // move to flag
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobGuardGunnerPosition(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject.room) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    const hostileCreep = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
                    if (hostileCreep && (hostileCreep.pos.getRangeTo(creep.pos) < 6 || creep.room.controller && creep.room.controller.my)) {
                        return hostileCreep;
                    } else {
                        if (jobObject) {
                            const hostileStructure = jobObject.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
                            if (hostileStructure) {
                                return hostileStructure;
                            }
                        }
                    }
                    return jobObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (jobObject !== fetchObject) { // hostileCreep or structure
                        let result = creep.rangedAttack(fetchObject);
                        if (result === OK && creep.pos.getRangeTo(fetchObject) > 1) {
                            return ERR_NOT_IN_RANGE; // always try and move closer to the structure it is attacking
                        }
                        return result;
                    } else if (creep.pos.isEqualTo(jobObject)) {
                        return OK; // when OK is returned FindFetchObject is checking each tick for new hostileCreeps
                    } else if (jobObject === fetchObject) { // move to flag
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobGuardMedicPosition(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject.room) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    const woundedCreep = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
                        filter: function (creep) {
                            return creep.hits < creep.hitsMax;
                        }
                    });
                    if (woundedCreep) {
                        return woundedCreep;
                    } else {
                        return jobObject;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (jobObject !== fetchObject) { // woundedCreep
                        if (Math.abs(creep.pos.x - fetchObject.pos.x) > 1 || Math.abs(creep.pos.y - fetchObject.pos.y) > 1) {
                            creep.heal(fetchObject);
                            return ERR_NOT_IN_RANGE;
                        } else {
                            return creep.heal(fetchObject);
                        }
                    } else if (creep.pos.isEqualTo(jobObject)) {
                        return OK; // when OK is returned FindFetchObject is checking each tick for new woundedCreeps
                    } else if (jobObject === fetchObject) { // move to flag
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobMoveToPosition(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.memory.HealthCheck) {
                        if (creep.ticksToLive > 1000 || (creep.name.startsWith('C') || creep.name.startsWith('R')) && creep.ticksToLive > 550) {
                            creep.memory.HealthCheck = true;
                        } else {
                            Util.Info('ExecuteJobs', 'JobMoveToPosition', creep.name + ' committed suicide ticksToLive ' + creep.ticksToLive);
                            new RoomVisual(creep.pos.roomName).text("💀", creep.pos);
                            creep.suicide();
                            return OK;
                        }
                    }
                    if (!jobObject.room) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return jobObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (creep.pos.isEqualTo(jobObject)) {
                        return OK;
                    } else {
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillLabMineral(creep, roomJob) {
            let lab;
            if (creep.memory.LabId) {
                lab = Game.getObjectById(creep.memory.LabId);
            }
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.memory.Mineral) {
                        creep.memory.Mineral = jobObject.name.split(/[-]+/).filter(function (e) {
                            return e;
                        })[1];
                        if (!lab) {
                            lab = jobObject.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                                filter: function (lab) {
                                    return (lab.structureType === STRUCTURE_LAB);
                                }
                            })[0];
                            if (!lab) { // lab does not exist - delete flag and remove job
                                jobObject.remove();
                                Util.ErrorLog('ExecuteJobs', 'JobFillLabMineral', 'lab gone ' + jobObject.pos.roomName + ' ' + creep.name);
                                return ERR_NO_RESULT_FOUND;
                            }
                            creep.memory.LabId = lab.id;
                        }
                    }
                    if (lab.store.getFreeCapacity(creep.memory.Mineral) < 500) {
                        return JOB_IS_DONE; // lab is full with said mineral - job is done
                    } else if (creep.store.getUsedCapacity(creep.memory.Mineral) > 0) {
                        return SHOULD_ACT; // transfer to lab
                    } else {
                        return SHOULD_FETCH // withdraw desired resource nearby
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(lab, creep.memory.Mineral);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (lab.store.getFreeCapacity(creep.memory.Mineral) - creep.store.getUsedCapacity(creep.memory.Mineral) <= 0) { // predict
                        return JOB_IS_DONE
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return jobObject.room.find(FIND_STRUCTURES, {
                        filter: function (s) {
                            return ((s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_TERMINAL)
                                && s.store.getUsedCapacity(creep.memory.Mineral) > 0);
                        }
                    })[0];
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    const lab = jobObject.pos.lookFor(LOOK_STRUCTURES)[0];
                    return FetchResource(creep, fetchObject, creep.memory.Mineral, lab.store.getFreeCapacity(creep.memory.Mineral));
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobEmptyLabMineral(creep, roomJob) {
            let lab;
            if (creep.memory.LabId) {
                lab = Game.getObjectById(creep.memory.LabId);
            }
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    let mineral = creep.memory.Mineral;
                    if (!mineral) {
                        mineral = jobObject.name.split('-')[1];
                        creep.memory.Mineral = mineral;
                        if (!lab) {
                            lab = jobObject.pos.findInRange(FIND_MY_STRUCTURES, 0, {
                                filter: function (lab) {
                                    return (lab.structureType === STRUCTURE_LAB);
                                }
                            })[0];
                            if (!lab) { // lab does not exist - delete flag and remove job
                                jobObject.remove();
                                Util.ErrorLog('ExecuteJobs', 'JobEmptyLabMineral', 'lab gone ' + jobObject.pos.roomName + ' ' + creep.name);
                                return ERR_NO_RESULT_FOUND;
                            }
                            creep.memory.LabId = lab.id;
                        }
                    }
                    if (lab.store.getUsedCapacity(mineral) < 500) {
                        //Util.Info('ExecuteJobs', 'JobEmptyLabMineral', 'JOB_IS_DONE ' + ' mineral ' + mineral + ' lab.store ' + lab.store.getUsedCapacity(mineral));
                        return JOB_IS_DONE; // nothing in lab - job is done
                    } else if (creep.store.getFreeCapacity() > 0) {
                        return SHOULD_ACT; // withdraw from lab
                    } else {
                        return SHOULD_FETCH // transfer to storage
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.withdraw(lab, creep.memory.Mineral);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return jobObject.room.storage;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return creep.transfer(fetchObject, creep.memory.Mineral);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobAttackPowerBank(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    return SHOULD_ACT;
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if (!jobObject.room) { // room is invisible - not in the room yet
                        return ERR_NOT_IN_RANGE;
                    }
                    let powerBank;
                    if (creep.memory.PowerBankId) {
                        powerBank = Game.getObjectById(creep.memory.PowerBankId);
                    }
                    if (!powerBank) {
                        powerBank = jobObject.pos.lookFor(LOOK_STRUCTURES)[0];
                        if (powerBank) {
                            creep.memory.PowerBankId = powerBank.id;
                        }
                    }
                    let result = ERR_NO_RESULT_FOUND;
                    if (creep.hitsMax - creep.hits > 600) {
                        result = ERR_TIRED;
                    } else if (powerBank) {
                        result = creep.attack(powerBank);
                        if (result === ERR_NO_BODYPART) {
                            creep.suicide();
                        }
                        if (powerBank.hits < Util.GENERATE_TRANSPORTER_WHEN_POWERBANK_HITS_UNDER) {
                            if (!powerBank.room.lookForAt(LOOK_FLAGS, 0, 0)[0]) {
                                Util.Info('ExecuteJobs', 'JobAttackPowerBank', 'generate transport power flags ' + creep.name + ' ' + jobObject.name + ' hits left ' + powerBank.hits);
                                // generate transport power flags depending on the amount of power that was in the powerBank
                                const numOfTransporterFlags = (powerBank.power / Util.TRANSPORTER_MAX_CARRY);
                                for (let i = 0; i < numOfTransporterFlags; i++) {
                                    jobObject.room.createFlag(i, 0, i + '_getPower_' + jobObject.pos.roomName, COLOR_ORANGE, COLOR_GREY);
                                }
                            }
                        }
                    } else {
                        const powerResource = jobObject.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
                            filter: function (power) {
                                return power.resourceType === RESOURCE_POWER;
                            }
                        })[0];
                        if (powerResource) {
                            Util.Info('ExecuteJobs', 'JobAttackPowerBank', 'done ' + creep.name + ' ' + jobObject.name + ' power ' + powerResource.amount);
                        } else {
                            Util.Info('ExecuteJobs', 'JobAttackPowerBank', 'done ' + creep.name + ' ' + jobObject.name);
                        }
                        jobObject.remove();
                        result = JOB_IS_DONE;
                    }
                    return result;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return jobObject; // not used
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return JOB_IS_DONE; // not used
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobMedicPowerBank(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject.room || jobObject.pos.roomName !== creep.pos.roomName) { // invisible
                        return SHOULD_ACT;
                    } else {
                        let powerBank;
                        if (creep.memory.PowerBankId) {
                            powerBank = Game.getObjectById(creep.memory.PowerBankId);
                        }
                        if (!powerBank) {
                            powerBank = jobObject.pos.lookFor(LOOK_STRUCTURES)[0];
                            if (powerBank) {
                                creep.memory.PowerBankId = powerBank.id;
                            }
                        }
                        if (!powerBank) {
                            return JOB_IS_DONE;
                        } else {
                            return SHOULD_FETCH;
                        }
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if (creep.hits < creep.hitsMax) {
                        const result = creep.heal(creep);
                        Util.Info('ExecuteJobs', 'JobMedicPowerBank', 'self heal on the road ' + creep.name + ' ' + creep.pos.roomName + ' ' + result);
                    }
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject); // not used
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (creep.memory.PrimaryHealerTarget && Game.creeps[creep.memory.PrimaryHealerTarget] && Game.creeps[creep.memory.PrimaryHealerTarget].hits < Game.creeps[creep.memory.PrimaryHealerTarget].hitsMax) {
                        return Game.creeps[creep.memory.PrimaryHealerTarget];
                    } else {
                        let selectedWoundedCreep;
                        let mostWoundedCreep;
                        const woundedCreeps = creep.room.find(FIND_MY_CREEPS, {
                            filter: function (creep) {
                                return creep.hits < creep.hitsMax;
                            }
                        });
                        const healerCreeps = creep.room.find(FIND_MY_CREEPS, {
                            filter: function (creep) {
                                return creep.getActiveBodyparts(HEAL) > 0;
                            }
                        });
                        for (const woundedCreepKey in woundedCreeps) {
                            const woundedCreep = woundedCreeps[woundedCreepKey];
                            let isAnyoneHealingWoundedCreep = false;
                            for (const healerCreepKey in healerCreeps) {
                                const healerCreep = healerCreeps[healerCreepKey];
                                if (healerCreep.memory.PrimaryHealerTarget === woundedCreep.name) {
                                    isAnyoneHealingWoundedCreep = true;
                                    break;
                                }
                            }
                            if (!isAnyoneHealingWoundedCreep) {
                                creep.memory.PrimaryHealerTarget = woundedCreep.name;
                                selectedWoundedCreep = woundedCreep;
                                break;
                            }
                            if (!mostWoundedCreep || (mostWoundedCreep.hitsMax - mostWoundedCreep.hits) < (woundedCreep.hitsMax - woundedCreep.hits)) {
                                mostWoundedCreep = woundedCreep;
                            }
                        }
                        if (selectedWoundedCreep) {
                            return selectedWoundedCreep;
                        } else if (mostWoundedCreep) {
                            return mostWoundedCreep;
                        } else {
                            return jobObject;
                        }
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (fetchObject === jobObject) {
                        if (creep.hits < creep.hitsMax) {
                            const result = creep.heal(creep);
                            Util.Info('ExecuteJobs', 'JobMedicPowerBank', 'self heal ' + creep.name + ' ' + creep.pos.roomName + ' ' + result);
                        }
                        if (creep.pos.getRangeTo(jobObject) < 8) {
                            return OK;
                        } else {
                            return ERR_NOT_IN_RANGE;
                        }
                    } else {
                        let result = creep.heal(fetchObject);
                        if (result !== OK || creep.getActiveBodyparts(HEAL) * 12 + fetchObject.hits >= fetchObject.hitsMax) { // predict that creep is fully healed
                            return result;
                        } else {
                            return ERR_BUSY;
                        }
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobTransportPowerBank(creep, roomJob) {
            let result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject) {
                        if (creep.store.getUsedCapacity() > 0) {
                            return SHOULD_FETCH;
                        } else {
                            return JOB_IS_DONE;
                        }
                    } else if (creep.store.getFreeCapacity() > 0) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if (!creep.memory.HealthCheck) {
                        if (creep.ticksToLive > 1000) {
                            creep.memory.HealthCheck = true;
                        } else {
                            Util.Info('ExecuteJobs', 'JobTransportPowerBank', creep.name + ' committed suicide ticksToLive ' + creep.ticksToLive);
                            creep.suicide();
                            return OK;
                        }
                    }
                    if (!jobObject.room) { // invisible
                        return ERR_NOT_IN_RANGE;
                    }
                    const powerBank = jobObject.room.find(FIND_STRUCTURES, {
                        filter: function (s) {
                            return s.structureType === STRUCTURE_POWER_BANK;
                        }
                    })[0];
                    if (powerBank) { // no powerResource on ground or powerRuin and in range to powerBank
                        if (creep.pos.getRangeTo(powerBank) < 6) {
                            return ERR_BUSY; // powerBank is still alive - wait for it to get destroyed
                        }
                        return Move(creep, powerBank);
                    }
                    let powerTarget = jobObject.room.find(FIND_RUINS, {
                        filter: function (ruin) {
                            return ruin.store.getUsedCapacity(RESOURCE_POWER) > 0;
                        }
                    })[0];
                    let result;
                    if (powerTarget) {
                        result = creep.withdraw(powerTarget, RESOURCE_POWER);
                    } else {
                        powerTarget = jobObject.room.find(FIND_DROPPED_RESOURCES, {
                            filter: function (s) {
                                return s.resourceType === RESOURCE_POWER;
                            }
                        })[0];
                        if (powerTarget) {
                            result = creep.pickup(powerTarget);
                        }
                    }
                    if (result === ERR_NOT_IN_RANGE) {
                        result = Move(creep, powerTarget);
                    } else if (result === OK) {
                        creep.memory._move = undefined;
                    } else {
                        Util.Info('ExecuteJobs', 'JobTransportPowerBank', 'removing powerbank flag because last power has been picked up! ' + jobObject.pos.roomName);
                        jobObject.remove();
                        return JOB_IS_DONE;
                    }
                    return result;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindClosestFreeStore(creep);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    const result = DepositCreepStore(creep, fetchObject);
                    if (result === OK) {
                        Util.InfoLog('ExecuteJobs', 'JobTransportPowerBank', 'transfer power ' + creep.name + ' ' + creep.store.getUsedCapacity(RESOURCE_POWER) + ' to (' + fetchObject.pos.x + ',' + fetchObject.pos.y + ',' + fetchObject.pos.roomName + ')');
                    }
                    return result;
                },
            });
            if (result === ERR_NO_PATH) {
                result = OK;
            }
            return result;
        }

        /**@return {int}*/
        function JobHarvestDeposit(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.store.getUsedCapacity() && creep.ticksToLive < 400) {
                        //Util.Info('ExecuteJobs', 'JobHarvestDeposit', creep.name + ' committed suicide creep.ticksToLive ' + creep.ticksToLive + ' JOB_IS_DONE');
                        creep.suicide();
                        return JOB_IS_DONE;
                    } else if (creep.store.getFreeCapacity() === 0 || creep.memory.FetchObjectId && creep.store.getUsedCapacity() > 0 || creep.ticksToLive < 400) {
                        return SHOULD_FETCH;
                    } else {
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if (!jobObject.room) { // invisible room
                        return ERR_NOT_IN_RANGE;
                    } else {
                        let deposit;
                        if (creep.memory.DepositId) {
                            deposit = Game.getObjectById(creep.memory.DepositId);
                        }
                        if (!deposit) {
                            deposit = jobObject.pos.lookFor(LOOK_DEPOSITS)[0];
                            if (deposit) {
                                creep.memory.DepositId = deposit.id;
                            } else {
                                Util.ErrorLog('ExecuteJobs', 'JobHarvestDeposit', creep.name + ' no deposit found removed deposit flag in ' + jobObject.pos.roomName);
                                jobObject.remove();
                            }
                        }
                        if (deposit && deposit.cooldown === 0) {
                            return creep.harvest(deposit)
                        } else if (deposit && deposit.lastCooldown >= Util.DEPOSIT_MAX_LAST_COOLDOWN) {
                            Util.InfoLog('ExecuteJobs', 'JobHarvestDeposit', creep.name + ' removed deposit in ' + jobObject.pos.roomName + ' lastCooldown ' + deposit.lastCooldown);
                            jobObject.remove();
                            return JOB_IS_DONE;
                        } else if (deposit && deposit.cooldown > 0) {
                            return ERR_BUSY;
                        } else {
                            return JOB_IS_DONE;
                        }
                    }
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindClosestFreeStore(creep);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return DepositCreepStore(creep, fetchObject);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobDefendReserved(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!jobObject.room) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) { // get the resource
                    return ERR_NOT_IN_RANGE;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    const closestHostile = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
                    if (closestHostile && (closestHostile.pos.getRangeTo(creep.pos) < 6 || creep.room.controller && creep.room.controller.my)) {
                        return closestHostile;
                    } else {
                        const closestHostileStructure = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
                        if (closestHostileStructure) {
                            return closestHostileStructure;
                        }
                        return jobObject;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) { // deposit the resource
                    if (fetchObject === jobObject) {
                        if (creep.pos.getRangeTo(fetchObject) > 2) {
                            return ERR_NOT_IN_RANGE;
                        } else {
                            return OK;
                        }
                    } else {
                        Util.Info('ExecuteJobs', 'JobDefendReserved', creep.name + ' attacking hostile ' + fetchObject + ' ' + creep.pos.roomName);
                        return creep.rangedAttack(fetchObject);
                    }
                },
            });
            return result;
        }

        //endregion

        //region helper functions

        function FindAndRemoveMaxCreeps(jobRoomName, creepName) {
            const creepType = creepName.substring(0, 1);
            if (Memory.MemRooms[jobRoomName]
                && Memory.MemRooms[jobRoomName].MaxCreeps[creepType]
                && Memory.MemRooms[jobRoomName].MaxCreeps[creepType][creepName]
            ) {
                Memory.MemRooms[jobRoomName].MaxCreeps[creepType][creepName] = undefined;
                return jobRoomName;
            } else { // creep was not found in the expected room, now search all rooms for the creepName to remove
                //Util.Info('ExecuteJobs', 'FindAndRemoveMaxCreeps', 'must look in other rooms ' + creepName + ' last job change was in room ' + jobRoomName + ' creepType ' + creepType);
                for (const memRoomKey in Memory.MemRooms) { // search for room with the creep
                    if (Memory.MemRooms[memRoomKey].MaxCreeps[creepType]
                        && Memory.MemRooms[memRoomKey].MaxCreeps[creepType][creepName]
                    ) {
                        Memory.MemRooms[memRoomKey].MaxCreeps[creepType][creepName] = undefined;
                        //Util.Info('ExecuteJobs', 'FindAndRemoveMaxCreeps', 'found in other room ' + memRoomKey + ' ' + creepName + ' last job change was in room ' + jobRoomName + ' creepType ' + creepType);
                        return memRoomKey;
                    }
                }
                Util.ErrorLog('ExecuteJobs', 'FindAndRemoveMaxCreeps', 'could not find creep ' + creepName + ' in MaxCreeps memory last job change was in room ' + jobRoomName + ' creepType ' + creepType);
                return undefined;
            }
        }

        /**@return {int}*/
        function GenericJobAction(creep, roomJob, actionFunctions) {
            const jobObject = Game.getObjectById(roomJob.JobId);
            return GenericAction(creep, roomJob, actionFunctions, jobObject);
        }

        /**@return {int}*/
        function GenericFlagAction(creep, roomJob, actionFunctions) {
            const flagObj = Game.flags[roomJob.JobId];
            const nearbyHostileCreeps = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 7);
            if (nearbyHostileCreeps.length > 0) {
                const hostileActionResult = CreepHostileAction(creep, nearbyHostileCreeps, roomJob);
                if (hostileActionResult !== CREEP_IGNORED_HOSTILE) {
                    return OK;
                }
            }
            return GenericAction(creep, roomJob, actionFunctions, flagObj);
        }

        /**@return {int}*/
        function GenericAction(creep, roomJob, actionFunctions, targetObj) {
            let result = ERR_NO_RESULT_FOUND;
            if (!targetObj) {
                result = JOB_OBJ_DISAPPEARED;
            } else {
                let jobStatus = actionFunctions.JobStatus(targetObj);
                let didAct = false; // handle specific usecase where a creep has done an action and then immediately after that tries to do a similar action nearby when fetching

                if (jobStatus === SHOULD_ACT) { // act
                    result = actionFunctions.Act(targetObj);
                    if (result === ERR_NOT_IN_RANGE) {
                        if (creep.pos.x !== targetObj.pos.x || creep.pos.y !== targetObj.pos.y || creep.pos.roomName !== targetObj.pos.roomName) {
                            result = Move(creep, targetObj, 'transparent', '#fff', 'dotted');
                        } else {
                            result = OK;
                        }
                    } else if (result === OK) {
                        jobStatus = actionFunctions.IsJobDone(targetObj); // predict
                        didAct = true;
                    }
                }

                if (jobStatus === SHOULD_FETCH) { // fetch immediately after maybe a successful Act that is not done
                    let fetchObject; // get fetch object
                    if (creep.memory.FetchObjectId) {
                        fetchObject = Game.getObjectById(creep.memory.FetchObjectId);
                    }
                    if (!fetchObject) {
                        fetchObject = actionFunctions.FindFetchObject(targetObj);
                        if (!fetchObject) {
                            result = NO_FETCH_FOUND;
                        } else {
                            creep.memory.FetchObjectId = fetchObject.id;
                        }
                    }
                    if (result !== NO_FETCH_FOUND) {
                        if (!didAct) {
                            result = actionFunctions.Fetch(fetchObject, targetObj);
                            if (result === OK) {
                                creep.memory.FetchObjectId = undefined;
                            }
                        }
                        if (result === ERR_NOT_IN_RANGE) {
                            result = Move(creep, fetchObject, 'transparent', '#fff', 'undefined');
                        }
                    }
                } else if (jobStatus === JOB_IS_DONE) {
                    result = JOB_IS_DONE;
                }
            }

            if (result !== OK && result !== ERR_TIRED && result !== JOB_MOVING && result !== ERR_BUSY) { // job is ending
                creep.memory.FetchObjectId = undefined;
            }
            return result;
        }

        /**@return {object} @return {undefined}*/
        function FindFetchResource(creep, jobObject, resourceToFetch) {
            let energySupply = FindClosestResourceInRoom(creep, jobObject.room, resourceToFetch, jobObject);
            if (!energySupply && creep.pos.roomName !== jobObject.pos.roomName && creep.room.controller && creep.room.controller.my && creep.room.storage) {
                energySupply = creep.room.storage;
            }
            return energySupply;
        }

        /**@return {object}
         * @return {undefined}*/
        function FindClosestResourceInRoom(creep, room, resourceToFetch, jobObject) {
            let resourceSupply = undefined;
            if (creep.memory.ResourceSupply) {
                resourceSupply = Game.getObjectById(creep.memory.ResourceSupply);// closest link then container then droppedRes then storage
                // if the saved resourceSupply does not have any energy then remove it to make way for a new search
                if (!resourceSupply || !resourceSupply.store || !resourceSupply.store.getUsedCapacity(resourceToFetch)) {
                    resourceSupply = undefined;
                    creep.memory.ResourceSupply = undefined;
                } else if (resourceSupply && resourceSupply.structureType === STRUCTURE_STORAGE && creep.pos.roomName === jobObject.pos.roomName && creep.pos.getRangeTo(jobObject.pos) > 2) { // creep should have a chance at finding stores that are closer
                    creep.memory.ResourceSupply = undefined;
                }
            }
            if (!resourceSupply) { // creep memory had nothing stored
                let resourceSupplies = room.find(FIND_STRUCTURES, {
                    filter: function (s) {
                        return ((s.structureType === STRUCTURE_CONTAINER && (!creep.name.startsWith('T') || s.id !== Memory.MemRooms[room.name].CtrlConId)) // extra check to deny controller containers as an energy source if creep is a Transfer creep
                                || s.structureType === STRUCTURE_STORAGE
                                || s.structureType === STRUCTURE_LINK
                                || (jobObject.structureType !== STRUCTURE_TERMINAL && s.structureType === STRUCTURE_TERMINAL)
                            )
                            && (s.store.getUsedCapacity(resourceToFetch) >= 200 || resourceToFetch !== RESOURCE_ENERGY && s.store.getUsedCapacity(resourceToFetch) > 0);
                    }
                });
                resourceSupplies = resourceSupplies.concat(room.find(FIND_DROPPED_RESOURCES, {
                    filter: function (d) {
                        return d.resourceType === resourceToFetch && d.amount >= 50;
                    }
                }));
                resourceSupplies = resourceSupplies.concat(room.find(FIND_TOMBSTONES, {
                    filter: function (t) {
                        return t.store.getUsedCapacity(resourceToFetch) >= 30;
                    }
                }));
                resourceSupplies = resourceSupplies.concat(room.find(FIND_RUINS, {
                    filter: function (r) {
                        return r.store.getUsedCapacity(resourceToFetch) >= 30;
                    }
                }));
                //const closestSupply = jobObject.pos.findClosestByPath()
                let bestDistance = Number.MAX_SAFE_INTEGER;
                for (let i = 0; i < resourceSupplies.length; i++) {
                    let distance = Math.sqrt(Math.pow(resourceSupplies[i].pos.x - jobObject.pos.x, 2) + Math.pow(resourceSupplies[i].pos.y - jobObject.pos.y, 2));
                    if (resourceSupplies[i].structureType === STRUCTURE_TERMINAL) {
                        distance += 1000;
                    } else if (resourceSupplies[i].structureType === STRUCTURE_LINK) { // prefer links over other stores
                        distance -= 3;
                    } else if (!resourceSupplies[i].structureType) { // drop, tombstone or ruin is more important to pick up
                        distance -= 5;
                        if (resourceSupplies[i].store && resourceSupplies[i].store.getUsedCapacity(resourceToFetch) > 1000 || resourceSupplies[i].amount > 1000) {
                            distance -= 10; // try and favor stores and drops that has way more of the resource
                        }
                    }
                    if (resourceSupplies[i].store && resourceSupplies[i].store.getUsedCapacity(resourceToFetch) > 500 || resourceSupplies[i].amount > 500) {
                        distance -= 5; // try and favor stores that has more of the resource
                    }
                    if (distance < bestDistance) {
                        resourceSupply = resourceSupplies[i];
                        bestDistance = distance;
                    }
                }
                if (resourceSupply) {
                    creep.memory.ResourceSupply = resourceSupply.id;
                }
            }
            return resourceSupply;
        }

        function HandleCreepBoost(creep, jobObject, boostingMineral, bodyPartToBoost, ticksToLiveToBoost = 1300, ticksToLiveToUnBoost = 100) {
            if (!creep.memory.Boost || creep.memory.Boost[bodyPartToBoost] !== "-") { // only look once - after that it is too late
                if (creep.ticksToLive > ticksToLiveToBoost && (!creep.memory.Boost || creep.memory.Boost && !creep.memory.Boost[bodyPartToBoost])) {
                    const labThatCanBoost = FindLabThatCanBoost(creep, jobObject, boostingMineral, bodyPartToBoost);
                    if (labThatCanBoost) {
                        return labThatCanBoost;
                    } else {
                        if (!creep.memory.Boost) {
                            creep.memory.Boost = {};
                        }
                        creep.memory.Boost[bodyPartToBoost] = "-";
                    }
                } else if (creep.memory.Boost && creep.memory.Boost[bodyPartToBoost] && creep.ticksToLive < ticksToLiveToUnBoost) { // unboost the creep before the mineral is lost
                    const labThatCanUnBoost = FindLabThatCanUnBoost(jobObject);
                    if (labThatCanUnBoost) {
                        return labThatCanUnBoost;
                    }
                }
            }
        }

        /**@return {object}
         * @return {undefined}*/
        function FindLabThatCanBoost(creep, jobObject, mineral, bodyTypeToBoost) {
            if (!creep.memory.Boost || !creep.memory.Boost[bodyTypeToBoost]) {
                const activeBodyPartsToBoost = creep.getActiveBodyparts(bodyTypeToBoost);
                const labThatCanBoost = jobObject.room.find(FIND_MY_STRUCTURES, {
                    filter: function (lab) {
                        return lab.structureType === STRUCTURE_LAB && lab.store.getUsedCapacity(mineral) >= (activeBodyPartsToBoost * 30) && lab.store.getUsedCapacity(RESOURCE_ENERGY) >= (activeBodyPartsToBoost * 20);
                    }
                })[0];
                return labThatCanBoost;
            }
        }

        /**@return {object}
         * @return {undefined}*/
        function FindLabThatCanUnBoost(jobObject) {
            const labThatCanBoost = jobObject.room.find(FIND_MY_STRUCTURES, {
                filter: function (lab) {
                    return lab.structureType === STRUCTURE_LAB && lab.cooldown === 0;
                }
            })[0];
            return labThatCanBoost;
        }

        /**@return {number}*/
        function BoostCreep(creep, labThatCanBoost, mineral, bodyTypeToBoost) {
            let result = ERR_NO_RESULT_FOUND;
            if (!creep.memory.Boost || !creep.memory.Boost[bodyTypeToBoost]) {
                if (labThatCanBoost) {
                    result = labThatCanBoost.boostCreep(creep);
                    if (result === OK) {
                        Util.Info('ExecuteJobs', 'BoostCreep', creep.pos.roomName + ' ' + creep.name + ' body ' + bodyTypeToBoost + ' mineral ' + mineral);
                        if (!creep.memory.Boost) {
                            creep.memory.Boost = {};
                        }
                        creep.memory.Boost[bodyTypeToBoost] = mineral;
                    }
                }
            } else {
                result = OK;
            }
            return result;
        }

        /**@return {number}*/
        function UnBoostCreep(creep, labThatCanUnBoost, mineral, bodyTypeToUnBoost) {
            let result = ERR_NO_RESULT_FOUND;
            if (creep.memory.Boost && creep.memory.Boost[bodyTypeToUnBoost]) {
                if (labThatCanUnBoost) {
                    result = labThatCanUnBoost.unboostCreep(creep);
                    if (result === OK) {
                        if (creep.getActiveBodyparts(CARRY).length) {
                            creep.pickup(creep.pos.lookFor(LOOK_RESOURCES)[0]);
                        }
                        Util.Info('ExecuteJobs', 'UnBoostCreep', creep.pos.roomName + ' ' + creep.name + ' body ' + bodyTypeToUnBoost + ' mineral ' + mineral);
                        creep.memory.Boost[bodyTypeToUnBoost] = undefined;
                    }
                }
            } else {
                result = OK;
            }
            return result;
        }

        /**@return {int}*/
        function FetchResource(creep, fetchObject, resourceToFetch, max = -1/*withdraw to max carry capacity when -1 else withdraw until 'max' capacity is reached*/) {
            let result;
            if (fetchObject.amount) { // identified as dropped resource - pickup
                if (max === -1) {
                    result = creep.pickup(fetchObject);
                } else {
                    if (fetchObject.amount < max) {
                        result = creep.pickup(fetchObject, fetchObject.amount);
                    } else {
                        result = creep.pickup(fetchObject, max);
                    }
                }
            } else { // store withdraw
                // first try and see if it needs to get rid of unwanted resources
                if (creep.store.getUsedCapacity(resourceToFetch) !== creep.store.getUsedCapacity()) {
                    if (creep.pos.isNearTo(fetchObject.pos)) {
                        result = ERR_FULL; // throw this error to force the creep to transfer unwanted resource that it is carrying
                    } else {
                        result = ERR_NOT_IN_RANGE;
                    }
                } else if (max === -1) {
                    result = creep.withdraw(fetchObject, resourceToFetch);
                } else {
                    if (fetchObject.store.getUsedCapacity(resourceToFetch) < max) {
                        if (creep.store.getFreeCapacity() > fetchObject.store.getUsedCapacity(resourceToFetch)) {
                            result = creep.withdraw(fetchObject, resourceToFetch, fetchObject.store.getUsedCapacity(resourceToFetch));
                        } else {
                            result = creep.withdraw(fetchObject, resourceToFetch, creep.store.getFreeCapacity());
                        }
                    } else {
                        if (creep.store.getFreeCapacity() > max) {
                            result = creep.withdraw(fetchObject, resourceToFetch, max);
                        } else {
                            result = creep.withdraw(fetchObject, resourceToFetch, creep.store.getFreeCapacity());
                        }
                    }

                }
                if (result === OK && creep.store.getFreeCapacity() >= fetchObject.store.getUsedCapacity(resourceToFetch)) {
                    //Util.Info('ExecuteJobs', 'FetchResource', creep.name + ' creep freeCapacity ' + creep.store.getFreeCapacity() + ' fetchObject.store ' + fetchObject.store.getUsedCapacity(resourceToFetch));
                    creep.memory.ResourceSupply = undefined;
                }
            }
            if (result === ERR_FULL) { // creep store is full with anything other than resourceToFetch - get rid of it asap
                if (fetchObject.store && fetchObject.store.getFreeCapacity(resourceToFetch) && fetchObject.structureType !== STRUCTURE_LINK) {
                    for (const resourceType in creep.store) {
                        if (creep.store.getUsedCapacity(resourceType) && resourceType !== resourceToFetch) {
                            result = creep.transfer(fetchObject, resourceType);
                            break;
                        }
                    }
                } else { // DROP, TOMBSTONE or RUIN
                    for (const resourceType in creep.store) {
                        if (creep.store.getUsedCapacity(resourceType) && resourceType !== resourceToFetch) {
                            result = creep.drop(resourceType);
                            break;
                        }
                    }
                }
            }
            return result;
        }

        // creep wants to transfer all its stuff before returning OK - return BUSY if not done transferring all
        /**@return {number}*/
        function DepositCreepStore(creep, storeToFillObject, storeToEmptyObject = undefined, resourceTypeToKeep = undefined) {
            if (creep.pos.roomName !== storeToFillObject.pos.roomName || creep.pos.getRangeTo(storeToFillObject.pos) > 1) {
                return ERR_NOT_IN_RANGE;
            }
            let result = ERR_NO_RESULT_FOUND;
            let countResources = 0;
            let transferredAmount;
            for (const resourceType in creep.store) {
                if (creep.store.getUsedCapacity(resourceType) > 0 && resourceType !== resourceTypeToKeep) {
                    if (countResources === 0) {
                        transferredAmount = creep.store.getUsedCapacity(resourceType);
                        result = creep.transfer(storeToFillObject, resourceType);
                    }
                    countResources++;
                }
            }
            if (result === OK && countResources === 1 && !creep.name.startsWith('H')
                && (!storeToEmptyObject ||
                    ( // if there is a store to empty then look at how much the store has left and set JOB_IS_DONE if that store is empty
                        (storeToEmptyObject.structureType === STRUCTURE_CONTAINER || storeToEmptyObject.structureType === STRUCTURE_STORAGE) && storeToEmptyObject.store.getUsedCapacity(resourceTypeToKeep) < 500
                        || storeToEmptyObject.structureType === STRUCTURE_LINK && storeToEmptyObject.store.getUsedCapacity(resourceTypeToKeep) < 500
                        || storeToEmptyObject.structureType === STRUCTURE_TERMINAL && resourceTypeToKeep === RESOURCE_ENERGY && (storeToEmptyObject.store.getUsedCapacity(resourceTypeToKeep) <= 120000 && storeToEmptyObject.room.storage.store.getUsedCapacity(resourceTypeToKeep) >= 5000)
                    )
                )
            ) {
                result = JOB_IS_DONE;
            } else if (result === ERR_NOT_IN_RANGE || result === OK && countResources <= 1) {

            } else if (result === OK && countResources > 1) { // if there are more to be transferred then set creep to busy
                result = ERR_BUSY;
            } else {
                let errorMessage = 'unexpected result! ' + result + ' ' + creep.name + '(' + creep.pos.x + ',' + creep.pos.y + ',' + creep.pos.roomName + ',' + creep.hits + ',' + creep.hitsMax + ') carry ' + creep.store.getUsedCapacity() + ' storeToFill(' + storeToFillObject.pos.x + ',' + storeToFillObject.pos.y + ',' + storeToFillObject.pos.roomName + ')' + (storeToEmptyObject ? ' storeToEmptyObject ' + storeToEmptyObject + ' ' : ' ') + (resourceTypeToKeep ? ' resourceTypeToKeep ' + resourceTypeToKeep : '');
                if (result === ERR_FULL) {
                    Util.ErrorLog('ExecuteJobs', 'DepositCreepStore', errorMessage);
                } else {
                    if (!creep.getActiveBodyparts(CARRY)) {
                        Util.InfoLog('ExecuteJobs', 'DepositCreepStore', errorMessage + ' no CARRY');
                    } else {
                        Util.ErrorLog('ExecuteJobs', 'DepositCreepStore', errorMessage);
                    }
                }
            }
            return result;
        }

        function FindClosestFreeStore(creep, maxMoveRange = 0, resourceAmountToStore = 1/*filters stores that are not large enough*/, resourceTypeToStore = undefined/*if energy then take link*/) {
            let closestFreeStore = Game.getObjectById(creep.memory.ClosestFreeStoreId);
            if (closestFreeStore) {
                if (closestFreeStore.store.getFreeCapacity() < resourceAmountToStore || maxMoveRange > 0 && creep.pos.getRangeTo(closestFreeStore) > maxMoveRange) {
                    closestFreeStore = undefined;
                    creep.memory.ClosestFreeStoreId = undefined;
                }
            }
            if (!closestFreeStore) {
                if (maxMoveRange > 0) {
                    const closestFreeStores = creep.pos.findInRange(FIND_STRUCTURES, maxMoveRange, {
                        filter: function (s) {
                            return (s.structureType === STRUCTURE_CONTAINER
                                || s.structureType === STRUCTURE_STORAGE
                                || (resourceTypeToStore === RESOURCE_ENERGY && s.structureType === STRUCTURE_LINK))
                                && s.store.getFreeCapacity(resourceTypeToStore) >= resourceAmountToStore;
                        }
                    });
                    closestFreeStore = closestFreeStores[0];
                    if (closestFreeStore) {
                        let bestRange = closestFreeStore.pos.getRangeTo(creep.pos);
                        for (const closestFreeStoreKey in closestFreeStores) {
                            if (closestFreeStores[closestFreeStoreKey].id !== closestFreeStore.id) {
                                if (resourceTypeToStore === RESOURCE_ENERGY && closestFreeStores[closestFreeStoreKey].structureType === STRUCTURE_LINK) { // if the type to store is energy then try and prioritize links
                                    closestFreeStore = closestFreeStores[closestFreeStoreKey];
                                    break;
                                }
                                const range = closestFreeStores[closestFreeStoreKey].pos.getRangeTo(creep.pos);
                                if (range < bestRange) {
                                    closestFreeStore = closestFreeStores[closestFreeStoreKey];
                                    bestRange = range;
                                }
                            }
                        }
                    }
                } else {
                    closestFreeStore = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: function (s) {
                            return (s.structureType === STRUCTURE_CONTAINER
                                || s.structureType === STRUCTURE_STORAGE
                                || (resourceTypeToStore === RESOURCE_ENERGY && s.structureType === STRUCTURE_LINK))
                                && s.store.getFreeCapacity() >= resourceAmountToStore;
                        }
                    });
                }
                if (!closestFreeStore && maxMoveRange === 0) { // closestFreeStore still not found - look in nearest room for a storage that is free
                    Util.Info('ExecuteJobs', 'FindClosestFreeStore', 'not found, looking in other rooms for a storage');
                    let closestRoom;
                    let closestRoomRange = Number.MAX_SAFE_INTEGER;
                    for (const gameRoomKey in Game.rooms) {
                        const gameRoom = Game.rooms[gameRoomKey];
                        const distance = Game.map.getRoomLinearDistance(creep.pos.roomName, gameRoom.name);
                        if (gameRoom.controller && gameRoom.controller.my && gameRoom.storage && gameRoom.storage.store.getFreeCapacity() > 0
                            && closestRoomRange > distance) {
                            closestRoomRange = distance;
                            closestRoom = gameRoom;
                        }
                    }
                    if (closestRoom) {
                        closestFreeStore = closestRoom.storage;
                        creep.memory.ClosestFreeStoreId = closestFreeStore.id;
                        Util.Info('ExecuteJobs', 'FindClosestFreeStore', creep.name + ' in ' + creep.pos.roomName + ' found closest available storage in ' + closestFreeStore.pos.roomName);
                    }
                } else if (closestFreeStore) {
                    creep.memory.ClosestFreeStoreId = closestFreeStore.id;
                }
            }
            return closestFreeStore;
        }

        //endregion

        //region hostilities functions

        /**@return {number}*/
        function CreepHostileAction(creep, hostileCreeps, roomJob) {
            switch (roomJob.CreepType) {
                case 'G':
                    return GunnerHostileAction(creep, hostileCreeps);
                case 'W':
                    return WarriorHostileAction(creep, hostileCreeps);
                case 'H':
                    return HealerHostileAction(creep, hostileCreeps);
                default:
                    return CivilianHostileAction(creep, hostileCreeps);
            }
        }

        /**@return {number}*/
        function GunnerHostileAction(creep, hostileCreeps) {
            const hostileCreep = FindClosestHostileCreep(creep, hostileCreeps);

            if (hostileCreep) {
                creep.rangedAttack(hostileCreep);
                if (hostileCreep.getActiveBodyparts(ATTACK) && creep.pos.getRangeTo(hostileCreep) <= 2) {
                    Flee(creep, hostileCreeps);
                } else if (creep.pos.getRangeTo(hostileCreep) > 3) {
                    Move(creep, hostileCreep);
                }
                return CREEP_ATTACKED_HOSTILE;
            } else {
                return CREEP_IGNORED_HOSTILE;
            }
        }

        /**@return {number}*/
        function WarriorHostileAction(creep, hostileCreeps) {
            const hostileCreep = FindClosestHostileCreep(creep, hostileCreeps);

            if (hostileCreep) {
                creep.attack(hostileCreep);
                Move(creep, hostileCreep);
                return CREEP_ATTACKED_HOSTILE;
            } else {
                return CREEP_IGNORED_HOSTILE;
            }
        }

        function FindClosestHostileCreep(creep, hostileCreeps) {
            // ATTACK, RANGED_ATTACK
            let hostileCreep;
            const nearbyHostileCreepsWithAttack = _.filter(hostileCreeps, function (hostileCreep) {
                return hostileCreep.getActiveBodyparts(ATTACK)
                    || hostileCreep.getActiveBodyparts(RANGED_ATTACK);
            });
            if (nearbyHostileCreepsWithAttack.length > 0) {
                hostileCreep = creep.pos.findClosestByPath(nearbyHostileCreepsWithAttack);
            }

            // HEAL
            if (!hostileCreep) {
                const nearbyHostileCreepsWithHeal = _.filter(hostileCreeps, function (hostileCreep) {
                    return hostileCreep.getActiveBodyparts(HEAL);
                });
                if (nearbyHostileCreepsWithHeal.length > 0) {
                    hostileCreep = creep.pos.findClosestByPath(nearbyHostileCreepsWithHeal);
                }
            }

            // other
            if (!hostileCreep) {
                hostileCreep = creep.pos.findClosestByPath(hostileCreeps);
            }
            return hostileCreep;
        }

        /**@return {number}*/
        function HealerHostileAction(creep, hostileCreeps) {
            const closestDamagedCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 6, {
                filter: function (c) {
                    return c.hits < c.hitsMax;
                }
            });
            if (closestDamagedCreeps.length > 0) {
                const closestDamagedCreep = creep.pos.findClosestByPath(closestDamagedCreeps);
                let result = creep.heal(closestDamagedCreep);
                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.rangedHeal(closestDamagedCreep);
                    Move(creep, closestDamagedCreep);
                }
                if (result !== OK) {
                    creep.heal(creep);
                }
                return CREEP_ATTACKED_HOSTILE;
            }

            const nearbyHostileCreepsWithAttack = _.filter(hostileCreeps, function (hostileCreep) {
                return hostileCreep.getActiveBodyparts(ATTACK) && hostileCreep.pos.inRangeTo(creep, 2)
                    || hostileCreep.getActiveBodyparts(RANGED_ATTACK) && hostileCreep.pos.inRangeTo(creep, 3);
            });
            if (nearbyHostileCreepsWithAttack.length > 0) {
                Flee(creep, nearbyHostileCreepsWithAttack);
                creep.heal(creep);
                return CREEP_FLED_HOSTILE;
            }

            creep.heal(creep);
            return CREEP_IGNORED_HOSTILE;
        }

        /**@return {number}*/
        function CivilianHostileAction(creep, hostileCreeps) {
            const hostileCreepsWithAttack = _.filter(hostileCreeps, function (hostileCreep) {
                return hostileCreep.getActiveBodyparts(ATTACK) || hostileCreep.getActiveBodyparts(RANGED_ATTACK);
            });
            if (hostileCreepsWithAttack.length > 0) {
                Flee(creep, hostileCreepsWithAttack);
                return CREEP_FLED_HOSTILE;
            }
            return CREEP_IGNORED_HOSTILE;
        }

        function Flee(creep, hostiles) {
            let closestHostileCreep = hostiles[0];
            const closesHostileRange = Number.MAX_SAFE_INTEGER;
            for (const hostileCreepKey in hostiles) {
                const hostileCreep = hostiles[hostileCreepKey];
                if (hostileCreep && hostileCreep.pos && hostileCreep.pos.getRangeTo(creep.pos) < closesHostileRange) {
                    closestHostileCreep = hostileCreep;
                }
            }
            if (creep.getActiveBodyparts(HEAL) > 0) {
                creep.heal(creep);
            }
            if (creep.getActiveBodyparts(ATTACK) > 0) {
                creep.attack(closestHostileCreep);
            }
            if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
                creep.rangedAttack(closestHostileCreep);
            }
            const hostilePositions = [];
            for (const hostileKey in hostiles) {
                hostilePositions.push(hostiles[hostileKey].pos);
            }
            const fleePath = PathFinder.search(creep.pos, hostilePositions, {flee: true});
            let pos = fleePath.path[0];
            return creep.move(creep.pos.getDirectionTo(pos));
        }

        //endregion

        //region movement functions

        /**@return {int}*/
        function Move(creep, obj, fill = 'transparent', stroke = '#fff', lineStyle = 'dashed', strokeWidth = .15, opacity = .3) {
            let result = ERR_NO_RESULT_FOUND;
            let from = creep.pos;
            let to = obj.pos;
            if (from.roomName === to.roomName || creep.memory.onlyMoveTo) {
                const opts = {
                    //reusePath: 5, // default
                    //serializeMemory: true,  // default
                    //noPathFinding: false,  // default
                    visualizePathStyle: {
                        fill: fill,
                        stroke: stroke,
                        lineStyle: lineStyle,
                        strokeWidth: strokeWidth,
                        opacity: opacity
                    }
                };
                result = creep.moveTo(to, opts);
            } else { // not in the same room - make a map in mem
                if (creep.memory.ExitPosition && creep.memory.ExitPosition.roomName === creep.pos.roomName) { // movement between rooms should reuse path more
                    result = creep.moveByPath(creep.memory.CachedPath);
                    if (result !== OK && result !== ERR_TIRED) {
                        Util.Warning('ExecuteJobs', 'Move', 'using cached path failed ' + creep.name + ' ' + creep.pos.roomName + ' ' + result + " cached Path: " + JSON.stringify(creep.memory.CachedPath));
                        delete creep.memory.CachedPath;
                        delete creep.memory.ExitPosition;
                        result = ERR_NO_RESULT_FOUND;
                        creep.memory.onlyMoveTo = true; // if pathing fails then resort to exclusively using the more expensive moveTo function
                    }
                }
                if (result === ERR_NO_RESULT_FOUND) { // calculate path
                    const length = Util.GenerateOuterRoomPath(to.roomName, from.roomName); // saves result in Memory.Paths
                    if (length !== -1) {
                        getInnerRoomPath(to, creep);
                        result = creep.moveByPath(creep.memory.CachedPath);
                    }
                }
            }
            result = MoveAnalysis(to, from, creep, result, obj);
            return result;
        }

        function getInnerRoomPath(to, creep) {
            const nextRoom = Memory.Paths[to.roomName][creep.pos.roomName];
            const exitDirection = Game.map.findExit(creep.room, nextRoom);
            const exitPosition = creep.pos.findClosestByPath(exitDirection, {
                filter: function (pos) {
                    const wall = pos.lookFor(LOOK_STRUCTURES)[0];
                    return !wall;
                }
            });
            if (!exitPosition) {
                Util.ErrorLog('ExecuteJobs', 'getInnerRoomPath', 'exitPosition not found ' + creep.pos.roomName + ' exitDirection ' + exitDirection + ' nextRoom ' + nextRoom);
                return;
            }
            creep.memory.CachedPath = creep.room.findPath(creep.pos, exitPosition);
            creep.memory.ExitPosition = exitPosition;
        }

        /**@return {number}*/
        function MoveAnalysis(to, from, creep, result, obj) {
            // make an analysis of the move results
            if (result === OK) {
                result = JOB_MOVING;
            } else if (result !== ERR_BUSY && result !== ERR_TIRED) {
                if (creep.pos.x === 0) { // get away from room exits asap
                    result = TryMoveInDirection(creep, BOTTOM_RIGHT, RIGHT, TOP_RIGHT);
                } else if (creep.pos.x === 49) {
                    result = TryMoveInDirection(creep, BOTTOM_LEFT, LEFT, TOP_LEFT);
                } else if (creep.pos.y === 0) {
                    result = TryMoveInDirection(creep, BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT);
                } else if (creep.pos.y === 49) {
                    result = TryMoveInDirection(creep, TOP_LEFT, TOP, TOP_RIGHT);
                } else { // not on room edges
                    if (!creep.memory.MoveErrWait) { // maybe wait a couple of ticks to see if the obstacle has disappeared
                        creep.memory.MoveErrWait = 1;
                        creep.memory.MoveErrLastWait = Game.time;
                        result = JOB_MOVING;
                    } else if (creep.memory.MoveErrWait < 10) {
                        const ticksSinceWaitingStart = Game.time - creep.memory.MoveErrLastWait;
                        if (creep.memory.MoveErrLastWait && ticksSinceWaitingStart > 30) { // if the start of the wait time is more than 30 ticks away then reset it
                            Util.Info('ExecuteJobs', 'Move', 'move error reset time MoveErrWait ' + creep.memory.MoveErrWait + ' waited ' + ticksSinceWaitingStart + ' ticks ' + result + ' ' + creep.name + ' (' + from.x + ',' + from.y + ',' + from.roomName + ') to ' + obj + '(' + to.x + ',' + to.y + ',' + to.roomName + ')');
                            creep.memory.MoveErrLastWait = Game.time;
                            creep.memory.MoveErrWait = 0;
                        }
                        creep.memory.MoveErrWait++;
                        result = JOB_MOVING;
                    } else {
                        if (from.roomName === to.roomName) {
                            Util.Warning('ExecuteJobs', 'Move', 'move error MoveErrWait ' + creep.memory.MoveErrWait + ' ' + result + ' ' + creep.name + ' (' + from.x + ',' + from.y + ',' + from.roomName + ') to ' + obj + '(' + to.x + ',' + to.y + ',' + to.roomName + ') ending move!');
                        } else {
                            Util.Warning('ExecuteJobs', 'Move', 'move error multiple room MoveErrWait ' + creep.memory.MoveErrWait + ' ' + result + ' ' + creep.name + ' (' + from.x + ',' + from.y + ',' + from.roomName + ') to ' + obj + '(' + to.x + ',' + to.y + ',' + to.roomName + ') ending move!');
                        }
                        if (result === ERR_NO_BODYPART) { // no MOVE bodypart
                            Util.InfoLog('ExecuteJobs', 'Move', creep.name + ' ERR_NO_BODYPART ' + creep.pos.roomName + ' committing suicide');
                            creep.suicide();
                        }
                        if (result === ERR_INVALID_TARGET) {
                            Util.ErrorLog('ExecuteJobs', 'Move', creep.name + ' ERR_INVALID_TARGET when moving ' + creep.pos.roomName);
                        }
                        creep.memory.MoveErrWait = undefined;
                        result = JOB_IS_DONE;
                    }
                }
            }
            return result;
        }

        function TryMoveInDirection(creep, option1, option2, option3) {
            let result = creep.move(option2);
            if (result !== OK) {
                result = creep.move(option1);
                if (result !== OK) {
                    result = creep.move(option3);
                }
            }
            if (result === OK) {
                result = JOB_MOVING;
            }
            return result;
        }

        //endregion
    }
};
module.exports = ExecuteJobs;