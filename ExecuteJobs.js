const ExecuteJobs = {
    run: function () {

        const ERR_NO_RESULT_FOUND = -20; // job flow did not encounter any actions that lead to any results!
        const JOB_IS_DONE = -21; // when the job should be removed but there are no ERR codes
        const JOB_MOVING = -22; // when the creep os moving to complete its job
        const JOB_OBJ_DISAPPEARED = -23; // getObjectById returned null
        const NO_ENERGY_FOUND = -24; // creep could not find any energy to take from

        const RAMPART_WALL_HITS_U_LVL8 = 100000;
        const RAMPART_WALL_HITS_O_LVL8 = 2000000;
        const RAMPART_WALL_MAX_HITS_WHEN_STORAGE_ENERGY = 600000;

        ExecuteRoomJobs();

        function ExecuteRoomJobs() {
            for (const creepName in Memory.creeps) {
                const creepMemory = Memory.creeps[creepName];
                const gameCreep = Game.creeps[creepName];
                const roomName = creepMemory.JobName.split(')').pop();
                if (creepMemory.JobName.startsWith('idle')) { // idle creep
                    if (!gameCreep) { // idle creep is dead
                        FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    } else { // idle creep is alive
                        // if idle creep is carrying something - move it to storage
                        if (gameCreep.room.storage && _.sum(gameCreep.room.storage.store) < gameCreep.room.storage.storeCapacity && _.sum(gameCreep.carry) > 0) {
                            let result;
                            for (const resourceType in gameCreep.carry) {
                                result = gameCreep.transfer(gameCreep.room.storage, resourceType);
                            }
                            if (result === ERR_NOT_IN_RANGE) {
                                result = Move(gameCreep, gameCreep.room.storage);
                            }
                            gameCreep.say('idle 📦');
                        }else if(!gameCreep.room.controller || !gameCreep.room.controller.my || gameCreep.memory.MoveHome){ // I do not own the room the idle creep is in - move it to an owned room!
                            let closestOwnedRoom;
                            if(!gameCreep.memory.MoveHome){
                                let bestDistance = Number.MAX_SAFE_INTEGER;
                                for (const memRoomKey in Memory.MemRooms) { // search for best storage
                                    if (Game.rooms[memRoomKey] && Game.rooms[memRoomKey].controller.my) { // exist and has room
                                        const distance = Game.map.getRoomLinearDistance(gameCreep.pos.roomName, memRoomKey);
                                        if (distance < bestDistance) {
                                            closestOwnedRoom = memRoomKey;
                                            bestDistance = distance;
                                        }
                                    }
                                }
                                gameCreep.memory.MoveHome = closestOwnedRoom;
                                console.log('ExecuteJobs ExecuteRoomJobs idle ' + creepName + ' in ' + gameCreep.pos.roomName + ' moving to ' + closestOwnedRoom);
                            }else{
                                closestOwnedRoom = gameCreep.memory.MoveHome;
                            }

                            if(closestOwnedRoom && (closestOwnedRoom !== gameCreep.pos.roomName || gameCreep.pos.getRangeTo(Game.rooms[closestOwnedRoom].controller) > 4)){
                                Move(gameCreep, Game.rooms[closestOwnedRoom].controller);
                                gameCreep.say('🏠🏃');
                            }else{
                                gameCreep.memory.MoveHome = undefined;
                                gameCreep.say('🏠🏃✔');
                            }
                        }
                    }
                } else { // creep is not idle
                    const job = Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];

                    if (!job && gameCreep) { // job is outdated and removed from Memory and creep is still alive
                        creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                    } else if (job && !gameCreep) { // job exists and creep is dead
                        const jobStillViable = JobStillViableAfterDeath(creepMemory, job, roomName);
                        if (jobStillViable) {
                            job.Creep = 'vacant';
                        } else {
                            delete Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];
                        }
                        FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    } else if (job && gameCreep) { // creep is alive and its job is found
                        const isJobDone = JobAction(gameCreep, job, creepMemory.JobName, roomName);
                        if (isJobDone) {
                            delete Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];
                            creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                        }
                    } else { // both job and creep is gone
                        console.log('ExecuteJobs ExecuteRoomJobs ' + creepName + ' on ' + creepMemory.JobName + ' in ' + roomName + ' has died and the job has disappeared');
                        FindAndRemoveMaxCreeps(roomName, creepName);
                        delete Memory.creeps[creepName];
                    }
                }
            }
        }

        /**@return {boolean}*/
        function JobStillViableAfterDeath(creepMemory, roomJob, roomName) {
            switch (true) {
                case creepMemory.JobName.startsWith('RemoteHarvest'):
                    const flagObj = Game.flags[roomJob.JobId];
                    if (flagObj.room && flagObj.room.controller && flagObj.room.controller.reservation && flagObj.room.controller.reservation.ticksToEnd >= 4999) {
                        return false;
                    }
                    break;
                case creepMemory.JobName.startsWith('Repair'):
                    const obj = Game.getObjectById(roomJob.JobId);
                    const gameRoom = Game.rooms[roomName];
                    if ((obj.structureType === STRUCTURE_RAMPART || obj.structureType === STRUCTURE_WALL) && (
                        gameRoom.controller && (
                            gameRoom.controller.level < 8 && obj.hits > RAMPART_WALL_HITS_U_LVL8
                            ||
                            gameRoom.controller.level === 8 && (
                                obj.hits > RAMPART_WALL_HITS_O_LVL8
                                ||
                                gameRoom.storage && gameRoom.storage.store[RESOURCE_ENERGY] < RAMPART_WALL_MAX_HITS_WHEN_STORAGE_ENERGY
                            )
                        )
                    )
                    ) {
                        return false;
                    }
                    break;
            }
            return true;
        }

        /**@return {boolean}*/
        function JobAction(creep, roomJob, jobKey, roomName) {
            let result = ERR_NO_RESULT_FOUND;
            switch (true) {
                // obj jobs
                case jobKey.startsWith('1Src'):
                    result = JobSource(creep, roomJob);
                    break;
                case jobKey.startsWith('0Ctrl') || jobKey.startsWith('9Ctrl') :
                    result = JobController(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('3Rep'):
                    result = JobRepair(creep, roomJob, jobKey); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('2Constr'):
                    result = JobConstruction(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('0FillSpwnEx'):
                    result = JobFillSpawnExtension(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('2FillTwr'):
                    result = JobFillTower(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('5FillStrg') || jobKey.startsWith('5FillStrgFromRemote') || jobKey.startsWith('4FillStrg-drp'):
                    result = JobFillStorage(creep, roomJob, roomName);
                    break;
                case jobKey.startsWith('5ExtrMin'):
                    result = JobExtractMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('5FillTermMin'):
                    result = JobFillTerminalMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('4FillTermE'):
                    result = JobFillTerminalEnergy(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('3FillLabE'):
                    result = JobFillLabEnergy(creep, roomJob); // uses JobEnergyAction()
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
                default:
                    ErrorLog('ExecuteJobs-JobAction-jobNotFound', 'ExecuteJobs JobAction ERROR! job not found ' + jobKey + ' ' + creep.name);
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
                    ErrorLog('ExecuteJobs-JobAction-noResultGained', 'ExecuteJobs JobAction ERROR! no result gained ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠' + result);
                } else if (result === JOB_OBJ_DISAPPEARED) {
                    creep.say('🙈' + result);
                } else if (result === NO_ENERGY_FOUND) {
                    console.log('ExecuteJobs JobAction WARNING! not enough energy ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠⚡' + result);
                } else {
                    //console.log('ExecuteJobs JobAction removing ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('✔' + result);
                }
                isJobDone = true;
            }

            if(result !== OK){
                if (creep.carry[RESOURCE_ENERGY] > 0) { // fill adjacent spawns, extensions and towers or repair or construct on the road
                    const toFill = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                        filter: (structure) => {
                            return (structure.structureType === STRUCTURE_SPAWN
                                || structure.structureType === STRUCTURE_EXTENSION
                                || structure.structureType === STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
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
                        }else{
                            const toBuild = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0];
                            if (toBuild) { // construct on the road
                                creep.build(toBuild);
                            }
                        }
                    }
                } else if (_.sum(creep.carry) < creep.carryCapacity && !creep.name.startsWith('H') && !creep.name.startsWith('E') && !creep.name.startsWith('D')) { // pickup adjacent resources
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
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            if (obj === null) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (_.sum(creep.carry) < creep.carryCapacity) {
                result = creep.harvest(obj);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, obj);
                }
            } else {
                const link = obj.pos.findInRange(FIND_MY_STRUCTURES, 2, {
                    filter: function (link) {
                        return link.structureType === STRUCTURE_LINK && link.energy < link.energyCapacity;
                    }
                })[0];
                if (link && creep.carry[RESOURCE_ENERGY] === creep.carryCapacity) {
                    result = creep.transfer(link, RESOURCE_ENERGY);
                } else {
                    const container = obj.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                        filter: function (container) {
                            return container.structureType === STRUCTURE_CONTAINER && _.sum(container.store) < container.storeCapacity;
                        }
                    })[0];
                    if (container) {
                        result = creep.transfer(container, RESOURCE_ENERGY);
                    } else {
                        for (const resourceType in creep.carry) {
                            result = creep.drop(resourceType);
                        }
                    }
                }

                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, obj);
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobController(creep, roomJob) {
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {
                creepAction: function () {
                    return creep.upgradeController(obj, RESOURCE_ENERGY);
                }
            });
            return result;
        }

        /**@return {int}*/
        function JobRepair(creep, roomJob, jobKey) {
            const obj = Game.getObjectById(roomJob.JobId);
            if (obj.hits === obj.hitsMax) {
                console.log('ExecuteJobs JobRepair nothing to repair ' + creep.name + ' on ' + jobKey + ' job is set to done');
                return JOB_IS_DONE;
            }
            const result = JobEnergyAction(creep, roomJob, obj, {
                creepAction: function () {
                    return creep.repair(obj, RESOURCE_ENERGY);
                }
            });

            return result;
        }

        /**@return {int}*/
        function JobConstruction(creep, roomJob) {
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {
                creepAction: function () {
                    return creep.build(obj, RESOURCE_ENERGY);
                }
            });
            return result;
        }

        /**@return {int}*/
        function JobFillSpawnExtension(creep, roomJob) {
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {
                creepAction: function () {
                    return creep.transfer(obj, RESOURCE_ENERGY);
                }
            });
            return result;
        }

        /**@return {int}*/
        function JobFillTower(creep, roomJob) {
            const obj = Game.getObjectById(roomJob.JobId);
            const result = JobEnergyAction(creep, roomJob, obj, {
                creepAction: function () {
                    return creep.transfer(obj, RESOURCE_ENERGY);
                }
            });
            return result;
        }

        /**@return {int}*/
        function JobFillStorage(creep, roomJob, roomName) {
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            const creepCarrySum = _.sum(creep.carry);
            if (obj && creepCarrySum < creep.carryCapacity && !creep.memory.Transferring) { // fill creep - not full and is not transferring

                if ((obj.structureType === STRUCTURE_CONTAINER && _.sum(obj.store) < 600)
                    || (obj.structureType === STRUCTURE_LINK && obj.energy < 600)
                    || (obj.structureType === STRUCTURE_TERMINAL && obj.store[RESOURCE_ENERGY] < 120000 && obj.store[RESOURCE_ENERGY] >= 5000)) {
                    return JOB_IS_DONE;
                }

                if (obj.structureType === STRUCTURE_CONTAINER) {
                    for (const resourceType in obj.store) {
                        result = creep.withdraw(obj, resourceType);
                    }
                } else if (obj.structureType === STRUCTURE_LINK || obj.structureType === STRUCTURE_TERMINAL) {
                    result = creep.withdraw(obj, RESOURCE_ENERGY);
                } else if (obj.resourceType !== undefined) { // drop
                    result = creep.pickup(obj);
                }
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, obj);
                } else if (result === ERR_NOT_ENOUGH_RESOURCES && creepCarrySum > 0) { // obj ran out of the resource
                    result = OK;
                    creep.memory.Transferring = true; // done filling creep up - moving to storage to transfer
                }
            } else if (_.sum(creep.carry) > 0) { // not empty creep
                const gameRoom = Game.rooms[roomName];
                for (const resourceType in creep.carry) {
                    result = creep.transfer(gameRoom.storage, resourceType);
                }
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, gameRoom.storage);
                }
                if (creepCarrySum > 0) {
                    creep.memory.Transferring = true; // moving to storage to transfer
                } else {
                    creep.memory.Transferring = undefined;
                }
            } else if (!obj) { // creep is empty, and is transferring and obj has disappeared
                result = JOB_OBJ_DISAPPEARED;
                creep.memory.Transferring = undefined;
            } else { // creep is empty, and was transferring
                result = OK;
                creep.memory.Transferring = undefined; // setting to not be transferring - forcing the creep to go back and withdraw/pickup
            }
            return result;
        }

        /**@return {int}*/
        function JobExtractMineral(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            if (obj === null) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (_.sum(creep.carry) < creep.carryCapacity) {
                result = creep.harvest(obj);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, obj);
                }
            } else {
                for (const resourceType in creep.carry) {
                    result = creep.drop(resourceType);
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobFillTerminalMineral(creep, roomJob) {
            const obj = Game.getObjectById(roomJob.JobId);
            let result = ERR_NO_RESULT_FOUND;
            if ((_.sum(obj.store) - obj.store[RESOURCE_ENERGY]) > (obj.storeCapacity - 100000)) {
                return JOB_IS_DONE;
            }
            if (_.sum(creep.carry) === 0) { // creep empty
                for (const resourceType in obj.room.storage.store) {
                    if (resourceType !== RESOURCE_ENERGY) {
                        result = creep.withdraw(obj.room.storage, resourceType);
                    }
                }
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, obj.room.storage);
                }
            }

            if (result === ERR_NO_RESULT_FOUND) { // creep is either full or nothing to withdraw
                for (const resourceType in creep.carry) {
                    result = creep.transfer(obj, resourceType);
                }
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, obj);
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobFillTerminalEnergy(creep, roomJob) {
            const obj = Game.getObjectById(roomJob.JobId);
            if(obj.store[RESOURCE_ENERGY] > 100000){
                return JOB_IS_DONE;
            }
            let result = JobEnergyAction(creep, roomJob, obj, {
                creepAction: function () {
                    return creep.transfer(obj, RESOURCE_ENERGY);
                }
            });
            return result;
        }

        /**@return {int}*/
        function JobFillLabEnergy(creep, roomJob) {
            const obj = Game.getObjectById(roomJob.JobId);
            let result = JobEnergyAction(creep, roomJob, obj, {
                creepAction: function () {
                    return creep.transfer(obj, RESOURCE_ENERGY);
                }
            });
            return result;
        }

        // flag jobs:

        /**@return {int}*/
        function JobTagController(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if (flagObj === undefined) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (flagObj.room === undefined) { // room is not in Game.rooms
                result = Move(creep, flagObj);
            } else {
                result = creep.signController(flagObj.room.controller, flagObj.name);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, flagObj.room.controller);
                } else if (result === OK) {
                    console.log("ExecuteJobs JobTagController done in " + flagObj.pos.roomName + " with " + creep.name + " tag " + flagObj.name);
                    result = JOB_IS_DONE;
                    flagObj.remove();
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobScoutPos(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if (flagObj === undefined) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (flagObj.room === undefined) { // room is not in Game.rooms
                result = Move(creep, flagObj);
            } else {
                if (flagObj.pos.x === creep.pos.x && flagObj.pos.y === creep.pos.y && flagObj.pos.roomName === creep.pos.roomName) {
                    result = creep.say(flagObj.name, true);
                } else {
                    result = Move(creep, flagObj);
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobClaimController(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if (flagObj === undefined) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (flagObj.room === undefined) { // room is not in Game.rooms
                result = Move(creep, flagObj);
            } else {
                result = creep.claimController(flagObj.room.controller);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, flagObj.room.controller);
                } else if (result === OK) {
                    result = JOB_IS_DONE;
                    flagObj.remove();
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobReserveController(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if (!flagObj) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (!flagObj.room) { // room is not in Game.rooms
                result = Move(creep, flagObj);
            } else if (!flagObj.room.controller) {
                result = JOB_IS_DONE;
            } else {
                result = creep.reserveController(flagObj.room.controller);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, flagObj.room.controller);
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobGuardPos(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if (flagObj === undefined) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (flagObj.room === undefined) { // room is not in Game.rooms
                result = Move(creep, flagObj);
            } else {
                const hostileCreep = creep.room.find(FIND_HOSTILE_CREEPS)[0];
                if (hostileCreep) {
                    result = Move(creep, hostileCreep);
                    result = creep.attack(hostileCreep);
                    if (result === ERR_NOT_IN_RANGE) {
                        result = OK;
                    }
                } else if (flagObj.pos.inRangeTo(creep, 1)) {
                    result = creep.say(flagObj.name);
                } else {
                    result = Move(creep, flagObj);
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobRemoteHarvest(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            let closestRoomWithStorage = creep.memory.ClosestRoomWithStorage; // try and load from creep memory
            if (flagObj === undefined) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (flagObj.room === undefined && !closestRoomWithStorage) { // room is not in Game.rooms
                result = Move(creep, flagObj);
            } else if (_.sum(creep.carry) < creep.carryCapacity && !closestRoomWithStorage) { // can harvest
                const source = flagObj.pos.findInRange(FIND_SOURCES, 0)[0];
                result = creep.harvest(source);
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, source);
                }
            } else {
                let closestRoomWithStorage = creep.memory.ClosestRoomWithStorage; // try and load from creep memory
                if (!closestRoomWithStorage) {
                    // carrying capacity is full - transfer to container or build container or move energy to nearest storage
                    const container = flagObj.pos.findInRange(FIND_STRUCTURES, 1, {
                        filter: function (container) {
                            return container.structureType === STRUCTURE_CONTAINER && _.sum(container.store) < container.storeCapacity;
                        }
                    })[0];
                    if (container) { // container found now transfer to container
                        console.log("ExecuteJobs JobRemoteHarvest TEST " + creep.name + " transfer to container in " + flagObj.pos.roomName);
                        return creep.transfer(container, RESOURCE_ENERGY);
                    }

                    // build container or go to nearest storage
                    const containerConstruction = flagObj.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                        filter: function (construction) {
                            return construction.structureType === STRUCTURE_CONTAINER;
                        }
                    })[0];
                    if (containerConstruction) { // build found - now build it
                        console.log("ExecuteJobs JobRemoteHarvest TEST " + creep.name + " build container in " + flagObj.pos.roomName);
                        return creep.build(containerConstruction);
                    }

                    // nothing to build and no empty containers - now move to nearest storage
                    closestRoomWithStorage = Memory.MemRooms[flagObj.pos.roomName].PrimaryRoom; // if the primary room already have been designated, then use that
                    if (!closestRoomWithStorage) {
                        let bestDistance = Number.MAX_SAFE_INTEGER;
                        for (const memRoomKey in Memory.MemRooms) { // search for best storage
                            if (Game.rooms[memRoomKey].storage && _.sum(Game.rooms[memRoomKey].storage.store) < Game.rooms[memRoomKey].storage.storeCapacity) { // exist and has room
                                const distance = Game.map.getRoomLinearDistance(flagObj.pos.roomName, memRoomKey);
                                if (distance < bestDistance) {
                                    closestRoomWithStorage = memRoomKey;
                                    bestDistance = distance;
                                }
                            }
                        }
                    }
                    if (closestRoomWithStorage) { // save to creep and MemRooms
                        creep.memory.ClosestRoomWithStorage = closestRoomWithStorage; // save in creep memory
                        if (!Memory.MemRooms[closestRoomWithStorage].AttachedRooms) {
                            Memory.MemRooms[closestRoomWithStorage].AttachedRooms = {};
                        }
                        Memory.MemRooms[closestRoomWithStorage].AttachedRooms[flagObj.pos.roomName] = {};
                        Memory.MemRooms[flagObj.pos.roomName].PrimaryRoom = closestRoomWithStorage;
                    }
                }

                if (closestRoomWithStorage) { // storage found either in mem or just found, now transfer to storage
                    result = creep.transfer(Game.rooms[closestRoomWithStorage].storage, RESOURCE_ENERGY);
                    if (result === ERR_NOT_IN_RANGE) {
                        result = Move(creep, Game.rooms[closestRoomWithStorage].storage);
                    } else {
                        creep.memory.ClosestRoomWithStorage = undefined;
                    }
                } else { // no storage found, just drop it on the ground
                    for (const resourceType in creep.carry) {
                        result = creep.drop(resourceType);
                    }
                }
            }
            return result;
        }

        // helper functions:

        /**@return {int}*/
        function JobEnergyAction(creep, roomJob, obj, actionFunction) {
            let result = ERR_NO_RESULT_FOUND;
            if (obj === null) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (creep.carry[RESOURCE_ENERGY] > 0) { // creep has energy
                result = actionFunction.creepAction();
                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, obj);
                }
            } else { // find more energy
                let energySupply = FindClosestEnergyInRoom(creep, obj.room);
                const energySupplyType = creep.memory.EnergySupplyType;
                if (!energySupply) {
                    result = NO_ENERGY_FOUND; // FindClosestEnergyInRoom did not find any energy
                    if (creep.pos.roomName !== obj.pos.roomName) {
                        energySupply = FindClosestEnergyInRoom(creep, creep.room); // try again but look at the room the creep is in
                        if (!energySupply) {
                            result = NO_ENERGY_FOUND; // FindClosestEnergyInRoom did not find any energy
                        }
                    }
                }
                if (energySupply && energySupplyType === 'DROP') {
                    result = creep.pickup(energySupply);
                } else if (energySupply) {
                    result = creep.withdraw(energySupply, RESOURCE_ENERGY);
                }

                if (result === ERR_NOT_IN_RANGE) {
                    result = Move(creep, energySupply);
                } else if (result === ERR_FULL) { // creep store is full with anything other than ENERGY - get rid of it asap
                    if (energySupplyType === 'CONTAINER' || energySupplyType === 'STORAGE') {
                        for (const resourceType in creep.carry) {
                            if (resourceType !== RESOURCE_ENERGY) {
                                result = creep.transfer(energySupply, resourceType);
                            }
                        }
                    } else { // DROP
                        for (const resourceType in creep.carry) {
                            if (resourceType !== RESOURCE_ENERGY) {
                                result = creep.drop(resourceType);
                            }
                        }
                    }
                } else if (result === OK) { // energy withdrawn successfully - now remove creep.memory.EnergySupply
                    creep.memory.EnergySupply = undefined;
                    creep.memory.EnergySupplyType = undefined;
                }
            }
            return result;
        }

        /**@return {object}*/
        function FindClosestEnergyInRoom(creep, room) {
            // set EnergySupply and EnergySupplyType on creep memory
            let energySupply = undefined;
            let energySupplyType = undefined;
            if (creep.memory.EnergySupply && creep.memory.EnergySupplyType) {
                energySupply = Game.getObjectById(creep.memory.EnergySupply);// closest link then container then droppedRes then storage
                energySupplyType = creep.memory.EnergySupplyType;
                // if the saved energySupply does not have any energy then remove it to make way for a new search
                if (energySupply && (energySupplyType === 'LINK' && energySupply.energy === 0)
                    || ((energySupplyType === 'CONTAINER' || energySupplyType === 'STORAGE') && energySupply.store[RESOURCE_ENERGY] === 0)) {
                    energySupply = undefined;
                    energySupplyType = undefined;
                    creep.memory.EnergySupply = undefined;
                    creep.memory.EnergySupplyType = undefined;
                }
            }

            if (!energySupply) { // creep memory had nothing stored
                let energySupplies = room.find(FIND_STRUCTURES, {
                    filter: function (s) {
                        return ((s.structureType === STRUCTURE_STORAGE
                            || s.structureType === STRUCTURE_CONTAINER) && s.store[RESOURCE_ENERGY] >= 100
                            || s.structureType === STRUCTURE_LINK && s.energy >= 100);
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

        function ErrorLog(messageId, message){
            console.log('--------------- ' + messageId + ' ---------------');
            console.log(message);
            console.log('--------------- ' + messageId + ' ---------------');
            if(!Memory.ErrorLog){
                Memory.ErrorLog = {};
            }
            if(!Memory.ErrorLog[messageId]) {
                Memory.ErrorLog[messageId] = [];
            }
            Memory.ErrorLog[messageId].push(Game.time + ' ' + message);
        }

        function FindAndRemoveMaxCreeps(roomName, creepName){
            if (Memory.MemRooms[roomName] && Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)]
                && Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)][creepName]) {
                Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)][creepName] = undefined;
            }else{ // creep was not found in the expected room, now search all rooms for the creepName to remove
                for (const memRoomKey in Memory.MemRooms) { // search for room with the creep
                    if(Memory.MemRooms[memRoomKey].MaxCreeps[creepName.substring(0, 1)]
                        && Memory.MemRooms[memRoomKey].MaxCreeps[creepName.substring(0, 1)][creepName]) {
                        Memory.MemRooms[memRoomKey].MaxCreeps[creepName.substring(0, 1)][creepName] = undefined;
                        break;
                    }
                }
            }
        }

        /**@return {int}*/
        function Move(creep, obj, fill = 'transparent', stroke = '#ffe100', lineStyle = 'dashed', strokeWidth = .15, opacity = .1){
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
            if(result === OK){
                result = JOB_MOVING;
            }
            return result;
        }
    }
};
module.exports = ExecuteJobs;