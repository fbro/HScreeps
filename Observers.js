const Observers = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8) {
                const observer = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (observer) {
                        return observer.structureType === STRUCTURE_OBSERVER;
                    }
                })[0];//gameFlag.color === COLOR_ORANGE && gameFlag.secondaryColor === COLOR_RED
                if(observer){
                    const flagAtObserver = observer.pos.lookFor(LOOK_FLAGS)[0];
                    // observer is dedicated to scanning for power
                    if(flagAtObserver && flagAtObserver.color === COLOR_ORANGE && flagAtObserver.secondaryColor === COLOR_RED){
                        if(!Memory.MemRooms[gameRoomKey].MapScan){
                            Memory.MemRooms[gameRoomKey].MapScan = {};
                            const lonLat = gameRoomKey.match(/\d+(?=\D|$)/g);
                            const lonLatQuadrant = gameRoomKey.match(/\D(?=\d)/g);
                            const lon = parseInt(lonLat[0], 10);
                            const lat = parseInt(lonLat[1], 10);
                            let numOfRoomsFound = 0;
                            for (let o =( -5 + lon); o <= (5 + lon); o++){
                                for (let a = (-5 + lat); a <= (5 + lat); a++){
                                    let modLonQ = lonLatQuadrant[0];
                                    let modLatQ = lonLatQuadrant[1];
                                    let modLon = o;
                                    let modLat = a;
                                    if(modLon < 0){
                                        if(modLonQ === 'W'){modLonQ = 'E';}else{modLonQ = 'W'}
                                        modLon = Math.abs(modLon) - 1;
                                    }
                                    if(modLat < 0){
                                        if(modLatQ === 'S'){modLatQ = 'N';}else{modLatQ = 'S'}
                                        modLat = Math.abs(modLat) - 1;
                                    }
                                    if(modLon % 10 === 0 || modLat % 10 === 0){ // only neutral empty rooms that divide living sectors on the map
                                        Memory.MemRooms[gameRoomKey].MapScan[modLonQ + modLon + modLatQ + modLat] = '?';
                                        numOfRoomsFound++;
                                    }
                                }
                            }
                            console.log('Observers power reset ' + observer.pos.roomName + ' found ' + numOfRoomsFound);
                        }
                        for(const roomKey in Memory.MemRooms[gameRoomKey].MapScan){
                            const scanStatus = Memory.MemRooms[gameRoomKey].MapScan[roomKey];
                            if(scanStatus === '?'){
                                observer.observeRoom(roomKey);
                                console.log('Observers power observing ' + roomKey);
                                Memory.MemRooms[gameRoomKey].MapScan[roomKey] = 'scanned';
                                break;
                            }else if(scanStatus !== 'scanned'){
                                const powerBank = Game.getObjectById(scanStatus);
                                if(!powerBank){
                                    console.log('Observers power powerbank gone, removing ' + roomKey + ' id ' + scanStatus);
                                    delete Memory.MemRooms[gameRoomKey].MapScan[roomKey]; // TODO cannot get object when room is invisible :(
                                }
                            }
                        }
                        for(const roomKey in Memory.MemRooms[gameRoomKey].MapScan){
                            const scanStatus = Memory.MemRooms[gameRoomKey].MapScan[roomKey];
                            if(scanStatus === 'scanned' && Game.rooms[roomKey]){
                                const powerBank = Game.rooms[roomKey].find(FIND_STRUCTURES, {
                                    filter: function (structure) {
                                        return structure.structureType === STRUCTURE_POWER_BANK;
                                    }
                                })[0];
                                if(powerBank){
                                    console.log('Observers power bank found! in ' + roomKey);
                                    Memory.MemRooms[gameRoomKey].MapScan[roomKey] = powerBank.id;
                                }else{
                                    console.log('Observers power removing ' + roomKey);
                                    delete Memory.MemRooms[gameRoomKey].MapScan[roomKey];
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
};
module.exports = Observers;