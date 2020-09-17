let Util = require('Util');
const Constructions = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my) {
                const roomTerrain = gameRoom.getTerrain();
                build(gameRoom, roomTerrain);
            }
        }

        function build(gameRoom, roomTerrain) {
            const level = gameRoom.controller.level;
            if (level >= 1) {
                ConstructContainerAt(gameRoom, roomTerrain, undefined/*source*/);
                if (level >= 2) {
                    ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_EXTENSION);
                    if(Memory.MemRooms[gameRoom.name] && !Memory.MemRooms[gameRoom.name].CtrlConId){
                        ConstructContainerAt(gameRoom, roomTerrain, STRUCTURE_CONTROLLER);
                    }
                    if (level >= 3) {
                        if (Memory.MemRooms[gameRoom.name] && Util.FindNumberOfBuildableStructures(gameRoom, STRUCTURE_TOWER) > Memory.MemRooms[gameRoom.name].TowerIds.length) {
                            ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_TOWER);
                        }
                        ConstructRoads(gameRoom, roomTerrain);
                        if (level >= 4) {
                            if(!gameRoom.storage){
                                ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_STORAGE);
                            }
                            ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_SPAWN);
                            if (level >= 5) {
                                ConstructLinks(gameRoom, roomTerrain);
                                ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_STORAGE);
                                ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_TOWER);
                                if (level >= 6) {
                                    ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_SPAWN);
                                    ConstructExtractor(gameRoom);
                                    ConstructContainerAt(gameRoom, roomTerrain, STRUCTURE_EXTRACTOR);
                                    ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_TERMINAL);
                                    ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_TERMINAL);
                                    ConstructPerimeter(gameRoom, roomTerrain);
                                    ConstructLabs(gameRoom, roomTerrain);
                                    if (level >= 7) {
                                        ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_FACTORY);
                                        ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_FACTORY);
                                        ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_CONTAINER);
                                        if (level === 8) {
                                            ConstructAtStorage(gameRoom, roomTerrain, STRUCTURE_POWER_SPAWN);
                                            ConstructCoreBuilding(gameRoom, roomTerrain, STRUCTURE_OBSERVER);
                                            ConstructRampartsOn(gameRoom, roomTerrain, STRUCTURE_POWER_SPAWN);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        function ConstructContainerAt(gameRoom, terrain, structureType = undefined) {
            if (!structureType) {
                const sources = gameRoom.find(FIND_SOURCES);
                for (const sourceCount in sources) {
                    const source = sources[sourceCount];
                    if (!FindExistingStructure(source.pos, STRUCTURE_CONTAINER, 1)) {
                        ConstructAroundPos(gameRoom, terrain, source.pos, STRUCTURE_CONTAINER);
                    }
                }
            } else {
                const structures = gameRoom.find(FIND_STRUCTURES, {
                    filter: function (structure) {
                        return structure.structureType === structureType;
                    }
                });
                for (const structureCount in structures) {
                    const structure = structures[structureCount];
                    if (!FindExistingStructure(structure.pos, STRUCTURE_CONTAINER, 1)) {
                        ConstructAroundPos(gameRoom, terrain, structure.pos, STRUCTURE_CONTAINER);
                    }
                }
            }
        }

        function ConstructCoreBuilding(gameRoom, roomTerrain, structureType) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, structureType);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const spawn = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            })[0];
            if (spawn) {
                BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, spawn.pos);
            }
        }

        function ConstructRampartsOn(gameRoom, roomTerrain, structureType) {
            const structuresToPlaceRampartOn = gameRoom.find(FIND_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            for (const structuresToPlaceRampartOnCount in structuresToPlaceRampartOn) {
                const structure = structuresToPlaceRampartOn[structuresToPlaceRampartOnCount];
                const structuresOnPos = structure.pos.look();
                let foundRampart = false;
                for (const structuresOnPosCount in structuresOnPos) {
                    const structureOnPos = structuresOnPos[structuresOnPosCount];
                    if (structureOnPos.structure && structureOnPos.structure.structureType === STRUCTURE_RAMPART
                        || structureOnPos.constructionSite && structureOnPos.constructionSite.structureType === STRUCTURE_RAMPART) {
                        foundRampart = true;
                        break;
                    }
                }
                if (!foundRampart) {
                    const result = gameRoom.createConstructionSite(structure.pos.x, structure.pos.y, STRUCTURE_RAMPART);
                    Util.InfoLog('Constructions', 'ConstructRampartsOn', structure.pos + ' to protect ' + structureType + ' result ' + result);
                }
            }
        }

        function ConstructRoads(gameRoom, roomTerrain) {
            let structures = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN
                        || structure.structureType === STRUCTURE_EXTENSION
                        || structure.structureType === STRUCTURE_TOWER
                        || structure.structureType === STRUCTURE_TERMINAL
                        || structure.structureType === STRUCTURE_STORAGE
                        || structure.structureType === STRUCTURE_FACTORY
                        || structure.structureType === STRUCTURE_NUKER
                        || structure.structureType === STRUCTURE_POWER_SPAWN;
                }
            });
            const spawns = [];
            for (const structureCount in structures) {
                const structure = structures[structureCount];
                if (roomTerrain.get(structure.pos.x + 1, structure.pos.y) !== TERRAIN_MASK_WALL) {
                    gameRoom.createConstructionSite(structure.pos.x + 1, structure.pos.y, STRUCTURE_ROAD);
                }
                if (roomTerrain.get(structure.pos.x - 1, structure.pos.y) !== TERRAIN_MASK_WALL) {
                    gameRoom.createConstructionSite(structure.pos.x - 1, structure.pos.y, STRUCTURE_ROAD);
                }
                if (roomTerrain.get(structure.pos.x, structure.pos.y + 1) !== TERRAIN_MASK_WALL) {
                    gameRoom.createConstructionSite(structure.pos.x, structure.pos.y + 1, STRUCTURE_ROAD);
                }
                if (roomTerrain.get(structure.pos.x, structure.pos.y - 1) !== TERRAIN_MASK_WALL) {
                    gameRoom.createConstructionSite(structure.pos.x, structure.pos.y - 1, STRUCTURE_ROAD);
                }
                if (structure.structureType === STRUCTURE_SPAWN) {
                    spawns.push(structure);
                }
            }
            for (const spawnCount in spawns) {
                const spawn = spawns[spawnCount];
                BuildRoadTo(gameRoom, spawn, gameRoom.controller);
                if (gameRoom.storage) {
                    BuildRoadTo(gameRoom, spawn, gameRoom.storage);
                }
                if (gameRoom.terminal) {
                    BuildRoadTo(gameRoom, spawn, gameRoom.terminal);
                }
                const extractor = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (structure) {
                        return structure.structureType === STRUCTURE_EXTRACTOR;
                    }
                })[0];
                if (extractor) {
                    BuildRoadTo(gameRoom, spawn, extractor);
                }
                const sources = gameRoom.find(FIND_SOURCES);
                for (const sourceCount in sources) {
                    const source = sources[sourceCount];
                    BuildRoadTo(gameRoom, spawn, source);
                }
            }
        }

        function ConstructLinks(gameRoom, terrain) {
            if(Memory.MemRooms[gameRoom.name]
                && Memory.MemRooms[gameRoom.name].Links
                && Memory.MemRooms[gameRoom.name].Links.StorageLinkId
                && Memory.MemRooms[gameRoom.name].Links.ControllerLinkId
                && Memory.MemRooms[gameRoom.name].Links.HarvesterLinksId.length >= 2){
                return;
            }
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_LINK);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const container = FindExistingStructure(gameRoom.controller.pos, STRUCTURE_CONTAINER, 1);
            if (container && !FindExistingStructure(container.pos, STRUCTURE_LINK, 1)) {
                const result = ConstructAroundPos(gameRoom, terrain, container.pos, STRUCTURE_LINK);
                if (result === OK) {
                    numberOfPossibleConstructions--;
                    if (numberOfPossibleConstructions <= 0) {
                        return;
                    }
                }
            }
            if (gameRoom.storage && !FindExistingStructure(gameRoom.storage.pos, STRUCTURE_LINK, 1)) {
                const result = ConstructAroundPos(gameRoom, terrain, gameRoom.storage.pos, STRUCTURE_LINK, 1, true);
                if (result === OK) {
                    numberOfPossibleConstructions--;
                    if (numberOfPossibleConstructions <= 0) {
                        return;
                    }
                }
            }
            const sources = gameRoom.find(FIND_SOURCES);
            for (const sourceCount in sources) {
                const source = sources[sourceCount];
                const container = FindExistingStructure(source.pos, STRUCTURE_CONTAINER, 1);
                if (container && !FindExistingStructure(container.pos, STRUCTURE_LINK, 1)) {
                    const result = ConstructAroundPos(gameRoom, terrain, container, STRUCTURE_LINK, 2);
                    if (result === OK) {
                        numberOfPossibleConstructions--;
                        if (numberOfPossibleConstructions <= 0) {
                            return;
                        }
                    }
                }
            }
        }

        function ConstructExtractor(gameRoom) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_EXTRACTOR);
            if (!numberOfPossibleConstructions) {
                return;
            }
            const mineral = gameRoom.find(FIND_MINERALS)[0];
            if (mineral) {
                const look = mineral.pos.look();
                const extractor = _.find(look, function (s) {
                    return s.type === LOOK_STRUCTURES || s.type === LOOK_CONSTRUCTION_SITES;
                }); // can only be extractor or the construction of extractor
                if (!extractor) {
                    const result = gameRoom.createConstructionSite(mineral.pos.x, mineral.pos.y, STRUCTURE_EXTRACTOR);
                    if (result === OK) {
                        Util.InfoLog('Constructions', 'ConstructExtractor', mineral.pos);
                    }
                }
            }
        }

        function ConstructAtStorage(gameRoom, roomTerrain, structureType) {
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, structureType);
            if (!numberOfPossibleConstructions) {
                return;
            }
            if (gameRoom.storage && !FindExistingStructure(gameRoom.storage.pos, structureType, 1)) {
                ConstructAroundPos(gameRoom, roomTerrain, gameRoom.storage.pos, structureType, 1, true);
            }
        }

        function ConstructPerimeter(gameRoom, roomTerrain) {
            // TODO construct perimeter

        }

        function ConstructLabs(gameRoom, roomTerrain){
            // TODO construct labs

        }

        function FindExistingStructure(targetPos, structureType, radius) {
            let structure = targetPos.findInRange(FIND_STRUCTURES, radius, {
                filter: (s) => s.structureType === structureType
            })[0];
            if (!structure) {
                structure = targetPos.findInRange(FIND_CONSTRUCTION_SITES, radius, {
                    filter: (s) => s.structureType === structureType
                })[0];
            }
            return structure;
        }

        function BuildRoadTo(gameRoom, fromStructure, toStructure) {
            const roadConstructions = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_ROAD;
                }
            });
            const pathSteps = gameRoom.findPath(fromStructure.pos, toStructure.pos, {
                swampCost: 5, plainCost: 4, ignoreCreeps: true, range: 1,
                costCallback: function (roomName, costMatrix) {
                    for (const roadConstructionCount in roadConstructions) {
                        const roadConstruction = roadConstructions[roadConstructionCount];
                        costMatrix.set(roadConstruction.pos.x, roadConstruction.pos.y, 1);
                    }
                }
            });
            for (const pathStepCount in pathSteps) {
                const pathStep = pathSteps[pathStepCount];
                const result = gameRoom.createConstructionSite(pathStep.x, pathStep.y, STRUCTURE_ROAD);
                if (result === OK) {
                    Util.InfoLog('Constructions', 'ConstructRoads', 'from ' + fromStructure + ' to ' + (toStructure.structureType ? toStructure.structureType : toStructure.id) + ' ' + pathStep.x + ',' + pathStep.y + ',' + gameRoom.name);
                }
            }
        }

        function ConstructAroundPos(gameRoom, terrain, centerPos, structureType, radius = 1, isCheckered = false) {
            let spawn = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            })[0];
            if (!spawn) {
                spawn = gameRoom.find(FIND_CONSTRUCTION_SITES, {
                    filter: function (structure) {
                        return structure.structureType === STRUCTURE_SPAWN;
                    }
                })[0];
            }
            if (spawn) {
                let bestPos;
                let bestRange = Number.MAX_SAFE_INTEGER;
                for (let y = centerPos.y - radius; y <= centerPos.y + radius; y++) {
                    for (let x = isCheckered ? (((y - centerPos.y) % 2) ? centerPos.x - radius : centerPos.x) : centerPos.x - radius; x <= centerPos.x + radius; (isCheckered ? x = x + 2 : x++)) {
                        const terrainAtPos = terrain.get(x, y);
                        if (terrainAtPos !== TERRAIN_MASK_WALL) {
                            const lookAtObjects = gameRoom.lookAt(x, y);
                            const hasStructure = _.find(lookAtObjects, function (lookObject) {
                                return lookObject.type === LOOK_STRUCTURES || lookObject.type === LOOK_CONSTRUCTION_SITES;
                            });
                            if (!hasStructure) {
                                const range = spawn.pos.findPathTo(x, y);

                                if (!bestPos || range < bestRange) {
                                    bestPos = new RoomPosition(x, y, gameRoom.name);
                                    bestRange = range;
                                }
                            }
                        }
                    }
                }

                if (bestPos) {
                    const result = gameRoom.createConstructionSite(bestPos.x, bestPos.y, structureType);
                    Util.InfoLog('Constructions', 'ConstructAroundPos', bestPos.x + ',' + bestPos.y + ',' + bestPos.roomName + ' structureType ' + structureType + ' result ' + result);
                    return result;
                }
            }
            return -1;
        }

        function BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, buildPosition) {
            let shiftPointer = -1;
            let scanWidth = 3;
            while (numberOfPossibleConstructions) { // try adding constructionSites in a larger pattern
                for (let swy = shiftPointer; swy < scanWidth; swy++) { // scan width pointer for y plane
                    const yp = buildPosition.y + swy;
                    for (let swx = shiftPointer + (shiftPointer % 2 ? (swy % 2 ? 0 : 1) : swy % 2); swx < scanWidth; swx = swx + 2) { // scan width pointer for x plane
                        const xp = buildPosition.x + swx;
                        if (xp < 45 && yp < 45 && xp >= 5 && yp >= 5) {
                            const newBuildPos = new RoomPosition(xp, yp, gameRoom.name);
                            const terrain = roomTerrain.get(newBuildPos.x, newBuildPos.y);
                            if ((!terrain || terrain === 2)) { // plan and swamp is buildable
                                const lookAtObjects = gameRoom.lookAt(newBuildPos.x, newBuildPos.y);
                                const hasStructure = _.find(lookAtObjects, function (lookObject) {
                                    return lookObject.type === LOOK_STRUCTURES || lookObject.type === LOOK_CONSTRUCTION_SITES;
                                });
                                if (!hasStructure) {
                                    let hasNearbyWall = HasNearbyWall(roomTerrain, newBuildPos);
                                    if (!hasNearbyWall) {
                                        const unwantedNearbyStructures = newBuildPos.findInRange(FIND_STRUCTURES, 1, {
                                            filter: function (structure) {
                                                return structure.structureType !== STRUCTURE_SPAWN
                                                    && structure.structureType !== STRUCTURE_EXTENSION
                                                    && structure.structureType !== STRUCTURE_TOWER
                                                    && structure.structureType !== STRUCTURE_CONTAINER
                                                    && structure.structureType !== STRUCTURE_ROAD;
                                            }
                                        });
                                        if (unwantedNearbyStructures.length === 0) {
                                            const nearbySources = newBuildPos.findInRange(FIND_SOURCES, 1);
                                            if (nearbySources.length === 0) {
                                                const nearbyMineral = newBuildPos.findInRange(FIND_MINERALS, 1);
                                                if (nearbyMineral.length === 0) {
                                                    const result = gameRoom.createConstructionSite(newBuildPos.x, newBuildPos.y, structureType);
                                                    if (result === OK) {
                                                        Util.InfoLog('Constructions', 'buildExtensions', gameRoom.name + ' at (' + newBuildPos.x + ',' + newBuildPos.y + ')');
                                                        numberOfPossibleConstructions--;
                                                        if (numberOfPossibleConstructions <= 0) {
                                                            return;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                shiftPointer--; //move the placement pattern further out
                scanWidth = scanWidth + 2;
            }
        }

        /**@return {boolean}*/
        function HasNearbyWall(terrain, pos) {
            for (let terrainX = pos.x - 1; terrainX <= pos.x + 1; terrainX++) {
                for (let terrainY = pos.y - 1; terrainY <= pos.y + 1; terrainY++) {
                    const NearbyTerrain = terrain.get(terrainX, terrainY);
                    if (NearbyTerrain === TERRAIN_MASK_WALL) {
                        return true;
                    }
                }
            }
            return false;
        }

        /**@return {Number}*/
        function GetNumberOfPossibleConstructions(gameRoom, structureType) {
            const numberOfBuildableStructures = Util.FindNumberOfBuildableStructures(gameRoom, structureType);
            const structure = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            const structureConstructionSites = gameRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            return numberOfBuildableStructures - (structure.length + structureConstructionSites.length);
        }


    }
};
module.exports = Constructions;