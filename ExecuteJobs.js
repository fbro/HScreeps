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

        ExecuteRoomJobs();

        function ExecuteRoomJobs() {
            for (const creepName in Memory.creeps) {
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
                const roomName = creepMemory.JobName.split(')').pop();
                let result;
                if (!creepMemory.JobName.startsWith('idle') && Memory.MemRooms[roomName]) { // creep is not idle
                    const job = Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];
                    if (!job && gameCreep) { // job is outdated and removed from Memory and creep is still alive
                        creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                    } else if (job && !gameCreep) { // job exists and creep is dead
                        if (Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName]) {
                            Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName] = undefined;
                        } else {
                            Util.ErrorLog('ExecuteJobs', 'ExecuteRoomJobs', 'creep dead delete job failed ' + gameCreep.name + ' ' + roomName + ' ' + creepMemory.JobName + ' gameCreep.pos.roomName ' + gameCreep.pos.roomName);
                        }
                        const didRemoveMaxCreeps = FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    } else if (job && gameCreep) { // creep is alive and its job is found
                        if (!gameCreep.spawning) {
                            result = JobAction(gameCreep, job);
                            if (result === JOB_IS_DONE) {
                                if (Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName]) {
                                    Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName] = undefined;
                                } else {
                                    Util.ErrorLog('ExecuteJobs', 'ExecuteRoomJobs', 'job done delete failed ' + gameCreep.name + ' ' + roomName + ' ' + creepMemory.JobName + ' gameCreep.pos.roomName ' + gameCreep.pos.roomName);
                                }
                                let assignedToNewJob = false;
                                for(const roomJobKey in Memory.MemRooms[roomName].RoomJobs){
                                    let roomJob = Memory.MemRooms[roomName].RoomJobs[roomJobKey];
                                    if (roomJob && roomJob.Creep === 'vacant' && creepName.startsWith(roomJob.CreepType)){
                                        assignedToNewJob = true;
                                        for(const memoryElementKey in creepMemory){
                                            if(memoryElementKey !== 'JobName'){
                                                creepMemory[memoryElementKey] = undefined;
                                            }
                                        }
                                        creepMemory.JobName = roomJobKey;
                                        roomJob.Creep = creepName;
                                        break;
                                    }
                                }
                                if(!assignedToNewJob){
                                    creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                                }
                                if(creepMemory.JobName === undefined){
                                    Util.ErrorLog('ExecuteJobs', ' ExecuteRoomJobs', 'creep job is undefined! ' + creepName + ' ' + gameCreep.pos.roomName);
                                }
                            }
                        }
                    } else { // both job and creep is gone
                        Util.Info('ExecuteJobs', 'ExecuteRoomJobs', creepName + ' on ' + creepMemory.JobName + ' in ' + roomName + ' has died and the job has disappeared');
                        Util.InfoLog('ExecuteJobs', 'ExecuteRoomJobs', 'both creep and job gone ' + creepName + ' on ' + creepMemory.JobName + ' in ' + roomName);
                        const didRemoveMaxCreeps = FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    }
                }
                if (creepMemory.JobName.startsWith('idle')) { // idle creep
                    if (!gameCreep) { // idle creep is dead
                        const didRemoveMaxCreeps = FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    } else { // idle creep is alive
                        // if idle creep is carrying something - move it to storage
                        if (gameCreep.room.storage && gameCreep.room.storage.store.getUsedCapacity() < gameCreep.room.storage.store.getCapacity() && gameCreep.store.getUsedCapacity() > 0) {
                            result = DepositCreepStore(gameCreep, gameCreep.room.storage);
                            if (result === ERR_NOT_IN_RANGE) {
                                result = Move(gameCreep, gameCreep.room.storage);
                            }
                            gameCreep.say('idle 📦' + result);
                        } else if (!gameCreep.room.controller || !gameCreep.room.controller.my || gameCreep.memory.MoveHome) { // I do not own the room the idle creep is in - move it to an owned room!
                            let closestOwnedRoom;
                            if (!gameCreep.memory.MoveHome) {
                                let bestDistance = Number.MAX_SAFE_INTEGER;
                                for (const memRoomKey in Memory.MemRooms) { // search for best storage
                                    if (Game.rooms[memRoomKey] && Game.rooms[memRoomKey].controller && Game.rooms[memRoomKey].controller.my) { // exist and has room
                                        const distance = Game.map.getRoomLinearDistance(gameCreep.pos.roomName, memRoomKey);
                                        if (distance < bestDistance) {
                                            closestOwnedRoom = memRoomKey;
                                            bestDistance = distance;
                                        }
                                    }
                                }
                                gameCreep.memory.MoveHome = closestOwnedRoom;
                                Util.Info('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + creepName + ' in ' + gameCreep.pos.roomName + ' moving to ' + closestOwnedRoom);
                            } else {
                                closestOwnedRoom = gameCreep.memory.MoveHome;
                            }

                            if (closestOwnedRoom && (closestOwnedRoom !== gameCreep.pos.roomName || gameCreep.pos.getRangeTo(Game.rooms[closestOwnedRoom].controller) > 4)) {
                                Move(gameCreep, Game.rooms[closestOwnedRoom].controller);
                                gameCreep.say('🏠🏃');
                            } else {
                                gameCreep.memory.MoveHome = undefined;
                                gameCreep.say('🏠🏃✔');
                            }
                        } else if (gameCreep.getActiveBodyparts(ATTACK)) { // idle creep can attack
                            const hostileCreeps = gameCreep.room.find(FIND_HOSTILE_CREEPS);
                            if (hostileCreeps[0]) {
                                const hostileCreep = hostileCreeps[0];
                                Util.Info('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + gameCreep.name + ' found ' + hostileCreeps.length + ' hostile creeps! targeting ' + hostileCreep + ' attack');
                                gameCreep.say('ATK ' + hostileCreep);
                                result = gameCreep.attack(hostileCreep);
                                if (result === ERR_NOT_IN_RANGE) {
                                    result = Move(gameCreep, hostileCreep);
                                }
                            }
                        } else if (gameCreep.getActiveBodyparts(RANGED_ATTACK)) { // idle creep can ranged attack
                            const hostileCreeps = gameCreep.room.find(FIND_HOSTILE_CREEPS);
                            if (hostileCreeps[0]) {
                                const hostileCreep = hostileCreeps[0];
                                Util.Info('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + gameCreep.name + ' found ' + hostileCreeps.length + ' hostile creeps! targeting ' + hostileCreep + ' ranged attack');
                                gameCreep.say('RATK ' + hostileCreep);
                                result = gameCreep.rangedAttack(hostileCreep);
                                if (result === ERR_NOT_IN_RANGE) {
                                    result = Move(gameCreep, hostileCreep);
                                }
                            }
                        } else if (gameCreep.getActiveBodyparts(RANGED_ATTACK)) { // idle creep can heal
                            const damagedCreeps = gameCreep.room.find(FIND_MY_CREEPS, {
                                filter: (creep) => {
                                    return creep.hits < creep.hitsMax;
                                }
                            });
                            if (damagedCreeps[0]) {
                                const damagedCreep = damagedCreeps[0];
                                Util.Info('ExecuteJobs', 'ExecuteRoomJobs', 'idle ' + gameCreep.name + ' found ' + damagedCreeps.length + ' damaged creeps! targeting ' + damagedCreep + ' heal');
                                gameCreep.say('HEAL ' + damagedCreep);
                                result = gameCreep.heal(damagedCreep);
                                if (result === ERR_NOT_IN_RANGE) {
                                    result = Move(gameCreep, damagedCreep);
                                }
                            }
                        }
                    }
                }

                // creep actions that should always be fired no matter what the creep is doing
                if (result !== OK  && gameCreep) {
                    if (gameCreep.store[RESOURCE_ENERGY] > 0) { // fill adjacent spawns, extensions and towers or repair or construct on the road
                        const toFill = gameCreep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                            filter: (structure) => {
                                return (structure.structureType === STRUCTURE_SPAWN
                                    || structure.structureType === STRUCTURE_EXTENSION
                                    || structure.structureType === STRUCTURE_TOWER) && structure.store[RESOURCE_ENERGY] < structure.store.getCapacity(RESOURCE_ENERGY);
                            }
                        })[0];
                        if (toFill) { // fill adjacent spawns, extensions
                            gameCreep.transfer(toFill, RESOURCE_ENERGY); // it may do that 'double' but it really does not matter
                            //Util.Info('ExecuteJobs', 'ExecuteRoomJobs', creep.name + ' transferred energy to adjacent spawn tower or extension (' + toFill.pos.x + ',' + toFill.pos.y + ',' + toFill.pos.roomName + ')');
                        } else if (gameCreep.name.startsWith('H') || gameCreep.name.startsWith('B') || gameCreep.name.startsWith('D')) { // repair on the road
                            const toRepair = gameCreep.pos.findInRange(FIND_STRUCTURES, 2, {
                                filter: (structure) => {
                                    return (structure.structureType !== STRUCTURE_WALL
                                        && structure.structureType !== STRUCTURE_RAMPART) && structure.hits < structure.hitsMax;
                                }
                            })[0];
                            if (toRepair) { // repair on the road
                                gameCreep.repair(toRepair);
                                //Util.Info('ExecuteJobs', 'ExecuteRoomJobs', creep.name + ' repaired ' + toRepair.structureType + ' (' + toRepair.pos.x + ',' + toRepair.pos.y + ',' + toRepair.pos.roomName + ',' + toRepair.hits + ',' + toRepair.hitsMax + ')');
                            } else {
                                const toBuild = gameCreep.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0];
                                if (toBuild) { // construct on the road
                                    gameCreep.build(toBuild);
                                }
                            }
                        }
                    } else if (gameCreep.store.getUsedCapacity() < gameCreep.store.getCapacity()) { // pickup adjacent resources
                        const drop = gameCreep.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
                        if (drop) {
                            gameCreep.pickup(drop); // it may do that 'double' but it really does not matter
                            //Util.Info('ExecuteJobs', 'ExecuteRoomJobs', creep.name + ' picked up adjacent resource (' + drop.pos.x + ',' + drop.pos.y + ',' + drop.pos.roomName + ',' + drop.amount + ',' + drop.resourceType + ')');
                        } else {
                            const tombstone = gameCreep.pos.findInRange(FIND_TOMBSTONES, 1, {
                                filter: (t) => {
                                    return t.store.getUsedCapacity() > 0;
                                }
                            })[0];
                            if (tombstone) {
                                for (const resourceType in gameCreep.store) {
                                    gameCreep.withdraw(drop, resourceType);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        /**@return {number}*/
        function JobAction(creep, roomJob) {
            const jobKey = creep.memory.JobName;
            let result = ERR_NO_RESULT_FOUND;
            switch (true) {
                // obj jobs
                case jobKey.startsWith('1Src') || jobKey.startsWith('5Src'):
                    result = JobSource(creep, roomJob);
                    break;
                case jobKey.startsWith('0Ctrl') || jobKey.startsWith('8Ctrl') || jobKey.startsWith('9Ctrl'):
                    result = JobController(creep, roomJob);
                    break;
                case jobKey.startsWith('2FillCtrlCon'):
                    result = JobFillControllerContainer(creep, roomJob);
                    break;
                case jobKey.startsWith('3Rep'):
                    result = JobRepair(creep, roomJob);
                    break;
                case jobKey.startsWith('2Constr'):
                    result = JobConstruction(creep, roomJob);
                    break;
                case jobKey.startsWith('0FillSpwnEx'):
                    result = JobFillSpawnExtension(creep, roomJob);
                    break;
                case jobKey.startsWith('2FillTwr'):
                    result = JobFillTower(creep, roomJob);
                    break;
                case jobKey.startsWith('3FillStrg') || jobKey.startsWith('4FillStrg') || jobKey.startsWith('5FillStrg'):
                    result = JobFillStorage(creep, roomJob);
                    break;
                case jobKey.startsWith('5ExtrMin'):
                    result = JobExtractMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('5FillTerm'):
                    result = JobFillTerminal(creep, roomJob);
                    break;
                case jobKey.startsWith('5FillFctr'):
                    result = JobFillFactory(creep, roomJob);
                    break;
                case jobKey.startsWith('3FillLabE'):
                    result = JobFillLabEnergy(creep, roomJob);
                    break;
                case jobKey.startsWith('3FillPSpwnE'):
                    result = JobFillPowerSpawnEnergy(creep, roomJob);
                    break;
                case jobKey.startsWith('3FillPSpwnP'):
                    result = JobFillPowerSpawnPower(creep, roomJob);
                    break;

                // flag jobs
                case jobKey.startsWith('4TagCtrl'):
                    result = JobTagController(creep, roomJob);
                    break;
                case jobKey.startsWith('5ScoutPos'):
                    result = JobScoutPosition(creep, roomJob);
                    break;
                case jobKey.startsWith('1ClaimCtrl'):
                    result = JobClaimController(creep, roomJob);
                    break;
                case jobKey.startsWith('4ReserveCtrl'):
                    result = JobReserveController(creep, roomJob);
                    break;
                case jobKey.startsWith('2ClaimPos'):
                    result = JobClaimerPosition(creep, roomJob);
                    break;
                case jobKey.startsWith('2GuardPos'):
                    result = JobGuardPosition(creep, roomJob);
                    break;
                case jobKey.startsWith('2GuardGunPos'):
                    result = JobGuardGunnerPosition(creep, roomJob);
                    break;
                case jobKey.startsWith('2GuardMedPos'):
                    result = JobGuardMedicPosition(creep, roomJob);
                    break;
                case jobKey.startsWith('2HarvestPos'):
                    result = JobHarvesterPosition(creep, roomJob);
                    break;
                case jobKey.startsWith('2TransPos'):
                    result = JobTransporterPosition(creep, roomJob);
                    break;
                case jobKey.startsWith('2BuildPos'):
                    result = JobBuilderPosition(creep, roomJob);
                    break;
                case jobKey.startsWith('6FillLabMin'):
                    result = JobFillLabMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('5EmptyLabMin'):
                    result = JobEmptyLabMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('3AtkP'):
                    result = JobAttackPowerBank(creep, roomJob);
                    break;
                case jobKey.startsWith('3MedP'):
                    result = JobMedicPowerBank(creep, roomJob);
                    break;
                case jobKey.startsWith('1TrnsprtP'):
                    result = JobTransportPowerBank(creep, roomJob);
                    break;
                case jobKey.startsWith('5HrvstDpst'):
                    result = JobHarvestDeposit(creep, roomJob);
                    break;
                default:
                    Util.ErrorLog('ExecuteJobs', 'JobAction', 'job not found ' + jobKey + ' ' + creep.name);
            }
            if (result === OK) {
                // job is done everyone is happy, nothing to do.
            } else if (result === ERR_TIRED) {
                creep.say('😫 ' + creep.fatigue); // creep has fatigue and is limited in movement
            } else if (result === ERR_BUSY) {
                // The creep might is still being spawned
            } else if (result === JOB_MOVING) {
                creep.say('🏃'); // The creep is just moving to its target
            } else { // results where anything else than OK - one should end the job!
                if (result === ERR_NO_RESULT_FOUND) {
                    Util.ErrorLog('ExecuteJobs', 'JobAction', 'ERR_NO_RESULT_FOUND ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠' + result);
                } else if (result === ERR_INVALID_TARGET || result === ERR_INVALID_ARGS) {
                    Util.ErrorLog('ExecuteJobs', 'JobAction', 'error invalid ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠' + result);
                } else if (result === JOB_OBJ_DISAPPEARED) {
                    creep.say('🙈' + result);
                } else if (result === NO_FETCH_FOUND) {
                    Util.Warning('ExecuteJobs', 'JobAction', 'no fetch object found ' + result + ' ' + jobKey + ' ' + roomJob.Creep); // most likely no energy to withdraw
                    creep.say('⚠⚡' + result);
                } else {
                    if (!result) {
                        Util.Info('ExecuteJobs', 'JobAction', 'removing ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                        Util.ErrorLog('ExecuteJobs', 'JobAction', 'undefined result ' + creep.name + ' ' + jobKey);
                    }
                    if(result === JOB_IS_DONE){
                        creep.say('✔');
                    }else{
                        creep.say('✔' + result);
                    }

                }
                result = JOB_IS_DONE;
            }
            return result;
        }

        // obj jobs:

        /**@return {int}*/
        function JobSource(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
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
                    if (result === ERR_NOT_ENOUGH_RESOURCES) {
                        //Util.Info('ExecuteJobs', 'JobSource', creep.name + ' waiting for replenish (' + jobObject.pos.x + ',' + jobObject.pos.y + ',' + jobObject.pos.roomName + ')');
                        result = OK;
                    }
                    return result;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store.getFreeCapacity() <= creep.getActiveBodyparts(WORK)) { // predict that creep will be full and make a transfer that wont stop the harvesting flow
                        let fetchObject = Game.getObjectById(creep.memory.ClosestFreeStoreId);
                        if (fetchObject) {
                            const result = creep.transfer(fetchObject, RESOURCE_ENERGY);
                            if(result === OK){
                                creep.memory.FetchObjectId = undefined;
                            }
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
                    if(isOnlyEnergy){
                        fetchObject = FindClosestFreeStore(creep, 2, creep.store[RESOURCE_ENERGY], RESOURCE_ENERGY);
                    }else{
                        fetchObject = FindClosestFreeStore(creep, 2);
                    }
                    if (jobObject.room.controller.level < 3) {
                        const spawnConstruction = jobObject.room.find(FIND_MY_CONSTRUCTION_SITES, { // if there is a spawn that should be built - then built it
                            filter: function (c) {
                                return c.structureType === STRUCTURE_SPAWN;
                            }
                        })[0];
                        if(spawnConstruction){
                            fetchObject = spawnConstruction;
                        }
                    }else if (!fetchObject) { // nothing can be found then drop
                        fetchObject = 'DROP';
                    }else if(!creep.memory.LinkId && fetchObject.structureType === STRUCTURE_LINK && creep.pos.getRangeTo(fetchObject.pos) < 2){ // if fetchObject is link then save in memory
                        creep.memory.LinkId = fetchObject.id
                    }else if(creep.memory.LinkId && fetchObject.structureType !== STRUCTURE_LINK){ // if fetchObject is not link and a link is saved in memory then take that instead
                        const link = Game.getObjectById(creep.memory.LinkId);
                        if(link && link.store.getFreeCapacity() > 200 && isOnlyEnergy){
                            fetchObject = link;
                            creep.memory.ClosestFreeStoreId = fetchObject;
                        }
                    }
                    return fetchObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = ERR_NO_RESULT_FOUND;
                    if (fetchObject.structureType === STRUCTURE_SPAWN) {
                        Util.Info('ExecuteJobs', 'JobSource', creep.name + ' build ' + fetchObject);
                        result = creep.build(fetchObject);
                        if (result === OK) {
                            result = ERR_BUSY;
                        } else if (result != ERR_NOT_IN_RANGE) {
                            result = OK;
                        }
                    } else if (fetchObject !== 'DROP') {
                        const toRepair = creep.pos.findInRange(FIND_STRUCTURES, 2, {
                            filter: (structure) => {
                                return (structure.structureType !== STRUCTURE_WALL
                                    && structure.structureType !== STRUCTURE_RAMPART) && structure.hits < structure.hitsMax;
                            }
                        })[0];
                        if (toRepair) { // repair on the road
                            result = creep.repair(toRepair);
                            let amountToTransfer = creep.store[RESOURCE_ENERGY] - creep.getActiveBodyparts(WORK);
                            if(result !== OK || amountToTransfer <= 0){
                                amountToTransfer = undefined;
                            }
                            result = creep.transfer(fetchObject, RESOURCE_ENERGY, amountToTransfer);
                        } else if(creep.store.getUsedCapacity() === 0) {
                            Util.InfoLog('ExecuteJobs', 'JobSource', creep.name + ' nothing to store! ' + creep.store.getUsedCapacity());
                            result = OK;
                        }else{
                            result = DepositCreepStore(creep, fetchObject);
                        }
                    } else {
                        for (const resourceType in creep.store) {
                            if (creep.store[resourceType] > 0) {
                                result = creep.drop(resourceType);
                                break;
                            }
                        }
                    }
                    return result;
                },
            });
            if (result !== OK && result !== JOB_MOVING && result !== ERR_TIRED && result !== ERR_BUSY) {
                Util.Warning('ExecuteJobs', 'JobSource', 'harvester result is not OK ' + result + ' ' + creep.name + '(' + creep.pos.x + ',' + creep.pos.y + ',' + creep.pos.roomName + ')');
            }
            return result;
        }

        /**@return {int}*/
        function JobController(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (creep.store[RESOURCE_ENERGY] === 0) { // fetch
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
        function JobFillControllerContainer(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store.getFreeCapacity() === 0) {
                        return JOB_IS_DONE;
                    } else if (creep.store[RESOURCE_ENERGY] === 0) { // fetch
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
                    if (creep.store[RESOURCE_ENERGY] + jobObject.store[RESOURCE_ENERGY] >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
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
                    } else if (creep.store[RESOURCE_ENERGY] === 0) { // fetch
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
                    if ((jobObject.hits + (creep.getActiveBodyparts(WORK) * 100)) >= jobObject.hitsMax) {
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
                    if (creep.store[RESOURCE_ENERGY] === 0) { // fetch
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
                    if ((jobObject.progress + creep.getActiveBodyparts(WORK)) >= jobObject.progressTotal) {
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
        function JobFillSpawnExtension(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store[RESOURCE_ENERGY] === jobObject.store.getCapacity(RESOURCE_ENERGY)) { // is job done?
                        return JOB_IS_DONE;
                    } else if (creep.store[RESOURCE_ENERGY] === 0) { // fetch
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
                    if ((jobObject.store[RESOURCE_ENERGY] + creep.store[RESOURCE_ENERGY]) >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
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
                    if (jobObject.store[RESOURCE_ENERGY] === jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else if (creep.store[RESOURCE_ENERGY] === 0) { // fetch
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
                    if (jobObject.store[RESOURCE_ENERGY] + creep.store[RESOURCE_ENERGY] >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
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
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    let creepSum = creep.store.getUsedCapacity();
                    if (!jobObject && creepSum === 0) { // if the target is a dropped resource it may just disappear because it was picked up
                        return JOB_IS_DONE;
                    } else if (jobObject && (creepSum === 0 || !creep.memory.Depositing && creepSum < creep.store.getCapacity() && creep.pos.getRangeTo(jobObject) <= 1
                        && (jobObject.resourceType || (jobObject.store.getUsedCapacity() > 0
                            || jobObject.structureType === STRUCTURE_TERMINAL && (jobObject.store[RESOURCE_ENERGY] > 120000 || jobObject.room.storage.store[RESOURCE_ENERGY] < 5000 && jobObject.store[RESOURCE_ENERGY] > 0))))
                    ) {
                        creep.memory.Depositing = undefined;
                        return SHOULD_ACT; // get resources from target
                    } else {
                        creep.memory.Depositing = true;
                        return SHOULD_FETCH; // place in storage
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if (jobObject.structure/*ruin*/ || jobObject.structureType === STRUCTURE_CONTAINER || jobObject.creep/*tombstone*/) {
                        for (const resourceType in jobObject.store) {
                            if (jobObject.store[resourceType] > 0) {
                                return creep.withdraw(jobObject, resourceType);
                            }
                        }
                        return ERR_NOT_ENOUGH_RESOURCES;
                    } else if(jobObject.structureType === STRUCTURE_FACTORY){
                        let resourceType = creep.memory.resourceType;
                        if (!resourceType) {
                            resourceType = creep.memory.JobName.split(/[(,)]+/).filter(function (e) {
                                return e;
                            })[3];
                            creep.memory.resourceType = resourceType;
                        }
                        if (resourceType && jobObject.store[resourceType] > 500) {
                            let amountToWithdraw = jobObject.store[resourceType] - 500;
                            if(amountToWithdraw > creep.store.getFreeCapacity()){
                                amountToWithdraw = creep.store.getFreeCapacity();
                            }
                            return creep.withdraw(jobObject, resourceType, amountToWithdraw);
                        }else{
                            return JOB_IS_DONE;
                        }
                    }else if (jobObject.structureType === STRUCTURE_LINK || jobObject.structureType === STRUCTURE_TERMINAL) {
                        return creep.withdraw(jobObject, RESOURCE_ENERGY);
                    } else if (jobObject.resourceType) { // drop
                        return creep.pickup(jobObject);
                    } else {
                        return ERR_NO_RESULT_FOUND;
                    }
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
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
                Fetch: function (fetchObject, jobObject) {
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
                    if(!fetchObject){
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
            let Low = Util.TERMINAL_STORAGE_LOW;
            let LowTransfer = Util.TERMINAL_STORAGE_LOW_TRANSFER;
            let Medium = Util.TERMINAL_STORAGE_MEDIUM;
            let MediumTransfer = Util.TERMINAL_STORAGE_MEDIUM_TRANSFER;
            let High = Util.TERMINAL_STORAGE_HIGH;
            let HighTransfer = Util.TERMINAL_STORAGE_HIGH_TRANSFER;
            if(resourceType === RESOURCE_ENERGY){
                Low = Util.TERMINAL_STORAGE_ENERGY_LOW;
                LowTransfer = Util.TERMINAL_STORAGE_ENERGY_LOW_TRANSFER;
                Medium = Util.TERMINAL_STORAGE_ENERGY_MEDIUM;
                MediumTransfer = Util.TERMINAL_STORAGE_ENERGY_MEDIUM_TRANSFER;
                High = Util.TERMINAL_STORAGE_ENERGY_HIGH;
                HighTransfer = Util.TERMINAL_STORAGE_ENERGY_HIGH_TRANSFER;
            }
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (terminal) {
                    const storage = terminal.room.storage;
                    if ( !storage ||
                        storage.store[resourceType] <= Low // low resource in storage abort

                        || storage.store[resourceType] <=  Medium
                        && terminal.store[resourceType] >= LowTransfer

                        || storage.store[resourceType] <=  High
                        && terminal.store[resourceType] >= MediumTransfer

                        || storage.store[resourceType] >= High
                        && terminal.store[resourceType] >= HighTransfer
                    ) {
                        return JOB_IS_DONE;
                    } else if (creep.store[resourceType] === 0) { // fetch
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
                IsJobDone: function (terminal) {
                    const storage = terminal.room.storage;
                    const newAmountInTerminal = creep.store[resourceType] + terminal.store[resourceType];
                    if (
                        storage.store[resourceType] <= Low // low resource in storage abort

                        || storage.store[resourceType] <=  Medium
                        && newAmountInTerminal >= LowTransfer

                        || storage.store[resourceType] <=  High
                        && newAmountInTerminal >= MediumTransfer

                        || storage.store[resourceType] >= High
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
                    } else if (creep.room.storage && creep.room.storage.store[resourceType] > 0) {
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
                JobStatus: function (jobObject) { // terminal
                    if (resourceType === RESOURCE_ENERGY && jobObject.store[RESOURCE_ENERGY] >= 10000
                        || resourceType !== RESOURCE_ENERGY && jobObject.store[resourceType] >= 2000
                    ) {
                        return JOB_IS_DONE;
                    } else if (creep.store[resourceType] === 0) { // fetch
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
                    if (resourceType === RESOURCE_ENERGY && (creep.store[resourceType] + jobObject.store[resourceType]) >= 10000
                        || resourceType !== RESOURCE_ENERGY && (creep.store[resourceType] + jobObject.store[resourceType]) >= 2000) {
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
                    } else if (creep.room.storage && creep.room.storage.store[resourceType] > 0) {
                        return creep.room.storage;
                    } else if (creep.room.terminal && creep.room.terminal.store[resourceType] > 0) {
                        return creep.room.terminal;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let max = -1;
                    if(resourceType === RESOURCE_ENERGY){
                        max = 10000;
                    }else{
                        max = 2000;
                    }
                    return FetchResource(creep, fetchObject, resourceType, max - jobObject.store[resourceType]);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillLabEnergy(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store[RESOURCE_ENERGY] === jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else if (creep.store[RESOURCE_ENERGY] === 0) { // fetch
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
                    if (creep.store[RESOURCE_ENERGY] + jobObject.store[RESOURCE_ENERGY] >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
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
                    if (jobObject.store[RESOURCE_ENERGY] === jobObject.store.getCapacity(RESOURCE_ENERGY)) {
                        return JOB_IS_DONE;
                    } else if (creep.store[RESOURCE_ENERGY] === 0) { // fetch
                        return SHOULD_FETCH;
                    } else { // action not done yet
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    let result = creep.transfer(jobObject, RESOURCE_ENERGY);
                    if (result === OK && jobObject.store[RESOURCE_ENERGY] > 4000) {
                        return JOB_IS_DONE;
                    }
                    return result;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store[RESOURCE_ENERGY] + jobObject.store[RESOURCE_ENERGY] >= jobObject.store.getCapacity(RESOURCE_ENERGY)) {
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
                    } else if (creep.store[RESOURCE_POWER] === 0) { // fetch
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
                    if (creep.store[RESOURCE_POWER] + jobObject.store[RESOURCE_POWER] >= jobObject.store.getCapacity(RESOURCE_POWER)) {
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

        // flag jobs:

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
        function JobScoutPosition(creep, roomJob) {
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
                    return jobObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (creep.pos.isNearTo(jobObject)) {
                        creep.say(jobObject.name);
                        return OK;
                    } else {
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobClaimController(creep, roomJob) {
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
                    let result = creep.claimController(fetchObject);
                    if (result === OK) {
                        Util.InfoLog('ExecuteJobs', 'JobClaimController', 'done ' + creep.name + ' in ' + jobObject.pos.roomName + ' tag ' + jobObject.name);
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
                    return creep.reserveController(fetchObject);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobClaimerPosition(creep, roomJob) {
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
                    return jobObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (creep.pos.x === jobObject.pos.x && creep.pos.y === jobObject.pos.y && creep.pos.roomName === jobObject.pos.roomName) {
                        creep.say(jobObject.name);
                        return OK;
                    } else {
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobGuardPosition(creep, roomJob) {
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
                    if (hostileCreep) {
                        return hostileCreep;
                    } else {
                        if(jobObject){
                            const hostileStructure = jobObject.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
                            if (hostileStructure) {
                                return hostileStructure;
                            }
                        }else {
                            return jobObject;
                        }
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (jobObject !== fetchObject) { // hostileCreep
                        return creep.attack(fetchObject);
                    } else if (creep.pos.isNearTo(jobObject)) {
                        creep.say(jobObject.name);
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
                    if (hostileCreep) {
                        return hostileCreep;
                    } else {
                        return jobObject;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if (jobObject !== fetchObject) { // hostileCreep
                        let result = creep.rangedAttack(fetchObject);
                        if (result === OK && creep.pos.getRangeTo(fetchObject) <= 2) { // creep could do a ranged attack - maybe it should move away?
                            const nearestRampart = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                                filter: function (s) {
                                    return (s.structureType === STRUCTURE_RAMPART);
                                }
                            });
                            switch (true) {
                                case nearestRampart:
                                    result = Move(creep, nearestRampart); break;
                                case creep.pos.x < fetchObject.pos.x && creep.pos.y < fetchObject.pos.y:
                                    result = creep.move(TOP_LEFT); break;
                                case creep.pos.x > fetchObject.pos.x && creep.pos.y < fetchObject.pos.y:
                                    result = creep.move(TOP_RIGHT); break;
                                case creep.pos.x > fetchObject.pos.x && creep.pos.y > fetchObject.pos.y:
                                    result = creep.move(BOTTOM_RIGHT); break;
                                case creep.pos.x < fetchObject.pos.x && creep.pos.y > fetchObject.pos.y:
                                    result = creep.move(BOTTOM_LEFT); break;
                                case creep.pos.x < fetchObject.pos.x && creep.pos.y === fetchObject.pos.y:
                                    result = creep.move(LEFT); break;
                                case creep.pos.x > fetchObject.pos.x && creep.pos.y === fetchObject.pos.y:
                                    result = creep.move(RIGHT); break;
                                case creep.pos.x === fetchObject.pos.x && creep.pos.y > fetchObject.pos.y:
                                    result = creep.move(BOTTOM); break;
                                case creep.pos.x === fetchObject.pos.x && creep.pos.y < fetchObject.pos.y:
                                    result = creep.move(TOP); break;
                                default:
                                    Util.ErrorLog('ExecuteJobs', 'JobGuardGunnerPosition', 'gunner move error ' + creep.name);
                            }
                        }
                        return result;
                    } else if (creep.pos.isNearTo(jobObject)) {
                        creep.say(jobObject.name);
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
                    } else if (creep.pos.isNearTo(jobObject)) {
                        creep.say(jobObject.name);
                        return OK; // when OK is returned FindFetchObject is checking each tick for new woundedCreeps
                    } else if (jobObject === fetchObject) { // move to flag
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobHarvesterPosition(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.memory.HealthCheck) {
                        if (creep.ticksToLive > 1000) {
                            creep.memory.HealthCheck = true;
                        } else {
                            Util.Info('ExecuteJobs', 'JobHarvesterPosition', creep.name + ' committed suicide ticksToLive ' + creep.ticksToLive);
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
                    if (creep.pos.x === jobObject.pos.x && creep.pos.y === jobObject.pos.y && creep.pos.roomName === jobObject.pos.roomName) {
                        creep.say(jobObject.name);
                        return OK;
                    } else {
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobTransporterPosition(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.memory.HealthCheck) {
                        if (creep.ticksToLive > 1000) {
                            creep.memory.HealthCheck = true;
                        } else {
                            Util.Info('ExecuteJobs', 'JobTransporterPosition', creep.name + ' committed suicide ticksToLive ' + creep.ticksToLive);
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
                    if (creep.pos.x === jobObject.pos.x && creep.pos.y === jobObject.pos.y && creep.pos.roomName === jobObject.pos.roomName) {
                        creep.say(jobObject.name);
                        return OK;
                    } else {
                        return ERR_NOT_IN_RANGE;
                    }
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobBuilderPosition(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.memory.HealthCheck) {
                        if (creep.ticksToLive > 1000) {
                            creep.memory.HealthCheck = true;
                        } else {
                            Util.Info('ExecuteJobs', 'JobBuilderPosition', creep.name + ' committed suicide ticksToLive ' + creep.ticksToLive);
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
                    if (creep.pos.x === jobObject.pos.x && creep.pos.y === jobObject.pos.y && creep.pos.roomName === jobObject.pos.roomName) {
                        creep.say(jobObject.name);
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
            let lab = Game.getObjectById(creep.memory.LabId);
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.memory.Mineral) {
                        creep.memory.Mineral = jobObject.name.split('-').pop();
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
                    if (creep.store[creep.memory.Mineral] > 0) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(lab, creep.memory.Mineral);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (lab.store.getFreeCapacity(creep.memory.Mineral) - creep.store[creep.memory.Mineral] <= 0) { // predict
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
                                && s.store[creep.memory.Mineral] > 0);
                        }
                    })[0];
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return creep.withdraw(fetchObject, creep.memory.Mineral);
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobEmptyLabMineral(creep, roomJob) {
            let lab = Game.getObjectById(creep.memory.LabId);
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (!creep.memory.Mineral) {
                        creep.memory.Mineral = jobObject.name.split('-').pop();
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
                    if (creep.store.getFreeCapacity() > 0) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH
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
                    if (!jobObject.room) { // invisible
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
                    if (creep.hits < 100) {
                        result = ERR_TIRED;
                    } else if (powerBank) {
                        result = creep.attack(powerBank);
                        if (result === ERR_NO_BODYPART) {
                            result = ERR_TIRED;
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
                        // generate transport power flags depending on the amount of power that was in the powerBank
                        const observerRoom = jobObject.name.split(/[_]+/).filter(function (e) {return e;})[3];
                        const memPowerBank = Memory.MemRooms[observerRoom].PowerBankFlag;
                        const memPowerBankPower = memPowerBank.Power;
                        const numOfTransporterFlags = (memPowerBankPower / 1000) + 1;
                        for(let i = 1; i <= numOfTransporterFlags; i++){
                            jobObject.room.createFlag(i, 0, i + '_getPower_' + jobObject.pos.roomName, COLOR_ORANGE, COLOR_GREY);
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
                    if (fetchObject === jobObject ) {
                        if(creep.pos.getRangeTo(jobObject) < 8){
                            return OK;
                        }else{
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
                        if(creep.store.getUsedCapacity() > 0){
                            return SHOULD_FETCH;
                        }else{
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
                    const powerBank = jobObject.room.find(FIND_STRUCTURES, {filter: function (s){return s.structureType === STRUCTURE_POWER_BANK;}})[0];
                    if(!powerBank){
                        const powerResource = jobObject.room.find(FIND_DROPPED_RESOURCES, {filter: function (s){return s.resourceType === RESOURCE_POWER;}})[0];
                        if (powerResource) {
                            return creep.pickup(powerResource);
                        } else{
                            const powerRuin = jobObject.room.find(FIND_RUINS, {filter: function (s){return s.store.getUsedCapacity(RESOURCE_POWER) > 0;}})[0];
                            if (powerRuin) {
                                return creep.withdraw(powerRuin, RESOURCE_POWER);
                            }else{
                                jobObject.remove();
                                Util.Info('ExecuteJobs', 'JobTransportPowerBank', 'removing powerbank flag because last power has been picked up!');
                                return JOB_IS_DONE;
                            }
                        }
                    } else if (creep.pos.getRangeTo(powerBank) < 6) { // no powerResource on ground or powerRuin and in range to powerBank
                        return ERR_BUSY; // powerBank is still alive - wait for it to get destroyed
                    } else {
                        return Move(creep, powerBank);
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
                    const result = DepositCreepStore(creep, fetchObject);
                    if (result === OK) {
                        Util.InfoLog('ExecuteJobs', 'JobTransportPowerBank', 'transfer power ' + creep.name + ' ' + creep.store[RESOURCE_POWER] + ' to (' + fetchObject.pos.x + ',' + fetchObject.pos.y + ',' + fetchObject.pos.roomName + ')');
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
        function JobHarvestDeposit(creep, roomJob){
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if(creep.store.getUsedCapacity() === 0 && creep.ticksToLive < 500){
                        Util.Info('ExecuteJobs', 'JobHarvestDeposit', creep.name + ' committed suicide creep.ticksToLive ' + creep.ticksToLive + ' JOB_IS_DONE');
                        creep.suicide();
                        return JOB_IS_DONE;
                    }else if (creep.store.getFreeCapacity() === 0 || creep.memory.FetchObjectId && creep.store.getUsedCapacity() > 0 || creep.ticksToLive < 500) {
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
                        if(creep.memory.DepositId){
                            deposit = Game.getObjectById(creep.memory.DepositId);
                        }
                        if(!deposit){
                            deposit = jobObject.pos.lookFor(LOOK_DEPOSITS)[0];
                            if(deposit){
                                creep.memory.DepositId = deposit.id;
                            }else{
                                Util.ErrorLog('ExecuteJobs', 'JobHarvestDeposit', creep.name + ' no deposit found removed deposit flag in ' + jobObject.pos.roomName);
                                jobObject.remove();
                            }
                        }
                        if(deposit && deposit.cooldown === 0){
                            return creep.harvest(deposit)
                        }else if(deposit && deposit.cooldown > 0){
                            return ERR_BUSY;
                        }else if(deposit && deposit.lastCooldown > 70){
                            Util.InfoLog('ExecuteJobs', 'JobHarvestDeposit', creep.name + ' removed deposit in ' + jobObject.pos.roomName + ' lastCooldown ' + deposit.lastCooldown);
                            jobObject.remove();
                            return JOB_IS_DONE;
                        }else{
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

        // helper functions:

        /**@return {boolean}*/
        function FindAndRemoveMaxCreeps(roomName, creepName) {
            const creepType = creepName.substring(0, 1);
            if (Memory.MemRooms[roomName]
                && Memory.MemRooms[roomName].MaxCreeps[creepType]
                && Memory.MemRooms[roomName].MaxCreeps[creepType][creepName]
            ) {
                Memory.MemRooms[roomName].MaxCreeps[creepType][creepName] = undefined;
                return true;
            } else { // creep was not found in the expected room, now search all rooms for the creepName to remove
                Util.Info('ExecuteJobs', 'FindAndRemoveMaxCreeps', 'must look in other rooms ' + creepName + ' was in room ' + roomName + ' creepType ' + creepType);
                for (const memRoomKey in Memory.MemRooms) { // search for room with the creep
                    if (Memory.MemRooms[memRoomKey].MaxCreeps[creepType]
                        && Memory.MemRooms[memRoomKey].MaxCreeps[creepType][creepName]
                    ) {
                        Memory.MemRooms[memRoomKey].MaxCreeps[creepType][creepName] = undefined;
                        Util.Info('ExecuteJobs', 'FindAndRemoveMaxCreeps', 'found in other room ' + memRoomKey + ' ' + creepName + ' was in room ' + roomName + ' creepType ' + creepType);
                        return true;
                    }
                }
                Util.ErrorLog('ExecuteJobs', 'FindAndRemoveMaxCreeps', 'could not find creep ' + creepName + ' was in room ' + roomName + ' creepType ' + creepType);
                return false;
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
                if (!resourceSupply || !resourceSupply.store || resourceSupply.store[resourceToFetch] === 0) {
                    resourceSupply = undefined;
                    creep.memory.ResourceSupply = undefined;
                }else if(resourceSupply && resourceSupply.structureType === STRUCTURE_STORAGE && creep.pos.roomName === jobObject.pos.roomName && creep.pos.getRangeTo(jobObject.pos) > 2){ // creep should have a chance at finding stores that are closer
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
                            && (s.store[resourceToFetch] >= 200 || resourceToFetch !== RESOURCE_ENERGY && s.store[resourceToFetch] > 0);
                    }
                });
                resourceSupplies = resourceSupplies.concat(room.find(FIND_DROPPED_RESOURCES, {
                    filter: function (d) {
                        return d.resourceType === resourceToFetch && d.amount >= 50;
                    }
                }));
                resourceSupplies = resourceSupplies.concat(room.find(FIND_TOMBSTONES, {
                    filter: function (t) {
                        return t.store[resourceToFetch] >= 30;
                    }
                }));
                resourceSupplies = resourceSupplies.concat(room.find(FIND_RUINS, {
                    filter: function (r) {
                        return r.store[resourceToFetch] >= 30;
                    }
                }));
                let bestDistance = Number.MAX_SAFE_INTEGER;
                for (let i = 0; i < resourceSupplies.length; i++) {
                    let distance = Math.sqrt(Math.pow(resourceSupplies[i].pos.x - jobObject.pos.x, 2) + Math.pow(resourceSupplies[i].pos.y - jobObject.pos.y, 2));
                    if (resourceSupplies[i].structureType === STRUCTURE_TERMINAL) {
                        distance += 1000;
                    } else if (resourceSupplies[i].structureType === STRUCTURE_LINK) { // prefer links over other stores
                        distance -= 3;
                    } else if (!resourceSupplies[i].structureType) { // drop, tombstone or ruin is more important to pick up
                        distance -= 5;
                        if(resourceSupplies[i].store && resourceSupplies[i].store.getUsedCapacity(resourceToFetch) > 1000 || resourceSupplies[i].amount > 1000){
                            distance -= 10; // try and favor stores and drops that has way more of the resource
                        }
                    }
                    if(resourceSupplies[i].store && resourceSupplies[i].store.getUsedCapacity(resourceToFetch) > 500 || resourceSupplies[i].amount > 500){
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

        /**@return {int}*/
        function FetchResource(creep, fetchObject, resourceToFetch, max = -1) {
            let result;
            if (fetchObject.amount > 0) { // pickup
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
                if (creep.store[resourceToFetch] !== creep.store.getUsedCapacity()) {
                    if (creep.pos.isNearTo(fetchObject)) {
                        result = ERR_FULL; // throw this error to force the creep to transfer unwanted resource that it is carrying
                    } else {
                        result = ERR_NOT_IN_RANGE;
                    }
                } else if (max === -1) {
                    result = creep.withdraw(fetchObject, resourceToFetch);
                } else {
                    if (fetchObject.store[resourceToFetch] < max) {
                        if(creep.store.getFreeCapacity() > fetchObject.store[resourceToFetch]){
                            result = creep.withdraw(fetchObject, resourceToFetch, fetchObject.store[resourceToFetch]);
                        }else{
                            result = creep.withdraw(fetchObject, resourceToFetch, creep.store.getFreeCapacity());
                        }
                    } else {
                        if(creep.store.getFreeCapacity() > max){
                            result = creep.withdraw(fetchObject, resourceToFetch, max);
                        }else{
                            result = creep.withdraw(fetchObject, resourceToFetch, creep.store.getFreeCapacity());
                        }
                    }

                }
                if(result === OK && creep.store.getFreeCapacity() >= fetchObject.store[resourceToFetch]){
                    //Util.Info('ExecuteJobs', 'FetchResource', creep.name + ' creep freeCapacity ' + creep.store.getFreeCapacity() + ' fetchObject.store ' + fetchObject.store[resourceToFetch]);
                    creep.memory.ResourceSupply = undefined;
                }
            }
            if (result === ERR_FULL) { // creep store is full with anything other than resourceToFetch - get rid of it asap
                if (fetchObject.store && fetchObject.store.getFreeCapacity() > 0) {
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0 && resourceType !== resourceToFetch) {
                            result = creep.transfer(fetchObject, resourceType);
                            break;
                        }
                    }
                } else { // DROP, TOMBSTONE or RUIN
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0 && resourceType !== resourceToFetch) {
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
            let result = ERR_NO_RESULT_FOUND;
            let countResources = 0;
            let transferredAmount;
            for (const resourceType in creep.store) {
                if (creep.store[resourceType] > 0 && resourceType !== resourceTypeToKeep) {
                    if (countResources === 0) {
                        transferredAmount = creep.store[resourceType];
                        result = creep.transfer(storeToFillObject, resourceType);
                    }
                    countResources++;
                }
            }
            if (result === OK && countResources === 1 && !creep.name.startsWith('H')
                && (!storeToEmptyObject ||
                    ( // if there is a store to empty then look at how much the store has left and set JOB_IS_DONE if that store is empty
                        (storeToEmptyObject.structureType === STRUCTURE_CONTAINER || storeToEmptyObject.structureType === STRUCTURE_STORAGE) && storeToEmptyObject.store.getUsedCapacity(resourceTypeToKeep) < 500
                        || storeToEmptyObject.structureType === STRUCTURE_LINK && storeToEmptyObject.store[resourceTypeToKeep] < 500
                        || storeToEmptyObject.structureType === STRUCTURE_TERMINAL && resourceTypeToKeep === RESOURCE_ENERGY && (storeToEmptyObject.store[resourceTypeToKeep] <= 120000 && storeToEmptyObject.room.storage.store[resourceTypeToKeep] >= 5000)
                    )
                )
            ) {
                result = JOB_IS_DONE;
            } else if (result === ERR_NOT_IN_RANGE || result === OK && countResources <= 1) {

            } else if (result === OK && countResources > 1) { // if there are more to be transferred then set creep to busy
                result = ERR_BUSY;
            } else if (result === ERR_FULL) {
                Util.ErrorLog('ExecuteJobs', 'DepositCreepStore', 'unexpected ERR_FULL! ' + result + ' ' + creep.name + ' (' + storeToFillObject.pos.x + ',' + storeToFillObject.pos.y + ',' + storeToFillObject.pos.roomName + ') to ' + storeToFillObject + ' from ' + storeToEmptyObject + ' ' + resourceTypeToKeep);
            } else{
                Util.ErrorLog('ExecuteJobs', 'DepositCreepStore', 'unexpected result! ' + result + ' ' + creep.name + ' (' + storeToFillObject.pos.x + ',' + storeToFillObject.pos.y + ',' + storeToFillObject.pos.roomName + ') to ' + storeToFillObject + ' from ' + storeToEmptyObject + ' ' + resourceTypeToKeep + ' ' + JSON.stringify(creep.store) + ' ' + JSON.stringify(storeToFillObject));
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
                    if (resourceTypeToStore === RESOURCE_ENERGY) { // if the type to store is energy then try and prioritize links
                        for (const closestFreeStoreKey in closestFreeStores) {
                            if (closestFreeStores[closestFreeStoreKey].structureType === STRUCTURE_LINK) {
                                closestFreeStore = closestFreeStores[closestFreeStoreKey];
                                break;
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
                if(!closestFreeStore && maxMoveRange === 0){ // closestFreeStore still not found - look in nearest room for a storage that is free
                    Util.Info('ExecuteJobs', 'FindClosestFreeStore', 'not found, looking in other rooms for a storage');
                    let closestRoom;
                    let closestRoomRange = Number.MAX_SAFE_INTEGER;
                    for(const gameRoomKey in Game.rooms){
                        const gameRoom = Game.rooms[gameRoomKey];
                        const distance = Game.map.getRoomLinearDistance(creep.pos.roomName, gameRoom.name);
                        if(gameRoom.controller && gameRoom.controller.my && gameRoom.storage && gameRoom.storage.store.getFreeCapacity() > 0
                            && closestRoomRange > distance){
                            closestRoomRange = distance;
                            closestRoom = gameRoom;
                        }
                    }
                    if(closestRoom){
                        closestFreeStore = closestRoom.storage;
                        creep.memory.ClosestFreeStoreId = closestFreeStore.id;
                        Util.Info('ExecuteJobs', 'FindClosestFreeStore', creep.name + ' in ' + creep.pos.roomName + ' found closest available storage in ' + closestFreeStore.pos.roomName);
                    }
                } else if(closestFreeStore) {
                    creep.memory.ClosestFreeStoreId = closestFreeStore.id;
                }
            }
            return closestFreeStore;
        }

        /**@return {int}*/
        function Move(creep, obj, fill = 'transparent', stroke = '#fff', lineStyle = 'dashed', strokeWidth = .15, opacity = .3) {
            const opts = {
                reusePath: 5, // default
                serializeMemory: true,  // default
                noPathFinding: false,  // default
                visualizePathStyle: {
                    fill: fill,
                    stroke: stroke,
                    lineStyle: lineStyle,
                    strokeWidth: strokeWidth,
                    opacity: opacity
                }
            };
            let result = ERR_NO_RESULT_FOUND;
            let from = creep.pos;
            let to = obj.pos;
            if(from.roomName === to.roomName){
                result = creep.moveTo(to, opts);
            }else{ // not in the same room - make a map in mem
                opts.reusePath = 50; // movement between rooms should reuse path more
                if(!Memory.Paths){
                    Memory.Paths = {};
                }
                let shouldCalculate = true;
                if(Memory.Paths[to.roomName] && Memory.Paths[to.roomName][from.roomName]){
                    shouldCalculate = false;
                }
                if(shouldCalculate){ // Use `findRoute` to calculate a high-level plan for this path,
                    // prioritizing highways and owned rooms
                    const route = Game.map.findRoute(from.roomName, to.roomName, {
                        routeCallback(roomName) {
                            const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                            const isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
                            let isMyRoom = false;
                            if(Game.rooms[roomName] && Game.rooms[roomName].controller){
                                if(Game.rooms[roomName].controller.my){
                                    isMyRoom = true;
                                }
                            }
                            if (isHighway || isMyRoom) {
                                return 1;
                            } else {
                                return 10;
                            }
                        }
                    });
                    if(!Memory.Paths[to.roomName]){
                        Memory.Paths[to.roomName] = {};
                    }
                    let lastRoom = from.roomName;
                    for(const roomInRouteKey in route){
                        const roomInRoute = route[roomInRouteKey];
                        Memory.Paths[to.roomName][lastRoom] = roomInRoute.room;
                        lastRoom = roomInRoute.room
                    }
                    Util.Info('ExecuteJobs', 'Move', 'new path from ' + from.roomName + ' to ' + to.roomName + ' ' + creep.name +  ' paths: ' + JSON.stringify(Memory.Paths[to.roomName]));
                }
                const nextRoom = Memory.Paths[to.roomName][creep.pos.roomName];
                const exitDirection = Game.map.findExit(creep.room, nextRoom);
                const exitPosition = creep.pos.findClosestByPath(exitDirection);
                result = creep.moveTo(exitPosition, opts);
            }

            if (result === OK) {

                result = JOB_MOVING;
            } else if(result !== ERR_BUSY && result !== ERR_TIRED){
                if (creep.pos.x === 0) { // get away from room exits asap
                    creep.move(RIGHT);
                } else if (creep.pos.x === 49) {
                    creep.move(LEFT);
                } else if (creep.pos.y === 0) {
                    creep.move(BOTTOM);
                } else if (creep.pos.y === 49) {
                    creep.move(TOP);
                }
                if(!creep.memory.MoveErrWait){
                    creep.memory.MoveErrWait = 1;
                    creep.memory.MoveErrLastWait = Game.time;
                    result = JOB_MOVING;
                }else if(creep.memory.MoveErrWait < 10){
                    const ticksSinceWaitingStart = Game.time - creep.memory.MoveErrLastWait;
                    if(creep.memory.MoveErrLastWait && ticksSinceWaitingStart > 30){ // if the start of the wait time is more than 30 ticks away then reset it
                        Util.Info('ExecuteJobs', 'Move', 'move error reset time MoveErrWait ' + creep.memory.MoveErrWait + ' waited ' + ticksSinceWaitingStart + ' ticks ' + result + ' ' + creep.name + ' (' + from.x + ',' + from.y + ',' + from.roomName + ') to ' + obj + '(' + to.x + ',' + to.y + ',' + to.roomName + ')');
                        creep.memory.MoveErrLastWait = Game.time;
                        creep.memory.MoveErrWait = 0;
                    }
                    creep.memory.MoveErrWait++;
                    result = JOB_MOVING;
                }else{
                    if(from.roomName === to.roomName){
                        Util.Warning('ExecuteJobs', 'Move', 'move error MoveErrWait ' + creep.memory.MoveErrWait + ' ' + result + ' ' + creep.name + ' (' + from.x + ',' + from.y + ',' + from.roomName + ') to ' + obj + '(' + to.x + ',' + to.y + ',' + to.roomName + ') ending move!');
                    }else{
                        Util.ErrorLog('ExecuteJobs', 'Move', 'move error multiple room MoveErrWait ' + creep.memory.MoveErrWait + ' ' + result + ' ' + creep.name + ' (' + from.x + ',' + from.y + ',' + from.roomName + ') to ' + obj + '(' + to.x + ',' + to.y + ',' + to.roomName + ') ending move!');
                    }
                    result = JOB_IS_DONE;
                    creep.memory.MoveErrWait = undefined;
                }
            }
            return result;
        }
    }
};
module.exports = ExecuteJobs;