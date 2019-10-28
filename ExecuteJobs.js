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
                    } else {
                        creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                    }
                    continue;
                }
                const roomName = creepMemory.JobName.split(')').pop();

                if (!creepMemory.JobName.startsWith('idle')) { // creep is not idle
                    const job = Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];

                    if (!job && gameCreep) { // job is outdated and removed from Memory and creep is still alive
                        creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                    } else if (job && !gameCreep) { // job exists and creep is dead
                        delete Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];
                        FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    } else if (job && gameCreep) { // creep is alive and its job is found
                        if(!gameCreep.spawning){
                            const isJobDone = JobAction(gameCreep, job);
                            if (isJobDone) {
                                delete Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];
                                creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                            }
                        }
                    } else { // both job and creep is gone
                        console.log('ExecuteJobs ExecuteRoomJobs ' + creepName + ' on ' + creepMemory.JobName + ' in ' + roomName + ' has died and the job has disappeared');
                        Logs.Info('both creep and job gone', creepName + ' on ' + creepMemory.JobName + ' in ' + roomName);
                        FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    }
                }
                if (creepMemory.JobName.startsWith('idle')) { // idle creep
                    if (!gameCreep) { // idle creep is dead
                        FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    } else { // idle creep is alive
                        // if idle creep is carrying something - move it to storage
                        if (gameCreep.room.storage && gameCreep.room.storage.store.getUsedCapacity() < gameCreep.room.storage.store.getCapacity() && gameCreep.store.getUsedCapacity() > 0) {
                            let result;
                            for (const resourceType in gameCreep.store) {
                                if(gameCreep.store[resourceType] > 0){
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
                case jobKey.startsWith('5FillStrg') || jobKey.startsWith('5FillStrgFromRemote') || jobKey.startsWith('4FillStrg-drp'):
                    result = JobFillStorage(creep, roomJob);
                    break;
                case jobKey.startsWith('5ExtrMin'):
                    result = JobExtractMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('5FillTermMin'):
                    result = JobFillTerminalMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('4FillTermE'):
                    result = JobFillTerminalEnergy(creep, roomJob);
                    break;
                case jobKey.startsWith('3FillLabE'):
                    result = JobFillLabEnergy(creep, roomJob);
                    break;
                case jobKey.startsWith('5FillPSpwnE'):
                    result = JobFillPowerSpawnEnergy(creep, roomJob);
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
                    if(!result){
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
                    if(creep.store.getFreeCapacity() <= 6){ // predict that creep will be full and make a transfer that wont stop the harvesting flow
                        let fetchObject = Game.getObjectById(creep.memory.LinkId);
                        if(!fetchObject){
                            fetchObject = Game.getObjectById(creep.memory.ContainerId);
                        }
                        if(fetchObject) {
                            creep.transfer(fetchObject, RESOURCE_ENERGY);
                            return SHOULD_ACT;
                        }
                    }
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
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
                        }else{
                            result = creep.transfer(fetchObject, RESOURCE_ENERGY);
                        }
                    } else {
                        for (const resourceType in creep.store) {
                            if(creep.store[resourceType] > 0){
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
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindFetchEnergy(creep, jobObject);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchEnergy(creep, fetchObject);
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
                    return FindFetchEnergy(creep, jobObject);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchEnergy(creep, fetchObject);
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
                    return FindFetchEnergy(creep, jobObject);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchEnergy(creep, fetchObject);
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
                    return FindFetchEnergy(creep, jobObject);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchEnergy(creep, fetchObject);
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
                    return FindFetchEnergy(creep, jobObject);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchEnergy(creep, fetchObject);
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
                    if (creepSum === 0 || !creep.memory.Depositing && creepSum < creep.store.getCapacity() && creep.pos.getRangeTo(jobObject) <= 1
                        && (jobObject.store.getUsedCapacity() > 0
                            || jobObject.structureType === STRUCTURE_TERMINAL && (jobObject.store[RESOURCE_ENERGY] > 120000 || jobObject.room.storage.store[RESOURCE_ENERGY] < 5000 && jobObject.store[RESOURCE_ENERGY] > 0))
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
                    if (jobObject.structureType === STRUCTURE_CONTAINER) {
                        for (const resourceType in jobObject.store) {
                            if (jobObject.store[resourceType] > 0) {
                                return creep.withdraw(jobObject, resourceType);
                            }
                        }
                        return ERR_NOT_ENOUGH_RESOURCES;
                    } else if (jobObject.structureType === STRUCTURE_LINK || jobObject.structureType === STRUCTURE_TERMINAL) {
                        return creep.withdraw(jobObject, RESOURCE_ENERGY);
                    } else if (jobObject.resourceType !== undefined) { // drop
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
                    } else if(Memory.MemRooms[jobObject.pos.roomName].PrimaryRoom) {
                        return Game.rooms[Memory.MemRooms[jobObject.pos.roomName].PrimaryRoom].storage;
                    } else {
                        creep.memory.Depositing = undefined;
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
                            || jobObject.structureType === STRUCTURE_TERMINAL && (jobObject.store[RESOURCE_ENERGY] <= 120000 || jobObject.room.storage.store[RESOURCE_ENERGY] >= 5000 && jobObject.store[RESOURCE_ENERGY] > 0))
                    ) {
                        creep.memory.Depositing = undefined;
                        result = JOB_IS_DONE;
                    }
                    return result;
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
                /**@return {object}
                 * @return {undefined}*/
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
            return result;
        }

        /**@return {int}*/
        function JobFillTerminalMineral(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    let storageHasMinerals = false;
                    for (const resourceType in jobObject.room.storage.store) {
                        if (jobObject.room.storage.store[resourceType] > 0 && resourceType !== RESOURCE_ENERGY) {
                            storageHasMinerals = true;
                            break;
                        }
                    }
                    if ((jobObject.store.getUsedCapacity() - jobObject.store[RESOURCE_ENERGY]) > (jobObject.store.getCapacity() - 100000) || !storageHasMinerals) {
                        return JOB_IS_DONE;
                    } else if (creep.store.getUsedCapacity() - creep.store[RESOURCE_ENERGY] === 0) { // fetch from storage
                        return SHOULD_FETCH;
                    } else { // action not done yet - place mineral in terminal
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) { // transfer any mineral that is on creep
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0 && resourceType !== RESOURCE_ENERGY) {
                            return creep.transfer(jobObject, resourceType);
                        }
                    }
                    console.log('TEST JobFillTerminalMineral Act transfer not found ' + creep.name + JSON.stringify(creep.store));
                    return ERR_NO_RESULT_FOUND;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    let countResources = 0;
                    let resourceAmount = 0;
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0) {
                            countResources++;
                            resourceAmount = creep.store[resourceType];
                        }
                    }
                    if (countResources <= 1 && (resourceAmount + jobObject.store.getUsedCapacity() - jobObject.store[RESOURCE_ENERGY]) > (jobObject.store.getCapacity() - 100000)) {
                        return JOB_IS_DONE;
                    } else if(countResources <= 1){
                        return SHOULD_FETCH;
                    } else {
                        return SHOULD_ACT;
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return jobObject.room.storage;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) { // withdraw any mineral that is in storage
                    for (const resourceType in fetchObject.store) {
                        if (fetchObject.store[resourceType] > 0 && resourceType !== RESOURCE_ENERGY) {
                            return creep.withdraw(fetchObject, resourceType);
                        }
                    }
                    console.log('TEST JobFillTerminalMineral Fetch withdraw not found ' + creep.name + JSON.stringify(fetchObject.store));
                    return ERR_NO_RESULT_FOUND;
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobFillTerminalEnergy(creep, roomJob) {
            const result = GenericJobAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if (jobObject.store[RESOURCE_ENERGY] > 100000) {
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
                    if (creep.store[RESOURCE_ENERGY] + jobObject.store[RESOURCE_ENERGY] > 100000) {
                        return JOB_IS_DONE;
                    } else {
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return FindFetchEnergy(creep, jobObject);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchEnergy(creep, fetchObject);
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
                    return FindFetchEnergy(creep, jobObject);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchEnergy(creep, fetchObject);
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
                    return FindFetchEnergy(creep, jobObject);
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return FetchEnergy(creep, fetchObject);
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
                    if(!jobObject.room){
                        return SHOULD_ACT;
                    }else{
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
                    if(jobObject.room && jobObject.room.controller){
                        return jobObject.room.controller;
                    }else{
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = creep.signController(fetchObject, jobObject.name);
                    if(result === OK){
                        Logs.Info('JobTagController done', creep.name + ' in ' + jobObject.pos.roomName + ' tag ' + jobObject.name);
                        jobObject.remove();
                        return JOB_IS_DONE;
                    }else{
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
                    if(!jobObject.room){
                        return SHOULD_ACT;
                    }else{
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
                    if(creep.pos.isNearTo(jobObject)){
                        creep.say(jobObject.name);
                        return OK;
                    }else{
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
                    if(!jobObject.room){
                        return SHOULD_ACT;
                    }else{
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
                    if(jobObject.room && jobObject.room.controller){
                        return jobObject.room.controller;
                    }else{
                        return undefined;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    let result = creep.claimController(fetchObject);
                    if(result === OK){
                        Logs.Info('JobClaimController done', creep.name + ' in ' + jobObject.pos.roomName + ' tag ' + jobObject.name);
                        jobObject.remove();
                        return JOB_IS_DONE;
                    }else{
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
                    if(!jobObject.room){
                        return SHOULD_ACT;
                    }else{
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
                    if(jobObject.room && jobObject.room.controller){
                        return jobObject.room.controller;
                    }else{
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
                    if(!jobObject.room){
                        return SHOULD_ACT;
                    }else{
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
                    const hostileCreep = creep.room.find(FIND_HOSTILE_CREEPS)[0];
                    if(hostileCreep){
                        return hostileCreep;
                    }else{
                        return jobObject;
                    }
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    if(jobObject !== fetchObject){ // hostileCreep
                        return creep.attack(fetchObject);
                    }else if(creep.pos.isNearTo(jobObject)){
                        creep.say(jobObject.name);
                        return OK; // when OK is returned FindFetchObject is checking each tick for new hostileCreeps
                    }else if(jobObject === fetchObject){ // move to flag
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
                    if(creep.store.getFreeCapacity() === 0 || creep.memory.FetchObjectId && creep.store.getUsedCapacity > 0){
                        return SHOULD_FETCH;
                    }else{
                        return SHOULD_ACT;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if(!jobObject.room){ // invisible room
                        return ERR_NOT_IN_RANGE;
                    }else{
                        if(creep.store[RESOURCE_ENERGY] > 0){ // try and repair / build container
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
                        if(!source){
                            source = jobObject.pos.findInRange(FIND_SOURCES, 0)[0];
                            if(source){
                                creep.memory.SourceId = source.id;
                            }else{
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
                    if(creep.store.getFreeCapacity() <= 6){ // predict that creep will be full and make a transfer that wont stop the harvesting flow
                        let fetchObject = Game.getObjectById(creep.memory.ContainerId);
                        if(fetchObject) {
                            creep.transfer(fetchObject, RESOURCE_ENERGY);
                            return SHOULD_ACT;
                        }
                    }
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) { // find free container at source or a storage in another room
                    let container = Game.getObjectById(creep.memory.ContainerId);
                    if(!container || container.store.getFreeCapacity() === 0){
                        container = jobObject.pos.findInRange(FIND_STRUCTURES, 1, {
                            filter: function (container) {
                                return container.structureType === STRUCTURE_CONTAINER && container.store.getFreeCapacity() > 0;
                            }
                        })[0];
                        if(container){
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
                            }})[0];
                        if (!lab) { // lab does not exist - delete flag and remove job
                            jobObject.remove();
                            Logs.Error('ExecuteJobs-JobFillLabMineral-labGone', 'ExecuteJobs JobFillLabMineral ERROR! no lab ' + jobObject.pos.roomName + ' ' + creep.name);
                            return ERR_NO_RESULT_FOUND;
                        }
                        creep.memory.LabId = lab.id;
                    }
                    if(creep.store[creep.memory.Mineral] > 0){
                        return SHOULD_ACT;
                    }else{
                        return SHOULD_FETCH
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    return creep.transfer(lab, creep.memory.Mineral);
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if(lab.store.getFreeCapacity(creep.memory.Mineral) - creep.store[creep.memory.Mineral] <= 0){ // predict
                        return JOB_IS_DONE
                    }else{
                        return this.JobStatus(jobObject);
                    }
                },
                /**@return {object}
                 * @return {undefined}*/
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
                            }})[0];
                        if (!lab) { // lab does not exist - delete flag and remove job
                            jobObject.remove();
                            Logs.Error('ExecuteJobs-JobEmptyLabMineral-labGone', 'ExecuteJobs JobEmptyLabMineral ERROR! no lab ' + jobObject.pos.roomName + ' ' + creep.name);
                            return ERR_NO_RESULT_FOUND;
                        }
                        creep.memory.LabId = lab.id;
                    }
                    if(creep.store.getFreeCapacity() > 0){
                        return SHOULD_ACT;
                    }else{
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
                /**@return {object}
                 * @return {undefined}*/
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
        function JobAttackPowerBank(creep, roomJob){
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    return SHOULD_ACT;
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if(!jobObject.room){ // invisible
                        return ERR_NOT_IN_RANGE;
                    }
                    let powerBank;
                    if(creep.memory.PowerBankId){
                        powerBank = Game.getObjectById(creep.memory.PowerBankId);
                    }
                    if(!powerBank){
                        powerBank = jobObject.pos.lookFor(LOOK_STRUCTURES)[0];
                        creep.memory.PowerBankId = powerBank.id;
                    }
                    let result;
                    if(creep.hits < creep.hitsMax){
                        result = creep.heal(creep);
                    }else{
                        result = creep.attack(powerBank);
                    }
                    return result;
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    if(jobObject.hits < (creep.getActiveBodyparts(ATTACK) * 30)){
                        console.log('ExecuteJobs JobHarvestPowerBank power bank is destroyed ' + jobObject.pos.roomName + ' ' + creep.name);
                    }
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
                FindFetchObject: function (jobObject) {
                    return jobObject;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return JOB_IS_DONE;
                },
            });
            return result;
        }

        /**@return {int}*/
        function JobTransportPowerBank(creep, roomJob){
            const result = GenericFlagAction(creep, roomJob, {
                /**@return {int}*/
                JobStatus: function (jobObject) {
                    if(creep.store.getFreeCapacity() === 0){
                        return SHOULD_ACT;
                    }else{
                        return SHOULD_FETCH;
                    }
                },
                /**@return {int}*/
                Act: function (jobObject) {
                    if(!jobObject.room){ // invisible
                        return ERR_NOT_IN_RANGE;
                    }
                    return creep.pickup(jobObject.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
                        filter: function (power) {
                            return (power.resourceType === RESOURCE_POWER);
                        }
                    }));
                },
                /**@return {int}*/
                IsJobDone: function (jobObject) {
                    return this.JobStatus(jobObject);
                },
                /**@return {object}
                 * @return {undefined}*/
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
                    return Game.rooms[closestRoomWithStorage].storage;
                },
                /**@return {int}*/
                Fetch: function (fetchObject, jobObject) {
                    return creep.transfer(fetchObject, RESOURCE_POWER);
                },
            });
            return result;
        }

        // helper functions:

        /**@return {object}
         * @return {undefined}*/
        function FindClosestEnergyInRoom(creep, room) {
            // set EnergySupply and EnergySupplyType on creep memory
            let energySupply = undefined;
            let energySupplyType = undefined;
            if (creep.memory.EnergySupply && creep.memory.EnergySupplyType) {
                energySupply = Game.getObjectById(creep.memory.EnergySupply);// closest link then container then droppedRes then storage
                energySupplyType = creep.memory.EnergySupplyType;
                // if the saved energySupply does not have any energy then remove it to make way for a new search
                if (energySupply && energySupply.store[RESOURCE_ENERGY] === 0) {
                    energySupply = undefined;
                    energySupplyType = undefined;
                    creep.memory.EnergySupply = undefined;
                    creep.memory.EnergySupplyType = undefined;
                }
            }

            if (!energySupply) { // creep memory had nothing stored
                let energySupplies = room.find(FIND_STRUCTURES, {
                    filter: function (s) {
                        return s.store[RESOURCE_ENERGY] >= 100;
                    }
                });
                energySupplies = energySupplies.concat(room.find(FIND_DROPPED_RESOURCES, {
                    filter: function (d) {
                        return (d.resourceType === RESOURCE_ENERGY && d.amount >= 50);
                    }
                }));
                let bestDistance = Number.MAX_SAFE_INTEGER;
                for (let i = 0; i < energySupplies.length; i++) {
                    const distance = Math.sqrt(Math.pow(energySupplies[i].pos.x - creep.pos.x, 2) + Math.pow(energySupplies[i].pos.y - creep.pos.y, 2));
                    if (distance < bestDistance) {
                        energySupply = energySupplies[i];
                        bestDistance = distance;
                    }
                }
                if (energySupply) {
                    if (energySupply.structureType === undefined) {
                        energySupplyType = 'DROP';
                    } else if (energySupply.structureType === STRUCTURE_LINK) {
                        energySupplyType = 'LINK';
                    } else if (energySupply.structureType === STRUCTURE_CONTAINER) {
                        energySupplyType = 'CONTAINER';
                    } else if (energySupply.structureType === STRUCTURE_STORAGE) {
                        energySupplyType = 'STORAGE';
                    }
                    creep.memory.EnergySupply = energySupply.id;
                    creep.memory.EnergySupplyType = energySupplyType;
                }
            }
            return energySupply;
        }

        function FindAndRemoveMaxCreeps(roomName, creepName) {
            if (Memory.MemRooms[roomName] && Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)]
                && Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)][creepName]) {
                Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)][creepName] = undefined;
            } else { // creep was not found in the expected room, now search all rooms for the creepName to remove
                for (const memRoomKey in Memory.MemRooms) { // search for room with the creep
                    if (Memory.MemRooms[memRoomKey].MaxCreeps[creepName.substring(0, 1)]
                        && Memory.MemRooms[memRoomKey].MaxCreeps[creepName.substring(0, 1)][creepName]) {
                        Memory.MemRooms[memRoomKey].MaxCreeps[creepName.substring(0, 1)][creepName] = undefined;
                        break;
                    }
                }
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
                }else if (jobStatus === JOB_IS_DONE) {
                    result = JOB_IS_DONE;
                }
            }

            if (result !== OK && result !== ERR_TIRED && result !== JOB_MOVING && result !== ERR_BUSY) { // job is ending
                creep.memory.FetchObjectId = undefined;
            }
            return result;
        }

        /**@return {object}
         * @return {undefined}*/
        function FindFetchEnergy(creep, jobObject) {
            let energySupply = FindClosestEnergyInRoom(creep, jobObject.room);
            if (!energySupply && creep.pos.roomName !== jobObject.pos.roomName) {
                energySupply = FindClosestEnergyInRoom(creep, creep.room); // try again but look at the room the creep is in
            }
            return energySupply;
        }

        /**@return {int}*/
        function FetchEnergy(creep, fetchObject) {
            let result;
            if (creep.memory.EnergySupplyType === 'DROP') {
                result = creep.pickup(fetchObject);
            } else {
                result = creep.withdraw(fetchObject, RESOURCE_ENERGY);
            }
            if (result === ERR_FULL) { // creep store is full with anything other than ENERGY - get rid of it asap
                if (creep.memory.EnergySupplyType === 'CONTAINER' || creep.memory.EnergySupplyType === 'STORAGE') {
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0 && resourceType !== RESOURCE_ENERGY) {
                            result = creep.transfer(creep.memory.EnergySupplyType, resourceType);
                            break;
                        }
                    }
                } else { // DROP
                    for (const resourceType in creep.store) {
                        if (creep.store[resourceType] > 0 && resourceType !== RESOURCE_ENERGY) {
                            result = creep.drop(resourceType);
                            break;
                        }
                    }
                }
            } else if (result === OK) { // energy withdrawn successfully - now remove creep.memory.EnergySupply
                creep.memory.EnergySupply = undefined;
                creep.memory.EnergySupplyType = undefined;
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