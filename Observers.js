const Observers = {
    run: function () {
        for (const gameRoomKey in Game.rooms) {
            const gameRoom = Game.rooms[gameRoomKey];
            if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8) {
                const observer = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (observer) {
                        return observer.structureType === STRUCTURE_OBSERVER;
                    }
                })[0];
                if(observer){
                    const flagAtObserver = observer.pos.lookFor(LOOK_FLAGS)[0];
                    // observer is dedicated to scanning for power banks or deposits
                    if(flagAtObserver && flagAtObserver.color === COLOR_ORANGE && flagAtObserver.secondaryColor === COLOR_RED){
                        if(!Memory.MemRooms[gameRoomKey].MapScan || Memory.MemRooms[gameRoomKey].MapReScan){
                            if(!Memory.MemRooms[gameRoomKey].MapScan){
                                Memory.MemRooms[gameRoomKey].MapScan = {};
                            }else if(Memory.MemRooms[gameRoomKey].MapReScan){
                                Memory.MemRooms[gameRoomKey].MapReScan = undefined;
                            }
                            const lonLat = gameRoomKey.match(/\d+(?=\D|$)/g);
                            const lonLatQuadrant = gameRoomKey.match(/\D(?=\d)/g);
                            const lon = parseInt(lonLat[0], 10);
                            const lat = parseInt(lonLat[1], 10);
                            let numOfScansFound = 0;
                            for (let o =( -7 + lon); o <= (7 + lon); o++){
                                for (let a = (-7 + lat); a <= (7 + lat); a++){
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
                                        const newScan = modLonQ + modLon + modLatQ + modLat;
                                        if(!Memory.MemRooms[gameRoomKey].MapScan[newScan]){
                                            Memory.MemRooms[gameRoomKey].MapScan[newScan] = '?';
                                        }
                                        numOfScansFound++;
                                    }
                                }
                            }
                            console.log('Observers new scan started ' + observer.pos.roomName + ' found ' + numOfScansFound + ' rooms');
                        }
                        let numOfScansLeft = 0;
                        let hasScanned = false;
                        for(const roomKey in Memory.MemRooms[gameRoomKey].MapScan){
                            let scanStatus = Memory.MemRooms[gameRoomKey].MapScan[roomKey];
                            let deleteScan = false;
                            if(!hasScanned && scanStatus === '?'){ // make a scan
                                hasScanned = true;
                                observer.observeRoom(roomKey);
                                scanStatus = 's';
                                numOfScansLeft++;
                            }else if(scanStatus !== 's' && scanStatus !== '?'){ // check if item is gone
                                if(scanStatus.deadline <= Game.time){
                                    console.log('Observers item gone, removing ' + roomKey + ' ' + JSON.stringify(scanStatus));
                                    deleteScan = true;
                                }
                            }else if(scanStatus === 's' && Game.rooms[roomKey]){ // check in rooms that where scanned last tick
                                const powerBank = Game.rooms[roomKey].find(FIND_STRUCTURES, {
                                    filter: function (structure) {
                                        return structure.structureType === STRUCTURE_POWER_BANK;
                                    }
                                })[0];
                                if(powerBank){
                                    console.log('Observers power bank found! in ' + roomKey);
                                    scanStatus = {'type' : 'powerBank', 'id' : powerBank.id, 'pos' : powerBank.pos, 'deadline' : powerBank.ticksToDecay + Game.time};
                                }else{
                                    const deposit = Game.rooms[roomKey].find(FIND_DEPOSITS)[0];
                                    if(deposit){
                                        console.log('Observers deposit found! in ' + roomKey);
                                        scanStatus = {'type' : 'deposit', 'id' : deposit.id, 'pos' : deposit.pos, 'deadline' : deposit.ticksToDecay + Game.time, 'depositType' : deposit.depositType};
                                    }else{
                                        deleteScan = true;
                                    }
                                }
                                numOfScansLeft++;
                            }
                            if(deleteScan){
                                delete Memory.MemRooms[gameRoomKey].MapScan[roomKey];
                            }else{
                                Memory.MemRooms[gameRoomKey].MapScan[roomKey] = scanStatus;
                            }
                        }
                        if(numOfScansLeft === 0){
                            console.log('Observers MapReScan set to true');
                            Memory.MemRooms[gameRoomKey].MapReScan = true;
                        }
                    }
                }
            }
        }
    }
};
module.exports = Observers;