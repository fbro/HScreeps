const ExecuteJobs = {
    run: function () {
        // jobs have been created
        // creeps where assigned
        // check if creep on job is dead then set job to vacant - one room at a time - one job at a time
        // if creep alive then execute the job
        // after execution - check if job is done
        // if job is done then set creep to idle and remove job from memory

        const ERR_NO_RESULT_FOUND = -20; // job flow did not encounter any actions that lead to any results!
        const JOB_IS_DONE = -21; // when the job should be removed but there are no ERR codes
        const JOB_OBJ_DISAPPEARED = -22; // getObjectById returned null
        const NO_ENERGY_FOUND = -23; // creep could not find any energy to take from

        ExecuteRoomJobs();

        function ExecuteRoomJobs() {
            for (const creepName in Memory.creeps) {
                const creepMemory = Memory.creeps[creepName];
                const gameCreep = Game.creeps[creepName];
                const roomName = creepMemory.JobName.split(')').pop();
                if (!gameCreep && creepMemory.JobName.startsWith('idle')) { // idle creep is dead
                    console.log('ExecuteJobs ExecuteRoomJobs idle creep ' + creepName + ' in ' + roomName + ' has died');
                    if (Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)]) {
                        Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)].NumOfCreepsInRoom--;
                    }
                    delete Memory.creeps[creepName];
                } else if (creepMemory.JobName.startsWith('idle')) {
                    if(gameCreep.room.storage && _.sum(gameCreep.room.storage.store) < gameCreep.room.storage.storeCapacity && _.sum(gameCreep.carry) > 0){
                        let result;
                        for (const resourceType in gameCreep.carry) {
                            result = gameCreep.transfer(gameCreep.room.storage, resourceType);
                        }
                        if(result === ERR_NOT_IN_RANGE){
                            result = gameCreep.moveTo(gameCreep.room.storage);
                        }
                        gameCreep.say('idle 📦');
                    }
                } else { // creep is not idle
                    const job = Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];

                    if (!job && gameCreep) { // job is outdated and removed from Memory and creep is still alive
                        console.log('ExecuteJobs ExecuteRoomJobs job gone ' + creepName + ' on ' + creepMemory.JobName + ' in ' + roomName);
                        creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                    } else if (job && !gameCreep) { // job exists and creep is dead
                        console.log('ExecuteJobs ExecuteRoomJobs ' + creepName + ' on ' + creepMemory.JobName + ' in ' + roomName + ' has died');
                        const tombstone = Game.rooms[roomName].find(FIND_TOMBSTONES, {
                            filter: function (tombstone) {
                                return tombstone.creep.name === creepName;
                            }
                        })[0];
                        if (tombstone) {
                            new RoomVisual(roomName).text(creepName + '⚰', tombstone.pos.x, tombstone.pos.y);
                        }
                        job.Creep = 'vacant';
                        if (Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)]) {
                            Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)].NumOfCreepsInRoom--;
                        }
                        delete Memory.creeps[creepName];
                    } else if (job && gameCreep) { // creep is alive and its job is found
                        const isJobDone = JobAction(gameCreep, job, creepMemory.JobName);
                        if (isJobDone) {
                            delete Memory.MemRooms[roomName].RoomJobs[creepMemory.JobName];
                            creepMemory.JobName = 'idle(' + gameCreep.pos.x + ',' + gameCreep.pos.y + ')' + gameCreep.pos.roomName;
                        }
                    } else { // both job and creep is gone
                        console.log('ExecuteJobs ExecuteRoomJobs ' + creepName + ' on ' + creepMemory.JobName + ' in ' + roomName + ' has died and the job has disappeared');
                        if (Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)]) {
                            Memory.MemRooms[roomName].MaxCreeps[creepName.substring(0, 1)].NumOfCreepsInRoom--;
                        }
                        delete Memory.creeps[creepName];
                    }
                }
            }
        }

        /**@return {boolean}*/
        function JobAction(creep, roomJob, jobKey) {
            let result = ERR_NO_RESULT_FOUND;
            switch (true) {
                // obj jobs
                case jobKey.startsWith('Source'):
                    result = JobSource(creep, roomJob);
                    break;
                case jobKey.startsWith('Controller'):
                    result = JobController(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('Repair'):
                    result = JobRepair(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('Construction'):
                    result = JobConstruction(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('FillSpawnExtension'):
                    result = JobFillSpawnExtension(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('FillTower'):
                    result = JobFillTower(creep, roomJob); // uses JobEnergyAction()
                    break;
                case jobKey.startsWith('FillStorage'):
                    result = JobFillStorage(creep, roomJob);
                    break;
                case jobKey.startsWith('ExtractMineral'):
                    result = JobExtractMineral(creep, roomJob);
                    break;
                case jobKey.startsWith('FillTerminalMineral'):
                    result = JobFillTerminalMineral(creep, roomJob, jobKey);
                    break;
                case jobKey.startsWith('FillTerminalEnergy'):
                    result = JobFillTerminalEnergy(creep, roomJob); // uses JobEnergyAction()
                    break;

                // flag jobs
                case jobKey.startsWith('TagController'):
                    result = JobTagController(creep, roomJob);
                    break;
                case jobKey.startsWith('ScoutPos'):
                    result = JobScoutPos(creep, roomJob);
                    break;
                case jobKey.startsWith('ClaimController'):
                    result = JobClaimController(creep, roomJob);
                    break;
                case jobKey.startsWith('ReserveController'):
                    result = JobReserveController(creep, roomJob);
                    break;
                case jobKey.startsWith('GuardPos'):
                    result = JobGuardPos(creep, roomJob);
                    break;
                case jobKey.startsWith('RemoteHarvest'):
                    result = JobRemoteHarvest(creep, roomJob);
                    break;
                default:
                    console.log('ExecuteJobs JobAction ERROR! job not found ' + jobKey + ' ' + creep.name);
            }
            let isJobDone = false;
            if (result === OK) {
                // job is done everyone is happy, nothing to do.
            } else if (result === ERR_TIRED) {
                creep.say('😫 ' + creep.fatigue);
            } else if (result === ERR_BUSY) {
                // The creep is still being spawned
            } else { // results where anything else than OK - one should end the job!
                if (result === ERR_NO_RESULT_FOUND) {
                    console.log('ExecuteJobs JobAction ERROR! no result gained ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠' + result);
                } else if (result === JOB_OBJ_DISAPPEARED) {
                    console.log('ExecuteJobs JobAction removing disappeared job ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('⚠' + result);
                } else if (result === NO_ENERGY_FOUND) {
                    console.log('ExecuteJobs JobAction WARNING! not enough energy ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('🙈' + result);
                } else {
                    //console.log('ExecuteJobs JobAction removing ' + jobKey + ' ' + result + ' ' + roomJob.Creep);
                    creep.say('✔' + result);
                }
                isJobDone = true;
            }
            if (creep.carry[RESOURCE_ENERGY] > 0) { // fill adjacent spawns, extensions and towers
                const toFill = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                    filter: (structure) => {
                        return (structure.structureType === STRUCTURE_SPAWN
                            || structure.structureType === STRUCTURE_EXTENSION
                            || structure.structureType === STRUCTURE_TOWER) && structure.energy < structure.energyCapacity;
                    }
                })[0];
                if (toFill) {
                    creep.transfer(toFill, RESOURCE_ENERGY); // it may do that "double" but it really does not matter
                    //console.log('ExecuteJobs JobAction ' + creep.name + ' transferred energy to adjacent spawn tower or extension (' + toFill.pos.x + ',' + toFill.pos.y + ',' + toFill.pos.roomName + ')');
                }
            } else if (_.sum(creep.carry) < creep.carryCapacity && !creep.name.startsWith('H')) { // pickup adjacent resources
                const drop = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];
                if (drop) {
                    creep.pickup(drop); // it may do that "double" but it really does not matter
                    //console.log('ExecuteJobs JobAction ' + creep.name + ' picked up adjacent resource (' + drop.pos.x + ',' + drop.pos.y + ',' + drop.pos.roomName + ',' + drop.amount + ',' + drop.resourceType + ')');
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
                    result = creep.moveTo(obj, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ffe100',
                            lineStyle: 'undefined',
                            strokeWidth: .15,
                            opacity: .5
                        }
                    });
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
                        result = creep.transfer(link, RESOURCE_ENERGY);
                    } else {
                        for (const resourceType in creep.carry) {
                            result = creep.drop(resourceType);
                        }
                    }
                }

                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(obj, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ffe100',
                            lineStyle: 'undefined',
                            strokeWidth: .15,
                            opacity: .5
                        }
                    });
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
        function JobRepair(creep, roomJob) {
            const obj = Game.getObjectById(roomJob.JobId);
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
        function JobFillStorage(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const obj = Game.getObjectById(roomJob.JobId);
            if (obj && _.sum(creep.carry) < creep.carryCapacity && !creep.memory.Transferring) { // fill creep - not full and is not transferring
                if (obj.structureType === STRUCTURE_CONTAINER) {
                    for (const resourceType in obj.store) {
                        result = creep.withdraw(obj, resourceType);
                    }
                } else if (obj.structureType === STRUCTURE_LINK) {
                    result = creep.withdraw(obj, RESOURCE_ENERGY);
                } else if (obj.resourceType !== undefined) { // drop
                    result = creep.pickup(obj);
                }
                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(obj, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#00f5ff',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
                } else if (result === ERR_NOT_ENOUGH_RESOURCES && _.sum(creep.carry) > 0) { // obj ran out of the resource
                    result = OK;
                    creep.memory.Transferring = true; // done filling creep up - moving to storage to transfer
                }
            } else if (_.sum(creep.carry) > 0) { // not empty creep
                for (const resourceType in creep.carry) {
                    result = creep.transfer(creep.room.storage, resourceType);
                }
                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(creep.room.storage, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#0048ff',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
                }
                if (_.sum(creep.carry) > 0) {
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
                    result = creep.moveTo(obj, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#fffdfe',
                            lineStyle: 'undefined',
                            strokeWidth: .15,
                            opacity: .5
                        }
                    });
                }
            } else {
                for (const resourceType in creep.carry) {
                    result = creep.drop(resourceType);
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobFillTerminalMineral(creep, roomJob, roomJobKey) {
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
                    result = creep.moveTo(obj.room.storage, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ffe100',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
                }
            }

            if (result === ERR_NO_RESULT_FOUND) { // creep is either full or nothing to withdraw
                for (const resourceType in creep.carry) {
                    result = creep.transfer(obj, resourceType);
                }
                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(obj, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ffe100',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobFillTerminalEnergy(creep, roomJob) {
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
                result = creep.moveTo(flagObj);
            } else {
                result = creep.signController(flagObj.room.controller, flagObj.name);
                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(flagObj.room.controller, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ffb900',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
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
                result = creep.moveTo(flagObj);
            } else {
                if (flagObj.pos.x === creep.pos.x && flagObj.pos.y === creep.pos.y && flagObj.pos.roomName === creep.pos.roomName) {
                    result = creep.say(flagObj.name, true);
                } else {
                    result = creep.moveTo(flagObj, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ffdb00',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
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
                result = creep.moveTo(flagObj);
            } else {
                result = creep.claimController(flagObj.room.controller);
                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(flagObj.room.controller, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ff00e9',
                            lineStyle: 'undefined',
                            strokeWidth: .15,
                            opacity: .5
                        }
                    });
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
            if (flagObj === undefined) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (flagObj.room === undefined) { // room is not in Game.rooms
                result = creep.moveTo(flagObj);
            } else {
                result = creep.reserveController(flagObj.room.controller);
                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(flagObj.room.controller, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ff00e9',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .5
                        }
                    });
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
                result = creep.moveTo(flagObj);
            } else {
                const hostileCreep = creep.room.find(FIND_HOSTILE_CREEPS)[0];
                if (hostileCreep) {
                    creep.moveTo(hostileCreep, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ff5600',
                            lineStyle: 'undefined',
                            strokeWidth: .15,
                            opacity: .5
                        }
                    });
                    result = creep.attack(hostileCreep);
                    if (result === ERR_NOT_IN_RANGE) {
                        result = OK;
                    }
                } else if (flagObj.pos.inRangeTo(creep, 1)) {
                    result = creep.say(flagObj.name);
                } else {
                    result = creep.moveTo(flagObj, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ff5600',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
                }
            }
            return result;
        }

        /**@return {int}*/
        function JobRemoteHarvest(creep, roomJob) {
            let result = ERR_NO_RESULT_FOUND;
            const flagObj = Game.flags[roomJob.JobId];
            if (flagObj === undefined) {
                result = JOB_OBJ_DISAPPEARED;
            } else if (flagObj.room === undefined) { // room is not in Game.rooms
                result = creep.moveTo(flagObj);
            } else {
                const source = flagObj.pos.findInRange(FIND_SOURCES, 0)[0];
                result = creep.harvest(source);

                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(source, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ffe100',
                            lineStyle: 'undefined',
                            strokeWidth: .15,
                            opacity: .5
                        }
                    });
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
                    result = creep.moveTo(obj, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#00ff00',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
                }
            } else { // find more energy
                const energySupply = FindClosestEnergy(creep, obj);
                const energySupplyType = creep.memory.EnergySupplyType;
                if (energySupply && energySupplyType === 'DROP') {
                    result = creep.pickup(energySupply);
                } else if (energySupply) {
                    result = creep.withdraw(energySupply, RESOURCE_ENERGY);
                } else {
                    result = NO_ENERGY_FOUND; // FindClosestEnergy did not find any energy
                }

                if (result === ERR_NOT_IN_RANGE) {
                    result = creep.moveTo(energySupply, {
                        visualizePathStyle: {
                            fill: 'transparent',
                            stroke: '#ffe100',
                            lineStyle: 'dashed',
                            strokeWidth: .15,
                            opacity: .1
                        }
                    });
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
        function FindClosestEnergy(creep, obj) {
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
                const energySupplies = obj.room.find(FIND_STRUCTURES, {
                    filter: function (s) {
                        return ((s.structureType === STRUCTURE_STORAGE
                            || s.structureType === STRUCTURE_CONTAINER) && s.store[RESOURCE_ENERGY] >= 100
                            || s.structureType === STRUCTURE_LINK && s.energy >= 100);
                    }
                });
                energySupplies.concat(obj.room.find(FIND_DROPPED_RESOURCES, {
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
    }
};
module.exports = ExecuteJobs;