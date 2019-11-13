let Logs = require('Logs');
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
                    Logs.Error("creep JobName is undefined", "ERROR! creep JobName is undefined " + creepName);
                    if (!gameCreep) {
                        Logs.Error("gameCreep is undefined", "ERROR! gameCreep is undefined " + creepName);
                        delete Memory.creeps[creepName];
                    } else {
                        creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                    }
                    continue;
                }
                const roomName = creepMemory.JobName.split(')').pop();
                if (!creepMemory.JobName.startsWith('idle') && Memory.MemRooms[roomName]) { // creep is not idle
                    const job = Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];
                    if (!job && gameCreep) { // job is outdated and removed from Memory and creep is still alive
                        creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                    } else if (job && !gameCreep) { // job exists and creep is dead
                        if(Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName]){
                            Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName] = undefined;
                        }else{
                            Logs.Error('ExecuteJobs ExecuteRoomJobs creep dead delete job failed', gameCreep.name + ' ' + roomName + ' ' + creepMemory.JobName + ' gameCreep.pos.roomName ' + gameCreep.pos.roomName);
                        }
                        const didRemoveMaxCreeps = FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    } else if (job && gameCreep) { // creep is alive and its job is found
                        if (!gameCreep.spawning) {
                            const isJobDone = JobAction(gameCreep, job);
                            if (isJobDone) {
                                if(Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName]){
                                    Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName] = undefined;
                                }else{
                                    Logs.Error('ExecuteJobs ExecuteRoomJobs job done delete failed', gameCreep.name + ' ' + roomName + ' ' + creepMemory.JobName + ' gameCreep.pos.roomName ' + gameCreep.pos.roomName);
                                }
                                creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                            }
                        }
                    } else { // both job and creep is gone
                        console.log('ExecuteJobs ExecuteRoomJobs ' + creepName + ' on ' + creepMemory.JobName + ' in ' + roomName + ' has died and the job has disappeared');
                        Logs.Info('both creep and job gone', creepName + ' on ' + creepMemory.JobName + ' in ' + roomName);
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
                            let result;
                            for (const resourceType in gameCreep.store) {
                                if (gameCreep.store[resourceType] > 0) {
                                    result = gameCreep.transfer(gameCreep.room.storage, resourceType);
                                    break;
                                }
                            }
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
                                console.log('ExecuteJobs ExecuteRoomJobs idle ' + creepName + ' in ' + gameCreep.pos.roomName + ' moving to ' + closestOwnedRoom);
                            } else {
                                closestOwnedRoom = gameCreep.memory.MoveHome;
                            }

                            if (closestOwnedRoom && (closestOwnedRoom !== gameCreep.pos.roomName || gameCreep.pos.getRangeTo(Game.rooms[closestOwnedRoom].controller) > 4)) {
                                Move(gameCreep, Game.rooms[closestOwnedRoom].controller);
                                gameCreep.say('🏠🏃');
                            } else {
                                gameCreep.memory.MoveHome = undefined;
                                gameCreep.say('🏠🏃✔'); // TODO when idle creep is assigned in the room the MoveHome is not removed
                            }
                        }
                    }
                }
            }
        }

        /**@return {boolean}*/
        function JobAction(creep, roomJob) {
            const jobKey = creep.memory.JobName;
            let result = ERR_NO_RESULT_FOUND;
            switch (true) {
                // obj jobs
                case jobKey.startsWith('1Src'):
                    result = JobSource(creep, roomJob);
                    break;
                case jobKey.startsWith('0Ctrl') || jobKey.startsWith('9Ctrl') :
                    result = JobController(creep, roomJob);
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
                case jobKey.startsWith('5FillStrg') || jobKey.startsWith('5FillStrgFromRemote') || jobKey.startsWith('4FillStrg-drp') || jobKey.startsWith('4FillStrg-tmb'):
                    result = JobFillStorage(creep, roomJob);
                    break;
                case jobKey.startsWith('5ExtrMin'):
                    result = JobExtractMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('5FillTerm'):
                    result = JobFillTerminal(creep, roomJob);
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
                    result = JobScoutPos(creep, roomJob);
                    break;
                case jobKey.startsWith('1ClaimCtrl'):
                    result = JobClaimController(creep, roomJob);
                    break;
                case jobKey.startsWith('4ReserveCtrl'):
                    result = JobReserveController(creep, roomJob);
                    break;
                case jobKey.startsWith('2GuardPos'):
                    result = JobGuardPos(creep, roomJob);
                    break;
                case jobKey.startsWith('2GuardGunPos'):
                    result = JobGuardGunnerPos(creep, roomJob);
                    break;
                case jobKey.startsWith('2GuardMedPos'):
                    result = JobGuardMedicPos(creep, roomJob);
                    break;
                case jobKey.startsWith('5RemoteHarvest'):
                    result = JobRemoteHarvest(creep, roomJob);
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
                default:
                    Logs.Error('ExecuteJobs-JobAction-jobNotFound', 'ExecuteJobs JobAction ERROR! job not found ' + jobKey + ' ' + creep.name);
            }
            let isJobDone = false;
            if (result === OK) {
                // job is done everyone is happy, nothing to do.
            } else if (result === ERR_TIRED) {
                creep.say('😫 ' + creep.fatigue); // creep has fatigue and is limited in movement
            } else if (result === ERR_BUSY) {
                // The creep is still being spawned
            } else if (result === JOB_MOVING) {
                creep.say('🏃'); // The creep is just moving to its target
            } else { // results where anything else than OK - one should end the job!
                if (result === ERR_NO_RESULT_FOUND) {
                    Logs.Error('ExecuteJobs-JobAction-noResultGained', 'ExecuteJobs JobAction ERROR! no result gained ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠' + result);
                } else if (result === JOB_OBJ_DISAPPEARED) {
                    creep.say('🙈' + result);
                } else if (result === NO_FETCH_FOUND) {
                    console.log('ExecuteJobs JobAction WARNING! no fetch object found ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠⚡' + result);
                } else {
                    if (!result) {
                        console.log('ExecuteJobs JobAction removing ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                        Logs.Info('undefined result', creep.name + ' ' + jobKey);
                    }
                    creep.say('✔' + result);
                }
                isJobDone = true;
            }

            if (result !== OK) {
                if (creep.store[RESOURCE_ENERGY] > 0) { // fill adjacent spawns, extensions and towers or repair or construct on the road
                    const toFill = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                        filter: (structure) => {
                            return (structure.structureType === STRUCTURE_SPAWN
                                || structure.structureType === STRUCTURE_EXTENSION
                                || structure.structureType === STRUCTURE_TOWER) && structure.store[RESOURCE_ENERGY] < structure.store.getCapacity(RESOURCE_ENERGY);
                        }
                    })[0];
                    if (toFill) { // fill adjacent spawns, extensions
                        creep.transfer(toFill, RESOURCE_ENERGY); // it may do that "double" but it really does not matter
                        //console.log('ExecuteJobs JobAction ' + creep.name + ' transferred energy to adjacent spawn tower or extension (' + toFill.pos.x + ',' + toFill.pos.y + ',' + toFill.pos.roomName + ')');
                    } else if (creep.name.startsWith('H') || creep.name.startsWith('B') || creep.name.startsWith('D')) { // repair on the road
                        const toRepair = creep.pos.findInRange(FIND_STRUCTURES, 2, {
                            filter: (structure) => {
                                return (structure.structureType !== STRUCTURE_WALL
                                    && structure.structureType !== STRUCTURE_RAMPART) && structure.hits < structure.hitsMax;
                            }
                        })[0];
                        if (toRepair) { // repair on the road
                            creep.repair(toRepair);
                            //console.log('ExecuteJobs JobAction ' + creep.name + ' repaired ' + toRepair.structureType + ' (' + toRepair.pos.x + ',' + toRepair.pos.y + ',' + toRepair.pos.roomName + ',' + toRepair.hits + ',' + toRepair.hitsMax + ')');
                        } else {
                            const toBuild = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0];
                            if (toBuild) { // construct on the road
                                creep.build(toBuild);
                            }
                        }
                    }
                } else if (creep.store.getUsedCapacity() < creep.store.getCapacity() && !creep.name.startsWith('H') && !creep.name.startsWith('E') && !creep.name.startsWith('D')) { // pickup adjacent resources
                    const drop = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
                    if (drop) {
                        creep.pickup(drop); // it may do that "double" but it really does not matter
                        //console.log('ExecuteJobs JobAction ' + creep.name + ' picked up adjacent resource (' + drop.pos.x + ',' + drop.pos.y + ',' + drop.pos.roomName + ',' + drop.amount + ',' + drop.resourceType + ')');
                    }
                }
            }
            return isJobDone;
        }

        // obj jobs:

        /**@return {int}*/
        function JobSource(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (creep.store.getFreeCapacity() === 0) {
                        return SHOULD_FETCH;
                    } else {
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    let result = creep.harvest(jobObject);
                    if (result === ERR_NOT_ENOUGH_RESOURCES) {
                        //console.log('ExecuteJobs JobSource ' + creep.name + ' waiting for replenish (' + jobObject.pos.x + ',' + jobObject.pos.y + ',' + jobObject.pos.roomName + ')');
                        result = OK;
                    }
                    return result;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store.getFreeCapacity() <= 6) { // predict that creep will be full and make a transfer that wont stop the harvesting flow
                        let fetchObject = Game.getObjectById(creep.memory.LinkId);
                        if (!fetchObject) {
                            fetchObject = Game.getObjectById(creep.memory.ContainerId);
                        }
                        if (fetchObject) {
                            creep.transfer(fetchObject, RESOURCE_ENERGY);
                            return SHOULD_ACT;
                        }
                    }
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    let fetchObject;
                    let linkFull = false;
                    let containerFull = false;
                    if (creep.memory.LinkId) { // is link in memory?
                        fetchObject = Game.getObjectById(creep.memory.LinkId);
                        if (fetchObject && fetchObject.store[RESOURCE_ENERGY] === fetchObject.store.getCapacity(RESOURCE_ENERGY)) {
                            fetchObject = undefined; // do not use the saved link if the link is full
                            linkFull = true
                        }
                    }
                    if (!fetchObject && creep.memory.ContainerId) { // then is container in memory?
                        fetchObject = Game.getObjectById(creep.memory.ContainerId);
                        if (fetchObject && fetchObject.store.getUsedCapacity() === fetchObject.store.getCapacity()) {
                            fetchObject = undefined; // do not use the saved container if the container is full
                            containerFull = true;
                        }
                    }
                    if (!fetchObject) { // then find link object?
                        if (!linkFull) {
                            fetchObject = jobObject.pos.findInRange(FIND_MY_STRUCTURES, 2, { // link
                                filter: function (link) {
                                    return link.structureType === STRUCTURE_LINK && link.store[RESOURCE_ENERGY] < link.store.getCapacity(RESOURCE_ENERGY);
                                }
                            })[0];
                        }
                        if (!containerFull) { // then find container object
                            if (!fetchObject) {
                                fetchObject = jobObject.pos.findInRange(FIND_STRUCTURES, 2, { // container
                                    filter: function (container) {
                                        return container.structureType === STRUCTURE_CONTAINER && container.store.getUsedCapacity() < container.store.getCapacity();
                                    }
                                })[0];
                                if (fetchObject) {
                                    creep.memory.ContainerId = fetchObject.id;
                                }
                            } else {
                                creep.memory.LinkId = fetchObject.id;
                            }
                        }
                    }
                    if (!fetchObject) { // nothing can be found then drop
                        fetchObject = creep;
                    }
                    return fetchObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = ERR_NO_RESULT_FOUND;
                    if (fetchObject.name !== creep.name) { // if fetchObject is the creep object then drop the energy on the ground
                        const toRepair = creep.pos.findInRange(FIND_STRUCTURES, 2, {
                            filter: (structure) => {
                                return (structure.structureType !== STRUCTURE_WALL
                                    && structure.structureType !== STRUCTURE_RAMPART) && structure.hits < structure.hitsMax;
                            }
                        })[0];
                        if (toRepair) { // repair on the road
                            creep.repair(toRepair);
                            result = creep.transfer(fetchObject, RESOURCE_ENERGY, creep.store[RESOURCE_ENERGY] - creep.getActiveBodyparts(WORK));
                        } else {
                            result = creep.transfer(fetchObject, RESOURCE_ENERGY);
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
                /**@return {object} @return {undefined}*/
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
                /**@return {object} @return {undefined}*/
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
                /**@return {object} @return {undefined}*/
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
                /**@return {object} @return {undefined}*/
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
                /**@return {object} @return {undefined}*/
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
                    if (jobObject.structureType === STRUCTURE_CONTAINER || jobObject.creep) { // tombstone
                        for (const resourceType in jobObject.store) {
                            if (jobObject.store[resourceType] > 0) {
                                return creep.withdraw(jobObject, resourceType);
                            }
                        }
                        return ERR_NOT_ENOUGH_RESOURCES;
                    } else if (jobObject.structureType === STRUCTURE_LINK || jobObject.structureType === STRUCTURE_TERMINAL) {
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
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if (jobObject.room && jobObject.room.storage) {
                        return jobObject.room.storage;
                    } else if (creep.room.storage && (jobObject.room && jobObject.room.name !== creep.room.name || !jobObject.room)) {
                        return creep.room.storage;
                    } else if (Memory.MemRooms[jobObject.pos.roomName].PrimaryRoom) {
                        return Game.rooms[Memory.MemRooms[jobObject.pos.roomName].PrimaryRoom].storage;
                    } else {
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = ERR_NO_RESULT_FOUND;
                    let countResources = 0;
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0) {
                            result = creep.transfer(fetchObject, resourceType);
                            countResources++;
                        }
                    }
                    if (result === OK && countResources === 1
                        && (jobObject.structureType === STRUCTURE_CONTAINER && jobObject.store.getUsedCapacity() < 600
                            || jobObject.structureType === STRUCTURE_LINK && jobObject.store[RESOURCE_ENERGY] < 600
                            || jobObject.structureType === STRUCTURE_TERMINAL && (jobObject.store[RESOURCE_ENERGY] <= 120000 && jobObject.room.storage.store[RESOURCE_ENERGY] >= 5000))
                    ) {
                        result = JOB_IS_DONE;
                    }else if(result === OK && countResources > 1){ // if there are more to be transferred then set creep to busy
                        result = ERR_BUSY;
                    }
                    return result;
                },
            });
            if(result !== OK && result !== JOB_MOVING && result !== ERR_TIRED && result !== ERR_BUSY){
                creep.memory.Depositing = undefined;
            }
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
                        return SHOULD_FETCH; //
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
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    let fetchObject;
                    let containerFull = false;
                    if (creep.memory.ContainerId) { // is container in memory?
                        fetchObject = Game.getObjectById(creep.memory.ContainerId);
                        if (fetchObject && fetchObject.store.getUsedCapacity() === fetchObject.store.getCapacity()) {
                            fetchObject = undefined; // do not use the saved container if the container is full
                            containerFull = true;
                        }
                    }
                    if (!fetchObject && !containerFull) { // then find link object?
                        fetchObject = jobObject.pos.findInRange(FIND_STRUCTURES, 2, { // container
                            filter: function (container) {
                                return container.structureType === STRUCTURE_CONTAINER && container.store.getUsedCapacity() < container.store.getCapacity();
                            }
                        })[0];
                        if (fetchObject) {
                            creep.memory.ContainerId = fetchObject.id;
                        }
                    }
                    if (!fetchObject) { // nothing can be found then drop
                        fetchObject = creep;
                    }
                    return fetchObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = ERR_NO_RESULT_FOUND;
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0) {
                            if (fetchObject.name !== creep.name) {
                                result = creep.transfer(fetchObject, resourceType);
                                break;
                            } else {
                                result = creep.drop(resourceType); // if fetchObject is the creep object then drop the mineral on the ground
                                break;
                            }
                        }
                    }
                    return result;
                },
            });
            if(result !== OK && result !== JOB_MOVING && result !== ERR_TIRED && result !== ERR_BUSY){
                creep.memory.ContainerId = undefined;
            }
            return result;
        }

        /**@return {int}*/
        function JobFillTerminal(creep, roomJob) {
            let resourceType = creep.memory.resourceType;
            if(!resourceType){
                resourceType = creep.memory.JobName.split(/[()]+/).filter(function(e) { return e; })[1];
                creep.memory.resourceType = resourceType;
            }
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) { // terminal
                    if (resourceType === RESOURCE_ENERGY && jobObject.store[resourceType] >= 100000
                        || resourceType !== RESOURCE_ENERGY && jobObject.store[resourceType] >= 6000
                        || resourceType === RESOURCE_ENERGY && jobObject.room.storage.store[RESOURCE_ENERGY] < 50000) {
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
                    if (resourceType === RESOURCE_ENERGY && (creep.store[resourceType] + jobObject.store[resourceType]) >= 100000
                        || resourceType !== RESOURCE_ENERGY && (creep.store[resourceType] + jobObject.store[resourceType]) >= 6000) {
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    if(resourceType === RESOURCE_ENERGY){
                        return FindFetchResource(creep, jobObject, RESOURCE_ENERGY);
                    }else if(creep.room.storage && creep.room.storage.store[resourceType] > 0){
                        return creep.room.storage;
                    }else{
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchResource(creep, fetchObject, resourceType);
                },
            });
            if(result !== OK && result !== JOB_MOVING && result !== ERR_TIRED && result !== ERR_BUSY){
                creep.memory.resourceType = undefined;
            }
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
                /**@return {object} @return {undefined}*/
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
                    if(result === OK && jobObject.store[RESOURCE_ENERGY] > 4000){
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
                /**@return {object} @return {undefined}*/
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
        function JobFillPowerSpawnPower(creep, roomJob){
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
                    if(result === OK){
                        return JOB_IS_DONE;
                    }else{
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
                /**@return {object} @return {undefined}*/
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
                /**@return {object} @return {undefined}*/
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
                        Logs.Info('JobTagController done', creep.name + ' in ' + jobObject.pos.roomName + ' tag ' + jobObject.name);
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
        function JobScoutPos(creep, roomJob) {
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
                /**@return {object} @return {undefined}*/
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
                        Logs.Info('JobClaimController done', creep.name + ' in ' + jobObject.pos.roomName + ' tag ' + jobObject.name);
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
                /**@return {object} @return {undefined}*/
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
        function JobGuardPos(creep, roomJob) {
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
                        if (Math.abs(creep.pos.x - fetchObject.pos.x) > 1 || Math.abs(creep.pos.y - fetchObject.pos.y) > 1) {
                            creep.rangedAttack(fetchObject);
                            return ERR_NOT_IN_RANGE;
                        } else {
                            return creep.attack(fetchObject);
                        }
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
        function JobGuardGunnerPos(creep, roomJob) {
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
                        if(result === OK && creep.pos.getRangeTo(fetchObject) <= 2){ // creep could do a ranged attack - maybe it should move away?
                            const nearestRampart = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {filter: function (s) {return (s.structureType === STRUCTURE_RAMPART);}});
                            switch (true) {
                                case nearestRampart:
                                    result = Move(creep, nearestRampart);
                                    break;
                                case creep.pos.x < fetchObject.pos.x && creep.pos.y < fetchObject.pos.y:
                                    result = creep.move(TOP_LEFT);
                                    break;
                                case creep.pos.x > fetchObject.pos.x && creep.pos.y < fetchObject.pos.y:
                                    result = creep.move(TOP_RIGHT);
                                    break;
                                case creep.pos.x > fetchObject.pos.x && creep.pos.y > fetchObject.pos.y:
                                    result = creep.move(BOTTOM_RIGHT);
                                    break;
                                case creep.pos.x < fetchObject.pos.x && creep.pos.y > fetchObject.pos.y:
                                    result = creep.move(BOTTOM_LEFT);
                                    break;
                                case creep.pos.x < fetchObject.pos.x && creep.pos.y === fetchObject.pos.y:
                                    result = creep.move(LEFT);
                                    break;
                                case creep.pos.x > fetchObject.pos.x && creep.pos.y === fetchObject.pos.y:
                                    result = creep.move(RIGHT);
                                    break;
                                case creep.pos.x === fetchObject.pos.x && creep.pos.y > fetchObject.pos.y:
                                    result = creep.move(BOTTOM);
                                    break;
                                case creep.pos.x === fetchObject.pos.x && creep.pos.y < fetchObject.pos.y:
                                    result = creep.move(TOP);
                                    break;
                                default:
                                    Logs.Error('ExecuteJobs-JobGuardGunnerPos-gunnerMoveError', creep.name);
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
        function JobGuardMedicPos(creep, roomJob){
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
                        filter: function(creep) {
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
        function JobRemoteHarvest(creep, roomJob) {
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (creep.store.getFreeCapacity() === 0 || creep.memory.FetchObjectId && creep.store.getUsedCapacity > 0) {
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
                        if (creep.store[RESOURCE_ENERGY] > 0) { // try and repair / build container
                            const construction = jobObject.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0];
                            if (construction) { // build found - now build it
                                return creep.build(construction);
                            }
                            const damagedStructure = jobObject.pos.findInRange(FIND_STRUCTURES, 2, {
                                filter: function (structure) {
                                    return structure.hits < structure.hitsMax && (structure.structureType !== STRUCTURE_WALL || structure.structureType !== STRUCTURE_RAMPART);
                                }
                            })[0];
                            if (damagedStructure) { // damagedStructure found - now repair it
                                return creep.repair(damagedStructure);
                            }
                        }
                        let source = Game.getObjectById(creep.memory.SourceId);
                        if (!source) {
                            source = jobObject.pos.findInRange(FIND_SOURCES, 0)[0];
                            if (source) {
                                creep.memory.SourceId = source.id;
                            } else {
                                jobObject.remove(); // remove flag
                                Logs.Info('RemoteHarvest flag removed', creep.name + ' ' + roomJob);
                                return JOB_IS_DONE; // flag is supposed to be on top of source!
                            }
                        }
                        let result = creep.harvest(source);
                        if (result === ERR_NOT_ENOUGH_RESOURCES) {
                            console.log('ExecuteJobs JobRemoteHarvest ' + creep.name + ' waiting for replenish (' + jobObject.pos.x + ',' + jobObject.pos.y + ',' + jobObject.pos.roomName + ')');
                            result = OK;
                        }
                        return result;
                    }
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if (creep.store.getFreeCapacity() <= 6) { // predict that creep will be full and make a transfer that wont stop the harvesting flow
                        let fetchObject = Game.getObjectById(creep.memory.ContainerId);
                        if (fetchObject) {
                            creep.transfer(fetchObject, RESOURCE_ENERGY);
                            return SHOULD_ACT;
                        }
                    }
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) { // find free container at source or a storage in another room
                    let container = Game.getObjectById(creep.memory.ContainerId);
                    if (!container || container.store.getFreeCapacity() === 0) {
                        container = jobObject.pos.findInRange(FIND_STRUCTURES, 1, {
                            filter: function (container) {
                                return container.structureType === STRUCTURE_CONTAINER && container.store.getFreeCapacity() > 0;
                            }
                        })[0];
                        if (container) {
                            creep.memory.ContainerId = container.id;
                        }
                    }
                    if (container) { // container found now transfer to container
                        return container;
                    }
                    // container was not an option - now go back to primary room and transfer to storage
                    let closestRoomWithStorage = Memory.MemRooms[jobObject.pos.roomName].PrimaryRoom;
                    if (!closestRoomWithStorage) {
                        let bestDistance = Number.MAX_SAFE_INTEGER;
                        for (const memRoomKey in Memory.MemRooms) { // search for best storage
                            if (Game.rooms[memRoomKey] && Game.rooms[memRoomKey].storage && Game.rooms[memRoomKey].storage.store.getFreeCapacity() > 0) { // exist and has room
                                const distance = Game.map.getRoomLinearDistance(jobObject.pos.roomName, memRoomKey);
                                if (distance < bestDistance) {
                                    closestRoomWithStorage = memRoomKey;
                                    bestDistance = distance;
                                }
                            }
                        }
                        if (closestRoomWithStorage) { // save to creep and MemRooms
                            creep.memory.ClosestRoomWithStorage = closestRoomWithStorage; // save in creep memory
                            if (!Memory.MemRooms[closestRoomWithStorage].AttachedRooms) {
                                Memory.MemRooms[closestRoomWithStorage].AttachedRooms = {};
                            }
                            Memory.MemRooms[closestRoomWithStorage].AttachedRooms[jobObject.pos.roomName] = {};
                            Memory.MemRooms[jobObject.pos.roomName].PrimaryRoom = closestRoomWithStorage;
                        }
                    }
                    return Game.rooms[closestRoomWithStorage].storage;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return creep.transfer(fetchObject, RESOURCE_ENERGY);
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
                            Logs.Error('ExecuteJobs-JobFillLabMineral-labGone', 'ExecuteJobs JobFillLabMineral ERROR! no lab ' + jobObject.pos.roomName + ' ' + creep.name);
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
                            Logs.Error('ExecuteJobs-JobEmptyLabMineral-labGone', 'ExecuteJobs JobEmptyLabMineral ERROR! no lab ' + jobObject.pos.roomName + ' ' + creep.name);
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
                        if(powerBank){
                            creep.memory.PowerBankId = powerBank.id;
                        }
                    }
                    let result = ERR_NO_RESULT_FOUND;
                    if(creep.hits < 100){
                        result = ERR_TIRED;
                    }else if(powerBank){
                        result = creep.attack(powerBank);
                        if(result === ERR_NO_BODYPART){
                            result = ERR_TIRED;
                        }
                    }else{
                        const powerResource = jobObject.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
                            filter: function (power) {
                                return power.resourceType === RESOURCE_POWER;
                            }
                        })[0];
                        if(powerResource){
                            Logs.Info('ExecuteJobs JobAttackPowerBank done', creep.name + ' ' + jobObject.name + ' power ' + powerResource.amount);
                        }else{
                            Logs.Info('ExecuteJobs JobAttackPowerBank done', creep.name + ' ' + jobObject.name);
                        }
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
                    }else{
                        let powerBank;
                        if (creep.memory.PowerBankId) {
                            powerBank = Game.getObjectById(creep.memory.PowerBankId);
                        }
                        if (!powerBank) {
                            powerBank = jobObject.pos.lookFor(LOOK_STRUCTURES)[0];
                            if(powerBank){
                                creep.memory.PowerBankId = powerBank.id;
                            }
                        }
                        if(!powerBank){
                            return JOB_IS_DONE;
                        }else{
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
                    if(creep.memory.PrimaryHealerTarget && Game.creeps[creep.memory.PrimaryHealerTarget] && Game.creeps[creep.memory.PrimaryHealerTarget].hits < Game.creeps[creep.memory.PrimaryHealerTarget].hitsMax){
                        return Game.creeps[creep.memory.PrimaryHealerTarget];
                    }else{
                        let selectedWoundedCreep;
                        let mostWoundedCreep;
                        const woundedCreeps = creep.room.find(FIND_MY_CREEPS, {
                            filter: function(creep) {
                                return creep.hits < creep.hitsMax;
                            }
                        });
                        const healerCreeps = creep.room.find(FIND_MY_CREEPS, {
                            filter: function(creep) {
                                return creep.getActiveBodyparts(HEAL) > 0;
                            }
                        });
                        for(const woundedCreepKey in woundedCreeps){
                            const woundedCreep = woundedCreeps[woundedCreepKey];
                            let isAnyoneHealingWoundedCreep = false;
                            for(const healerCreepKey in healerCreeps){
                                const healerCreep = healerCreeps[healerCreepKey];
                                if(healerCreep.memory.PrimaryHealerTarget === woundedCreep.name){
                                    isAnyoneHealingWoundedCreep = true;
                                    break;
                                }
                            }
                            if(!isAnyoneHealingWoundedCreep){
                                creep.memory.PrimaryHealerTarget = woundedCreep.name;
                                selectedWoundedCreep = woundedCreep;
                                break;
                            }
                            if(!mostWoundedCreep || (mostWoundedCreep.hitsMax - mostWoundedCreep.hits) < (woundedCreep.hitsMax - woundedCreep.hits)){
                                mostWoundedCreep = woundedCreep;
                            }
                        }
                        if(selectedWoundedCreep){
                            return selectedWoundedCreep;
                        }else if(mostWoundedCreep){
                            return mostWoundedCreep;
                        }else{
                            return jobObject;
                        }
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if(fetchObject === jobObject){
                        return OK;
                    }else{
                        let result = creep.heal(fetchObject);
                        if(result !== OK || creep.getActiveBodyparts(HEAL) * 12 + fetchObject.hits >= fetchObject.hitsMax){ // predict that creep is fully healed
                            return result;
                        }else{
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
                    if(!jobObject){
                        return JOB_IS_DONE;
                    }else if (creep.store.getFreeCapacity() > 0) {
                        return SHOULD_ACT;
                    } else {
                        return SHOULD_FETCH;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if (!jobObject.room) { // invisible
                        return ERR_NOT_IN_RANGE;
                    }
                    const powerResource = jobObject.pos.lookFor(LOOK_RESOURCES)[0];
                    if(powerResource){
                        return creep.pickup(powerResource);
                    }else if(!powerResource && creep.pos.isNearTo(jobObject)){
                        const powerBank = jobObject.pos.lookFor(LOOK_STRUCTURES)[0];
                        if(powerBank){
                            creep.say('W8');
                            return OK;
                        }else{ // no powerResource and no powerBank
                            Logs.Info('ExecuteJobs JobTransportPowerBank waiting at powerbank flag', creep.name + ' flag in room ' + jobObject.pos.roomName);
                            creep.say('W8');
                            return OK;
                        }
                    }else{
                        return ERR_NOT_IN_RANGE;
                    }
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object} @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    let closestRoomWithStorage = creep.memory.ClosestRoomWithStorage;
                    if (!closestRoomWithStorage) {
                        let bestDistance = Number.MAX_SAFE_INTEGER;
                        for (const memRoomKey in Memory.MemRooms) { // search for best storage
                            if (Game.rooms[memRoomKey] && Game.rooms[memRoomKey].storage && Game.rooms[memRoomKey].storage.store.getFreeCapacity() > 0) { // exist and has room
                                const distance = Game.map.getRoomLinearDistance(jobObject.pos.roomName, memRoomKey);
                                if (distance < bestDistance) {
                                    closestRoomWithStorage = memRoomKey;
                                    bestDistance = distance;
                                }
                            }
                        }
                        if (closestRoomWithStorage) { // save to creep
                            creep.memory.ClosestRoomWithStorage = closestRoomWithStorage;
                        }
                    }
                    if(closestRoomWithStorage){
                        return Game.rooms[closestRoomWithStorage].storage;
                    }else{
                        Logs.Info('ExecuteJobs JobTransportPowerBank WARNING storage not found!', creep.name + ' could not find storage from ' + jobObject.pos.roomName);
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    const result = creep.transfer(fetchObject, RESOURCE_POWER);
                    if(result === OK){
                        Logs.Info('ExecuteJobs JobTransportPowerBank transfer power', creep.name + ' ' + creep.store[RESOURCE_POWER] + ' to (' + fetchObject.pos.x + ',' + fetchObject.pos.y + ','  + fetchObject.pos.roomName + ')');
                    }
                    return result;
                },
            });
            if(result === ERR_NO_PATH){
                result = OK;
            }
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
                console.log('ExecuteJobs FindAndRemoveMaxCreeps must look in other rooms ' + creepName + ' was in room ' + roomName + ' creepType ' + creepType);
                for (const memRoomKey in Memory.MemRooms) { // search for room with the creep
                    if (Memory.MemRooms[memRoomKey].MaxCreeps[creepType]
                        && Memory.MemRooms[memRoomKey].MaxCreeps[creepType][creepName]
                    ) {
                        Memory.MemRooms[memRoomKey].MaxCreeps[creepType][creepName] = undefined;
                        console.log('ExecuteJobs FindAndRemoveMaxCreeps found in other room ' + memRoomKey + ' ' + creepName + ' was in room ' + roomName + ' creepType ' + creepType);
                        return true;
                    }
                }
                Logs.Error('ExecuteJobs FindAndRemoveMaxCreeps could not find creep', creepName + ' was in room ' + roomName + ' creepType ' + creepType);
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
        function FindClosestResourceInRoom(creep, room, resourceToFetch, jobObject) {
            // set ResourceSupply and ResourceSupplyType on creep memory
            let resourceSupply = undefined;
            let resourceSupplyType = undefined;
            if (creep.memory.ResourceSupply && creep.memory.ResourceSupplyType) {
                resourceSupply = Game.getObjectById(creep.memory.ResourceSupply);// closest link then container then droppedRes then storage
                resourceSupplyType = creep.memory.ResourceSupplyType;
                // if the saved resourceSupply does not have any energy then remove it to make way for a new search
                if (!resourceSupply || !resourceSupply.store || resourceSupply.store[resourceToFetch] === 0) {
                    resourceSupply = undefined;
                    resourceSupplyType = undefined;
                    creep.memory.ResourceSupply = undefined;
                    creep.memory.ResourceSupplyType = undefined;
                }
            }

            if (!resourceSupply) { // creep memory had nothing stored
                let resourceSupplies = room.find(FIND_STRUCTURES, {
                    filter: function (s) {
                        return (s.structureType === STRUCTURE_CONTAINER
                            || s.structureType === STRUCTURE_STORAGE
                            || s.structureType === STRUCTURE_LINK
                            || (jobObject.structureType !== STRUCTURE_TERMINAL && s.structureType === STRUCTURE_TERMINAL)
                            )
                            && (s.store[resourceToFetch] >= 200 || resourceToFetch !== RESOURCE_ENERGY && s.store[resourceToFetch] > 0);
                    }
                });
                resourceSupplies = resourceSupplies.concat(room.find(FIND_DROPPED_RESOURCES, {
                    filter: function (d) {
                        return (d.resourceType === resourceToFetch && d.amount >= 50);
                    }
                }));
                let bestDistance = Number.MAX_SAFE_INTEGER;
                for (let i = 0; i < resourceSupplies.length; i++) {
                    let distance = Math.sqrt(Math.pow(resourceSupplies[i].pos.x - creep.pos.x, 2) + Math.pow(resourceSupplies[i].pos.y - creep.pos.y, 2));
                    if(resourceSupplies.structureType === STRUCTURE_TERMINAL){
                        distance += 1000;
                    }
                    if (distance < bestDistance) {
                        resourceSupply = resourceSupplies[i];
                        bestDistance = distance;
                    }
                }
                if (resourceSupply) {
                    if (resourceSupply.structureType === undefined) {
                        resourceSupplyType = 'DROP';
                    } else if (resourceSupply.structureType === STRUCTURE_LINK) {
                        resourceSupplyType = 'LINK';
                    } else if (resourceSupply.structureType === STRUCTURE_CONTAINER) {
                        resourceSupplyType = 'CONTAINER';
                    } else if (resourceSupply.structureType === STRUCTURE_STORAGE) {
                        resourceSupplyType = 'STORAGE';
                    } else if (resourceSupply.structureType === STRUCTURE_TERMINAL) {
                        resourceSupplyType = 'TERMINAL';
                    }
                    creep.memory.ResourceSupply = resourceSupply.id;
                    creep.memory.ResourceSupplyType = resourceSupplyType;
                }
            }
            return resourceSupply;
        }

        /**@return {object} @return {undefined}*/
        function FindFetchResource(creep, jobObject, resourceToFetch) {
            let energySupply = FindClosestResourceInRoom(creep, jobObject.room, resourceToFetch, jobObject);
            if (!energySupply && creep.pos.roomName !== jobObject.pos.roomName) {
                energySupply = FindClosestResourceInRoom(creep, creep.room, resourceToFetch, jobObject); // try again but look at the room the creep is in
            }
            return energySupply;
        }

        /**@return {int}*/
        function FetchResource(creep, fetchObject, resourceToFetch, max = -1) {
            let result;
            if (creep.memory.ResourceSupplyType === 'DROP') {
                if(max === -1){
                    result = creep.pickup(fetchObject);
                }else{
                    result = creep.pickup(fetchObject, max);
                }
            } else {
                if(max === -1){
                    result = creep.withdraw(fetchObject, resourceToFetch);
                }else{
                    result = creep.withdraw(fetchObject, resourceToFetch, max);
                }
            }
            if (result === ERR_FULL) { // creep store is full with anything other than resourceToFetch - get rid of it asap
                if ((creep.memory.ResourceSupplyType === 'CONTAINER'
                    || creep.memory.ResourceSupplyType === 'STORAGE'
                    || creep.memory.ResourceSupplyType === 'TERMINAL') && fetchObject.store.getFreeCapacity() > 0) {
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0 && resourceType !== resourceToFetch) {
                            result = creep.transfer(fetchObject, resourceType);
                            break;
                        }
                    }
                }else { // DROP
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0 && resourceType !== resourceToFetch) {
                            result = creep.drop(resourceType);
                            break;
                        }
                    }
                }
            } else if (result === OK) { // resource withdrawn successfully - now remove creep.memory.ResourceSupply
                creep.memory.ResourceSupply = undefined;
                creep.memory.ResourceSupplyType = undefined;
            }
            return result;
        }

        // TODO create new helper function for when creep wants to transfer all its stuff before returning OK - return BUSY if not done transferring all

        /**@return {int}*/
        function Move(creep, obj, fill = 'transparent', stroke = '#fff', lineStyle = 'dashed', strokeWidth = .15, opacity = .3) {
            // TODO maybe try and reuse move path here?
            let result = creep.moveTo(obj, {
                visualizePathStyle: {
                    fill: fill,
                    stroke: stroke,
                    lineStyle: lineStyle,
                    strokeWidth: strokeWidth,
                    opacity: opacity
                }
            });
            if (result === OK) {
                result = JOB_MOVING;
            }
            return result;
        }
    }
};
module.exports = ExecuteJobs;