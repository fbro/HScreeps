let Util = require('Util');
const Constructions = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my){
                const roomTerrain = gameRoom.getTerrain();
                build(gameRoom, roomTerrain);
            }
        }


        function build(gameRoom, roomTerrain){
            buildExtensions(gameRoom, roomTerrain);
            buildTowers(gameRoom, roomTerrain);

        }

        function buildExtensions(gameRoom, roomTerrain){
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_EXTENSION);
            if(!numberOfPossibleConstructions){
                return;
            }
            const spawns = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            });
            BuildCheckeredPattern(gameRoom, STRUCTURE_EXTENSION, roomTerrain, numberOfPossibleConstructions, spawns[0].pos);
        }

        function buildTowers(gameRoom, roomTerrain){
            let numberOfPossibleConstructions = GetNumberOfPossibleConstructions(gameRoom, STRUCTURE_TOWER);
            if(!numberOfPossibleConstructions){
                return;
            }
            const spawns = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === STRUCTURE_SPAWN;
                }
            });
            BuildCheckeredPattern(gameRoom, STRUCTURE_TOWER, roomTerrain, numberOfPossibleConstructions, spawns[0].pos);
        }

        function BuildCheckeredPattern(gameRoom, structureType, roomTerrain, numberOfPossibleConstructions, buildPosition){
            let shiftPointer = -1;
            let scanWidth = 3;
            while(numberOfPossibleConstructions) { // try adding constructionSites in a larger pattern
                for(let swy = shiftPointer; swy < scanWidth; swy++){ // scan width pointer for y plane
                    const yp = buildPosition.pos.y + swy;
                    for(let swx = shiftPointer + (shiftPointer % 2 ? (swy % 2 ? 0 : 1) : 0); swx < scanWidth; swx = swx + 2){ // scan width pointer for x plane
                        const xp = buildPosition.pos.x + swx;
                        const terrain = roomTerrain.get(xp, yp);
                        if((!terrain || terrain === 2)){ // plan and swamp is buildable
                            const lookAtObjects = gameRoom.lookAt(xp, yp);
                            const hasStructure = _.find(lookAtObjects, function(lookObject){return lookObject.type === LOOK_STRUCTURES || lookObject.type === LOOK_CONSTRUCTION_SITES;});
                            if(!hasStructure){
                                // TODO is near controller, source, mineral or exits then skip - maybe also walls to avoid blocking tight spots ?
                                const result = gameRoom.createConstructionSite(xp, yp, structureType);
                                if(result === OK){
                                    Util.InfoLog('Constructions', 'buildExtensions' ,gameRoom.name + ' at (' + xp + ',' + yp + ')');
                                    numberOfPossibleConstructions--;
                                    if(numberOfPossibleConstructions <= 0){
                                        return;
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

        /**@return {Number}*/
        function GetNumberOfPossibleConstructions(gameRoom, structureType){
            const numberOfBuildableStructures = FindNumberOfBuildableStructures(gameRoom, structureType);
            const extensions = gameRoom.find(FIND_MY_STRUCTURES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            const extensionConstructionSites = gameRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: function (structure) {
                    return structure.structureType === structureType;
                }
            });
            //Util.Info('Constructions', 'GetNumberOfPossibleConstructions', 'numberOfBuildableStructures ' + numberOfBuildableStructures + ' extensions.length ' + extensions.length + ' extensionConstructionSites.length ' + extensionConstructionSites.length);
            return numberOfBuildableStructures - (extensions.length + extensionConstructionSites.length);
        }

        /**@return {number}*/
        function FindNumberOfBuildableStructures(gameRoom, structureType) {
            switch (true){
                case structureType === STRUCTURE_EXTENSION:
                    switch (gameRoom.controller.level){
                        case 1:
                            return 0;
                        case 2:
                            return 5;
                        case 3:
                            return 10;
                        case 4:
                            return 20;
                        case 5:
                            return 30;
                        case 6:
                            return 40;
                        case 7:
                            return 50;
                        case 8:
                            return 60;
                        default:
                            Util.ErrorLog('Constructions', 'FindNumberOfBuildableStructures' ,'controller.level ' + gameRoom.controller.level + ' not found ' + gameRoom.name + ' structureType ' + structureType);
                    }
                    break;
                case structureType === STRUCTURE_TOWER:
                    switch (gameRoom.controller.level){
                        case 1:
                            return 0;
                        case 2:
                            return 0;
                        case 3:
                            return 1;
                        case 4:
                            return 1;
                        case 5:
                            return 2;
                        case 6:
                            return 2;
                        case 7:
                            return 3;
                        case 8:
                            return 6;
                        default:
                            Util.ErrorLog('Constructions', 'FindNumberOfBuildableStructures' ,'controller.level ' + gameRoom.controller.level + ' not found ' + gameRoom.name + ' structureType ' + structureType);
                    }
                    break;
                default:
                    Util.ErrorLog('Constructions', 'FindNumberOfBuildableStructures' ,'structureType not found ' + gameRoom.name + ' structureType ' + structureType);
            }
        }
    }
};
module.exports = Constructions;