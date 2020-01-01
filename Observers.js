let Logs = require('Logs');
const Observers = {
    run: function (gameRoom, gameRoomKey) {
        ObserversActions(gameRoom, gameRoomKey);


        function ObserversActions(gameRoom, gameRoomKey) {
            if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8) {
                const observer = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (observer) {
                        return observer.structureType === STRUCTURE_OBSERVER;
                    }
                })[0];
                if (observer) {
                    const flagAtObserver = observer.pos.lookFor(LOOK_FLAGS)[0];
                    // observer is dedicated to scanning for power banks or deposits
                    if (Memory.MemRooms[gameRoomKey] && flagAtObserver && flagAtObserver.color === COLOR_ORANGE) {
                        //Memory.MemRooms[gameRoomKey].MapScan = undefined;
                        //Memory.MemRooms[gameRoomKey].powerBankFlag = undefined;
                        //Memory.MemRooms[gameRoomKey].depositFlag = undefined;
                        //Memory.MemRooms[gameRoomKey].MapReScan = undefined;
                        if (!Memory.MemRooms[gameRoomKey].MapScan || Memory.MemRooms[gameRoomKey].MapReScan) {
                            CreateScan(gameRoomKey);
                        }
                        if (flagAtObserver.secondaryColor === COLOR_RED) {
                            ScanPowerBanksAndDeposits(gameRoomKey, observer);
                        }
                    }
                }
            }
        }

        function CreateScan(gameRoomKey) {
            if (!Memory.MemRooms[gameRoomKey].MapScan) {
                Memory.MemRooms[gameRoomKey].MapScan = {};
            } else if (Memory.MemRooms[gameRoomKey].MapReScan) {
                Memory.MemRooms[gameRoomKey].MapReScan = undefined;
            }
            const lonLat = gameRoomKey.match(/\d+(?=\D|$)/g);
            const lonLatQuadrant = gameRoomKey.match(/\D(?=\d)/g);
            const lon = parseInt(lonLat[0], 10);
            const lat = parseInt(lonLat[1], 10);
            let numOfScansFound = 0;
            for (let o = (-4 + lon); o <= (4 + lon); o++) {
                for (let a = (-5 + lat); a <= (5 + lat); a++) {
                    let modLonQ = lonLatQuadrant[0];
                    let modLatQ = lonLatQuadrant[1];
                    let modLon = o;
                    let modLat = a;
                    if (modLon < 0) {
                        if (modLonQ === 'W') {
                            modLonQ = 'E';
                        } else {
                            modLonQ = 'W'
                        }
                        modLon = Math.abs(modLon) - 1;
                    }
                    if (modLat < 0) {
                        if (modLatQ === 'S') {
                            modLatQ = 'N';
                        } else {
                            modLatQ = 'S'
                        }
                        modLat = Math.abs(modLat) - 1;
                    }
                    if (modLon % 10 === 0 || modLat % 10 === 0) { // only neutral empty rooms that divide living sectors on the map
                        const newScan = modLonQ + modLon + modLatQ + modLat;
                        if (Memory.MemRooms[gameRoomKey].MapScan[newScan] === 's' || !Memory.MemRooms[gameRoomKey].MapScan[newScan]) {
                            Memory.MemRooms[gameRoomKey].MapScan[newScan] = '?';
                        }
                        numOfScansFound++;
                    }
                }
            }
        }

        function ScanPowerBanksAndDeposits(gameRoomKey, observer) {
            let numOfScansLeft = 0;
            let hasScanned = false;
            for (const roomKey in Memory.MemRooms[gameRoomKey].MapScan) {
                let scanStatus = Memory.MemRooms[gameRoomKey].MapScan[roomKey];
                let deleteScan = false;
                if (!hasScanned && scanStatus === '?') { // make a scan
                    observer.observeRoom(roomKey);
                    hasScanned = true;
                    scanStatus = 's';
                    numOfScansLeft++;
                } else if (scanStatus !== 's' && scanStatus !== '?') { // check if item is gone
                    deleteScan = true;
                    let targetCount = 0;
                    while(targetCount < scanStatus.length){
                        const target = scanStatus[targetCount];
                        deleteScan = false;
                        const hallwayRoom = Game.rooms[roomKey];
                        let shouldRemoveTarget = false;
                        if(hallwayRoom){ // hallway room is visible - now one can look at more than deadline
                            if(target.type === 'powerBank') {
                                const droppedPowerResource = hallwayRoom.find(FIND_DROPPED_RESOURCES, {filter: function (r) {return r.resourceType === RESOURCE_POWER;}})[0];
                                if(target.deadline <= Game.time && !droppedPowerResource){
                                    shouldRemoveTarget = true;
                                }
                            }else if(target.type === 'deposit'){
                                const deposit = hallwayRoom.find(FIND_DEPOSITS)[0];
                                if(deposit){
                                    target.lastCooldown = deposit.lastCooldown;
                                }
                                if(target.deadline <= Game.time || !deposit || target.lastCooldown >= 70){
                                    shouldRemoveTarget = true;
                                }
                            }
                        }else if(target.deadline <= Game.time) { // hallway room is invisible and deadline has gone
                            shouldRemoveTarget = true;
                        }
                        if (shouldRemoveTarget) {
                            DeleteFlag(target.type, roomKey, target.freeSpaces);
                            scanStatus.splice(targetCount, 1);
                        }else{
                            if(target.type === 'powerBank'){
                                AddFlag(target, COLOR_ORANGE, COLOR_PURPLE);
                            }else if(target.type === 'deposit'){
                                AddFlag(target, COLOR_ORANGE, COLOR_CYAN);
                            }
                            targetCount++;
                        }
                    }
                } else if (scanStatus === 's' && Game.rooms[roomKey]) { // check in rooms that where scanned last tick
                    const walls = Game.rooms[roomKey].find(FIND_STRUCTURES, { // if any walls are present the rooms resources might be walled off - better to just ignore the room!
                        filter: function (s) {
                            return s.structureType === STRUCTURE_WALL;
                        }
                    });
                    if (walls[0]) {
                        deleteScan = true;
                    } else {
                        scanStatus = [];
                        const powerBank = TryAddPowerBank(roomKey, observer);
                        if(powerBank){
                            scanStatus.push(powerBank);
                            AddFlag(powerBank, COLOR_ORANGE, COLOR_PURPLE)
                        }
                        const deposit = TryAddDeposit(roomKey, observer);
                        if(deposit){
                            scanStatus.push(deposit);
                            AddFlag(deposit, COLOR_ORANGE, COLOR_CYAN)
                        }
                        if(!powerBank && !deposit){
                            deleteScan = true;
                        }
                        numOfScansLeft++;
                    }
                }
                if (deleteScan) {
                    delete Memory.MemRooms[gameRoomKey].MapScan[roomKey];
                } else {
                    Memory.MemRooms[gameRoomKey].MapScan[roomKey] = scanStatus;
                }
            }
            if (numOfScansLeft === 0) {
                Memory.MemRooms[gameRoomKey].MapReScan = true;
            }
        }

        function AddFlag(target, primaryColor, secondaryColor){
            // only one flag per type - depositFlag or powerBankFlag
            if (target.type === 'deposit') {
                if(!Memory.MemRooms[gameRoomKey].depositFlag){
                    if(target.lastCooldown < 70){
                        Memory.MemRooms[gameRoomKey].depositFlag = target.pos;
                        Game.rooms[target.pos.roomName].createFlag(target.pos, target.type + '_' + target.pos.roomName + '-' + target.freeSpaces, primaryColor, secondaryColor);
                        console.log('Observers AddFlag ' + target.pos.roomName + ' ' + target.type + ' ' + target.pos + ' ' + target.freeSpaces + ' ' + primaryColor + ' ' + secondaryColor);
                    }else{
                        console.log('Observers AddFlag tried to add ' + target.pos.roomName + ' ' + target.type + ' ' + target.pos + ' ' + target.freeSpaces + ' ' + primaryColor + ' ' + secondaryColor + ' ' + target.type + ' lastCooldown ' + target.lastCooldown);
                    }
                }else{
                    //console.log('Observers AddFlag tried to add ' + target.pos.roomName + ' ' + target.type + ' ' + target.pos + ' ' + target.freeSpaces + ' ' + primaryColor + ' ' + secondaryColor + ' ' + target.type + ' flag is already created');
                }
            }else if(target.type === 'powerBank'){
                if(!Memory.MemRooms[gameRoomKey].powerBankFlag){
                    if((target.deadline - 4000) > Game.time && Game.rooms[target.pos.roomName]){
                        Memory.MemRooms[gameRoomKey].powerBankFlag = target.pos;
                        Game.rooms[target.pos.roomName].createFlag(target.pos, target.type + '_' + target.pos.roomName + '-' + target.freeSpaces, primaryColor, secondaryColor);
                        console.log('Observers AddFlag ' + target.pos.roomName + ' ' + target.type + ' ' + target.pos + ' ' + target.freeSpaces + ' ' + primaryColor + ' ' + secondaryColor);
                    }else{
                        //console.log('Observers AddFlag tried to add ' + target.pos.roomName + ' ' + target.type + ' ' + target.pos + ' ' + target.freeSpaces + ' ' + primaryColor + ' ' + secondaryColor + ' ' + target.type + ' deadline ' + (target.deadline - Game.time));
                    }
                }else{
                    //console.log('Observers AddFlag tried to add ' + target.pos.roomName + ' ' + target.type + ' ' + target.pos + ' ' + target.freeSpaces + ' ' + primaryColor + ' ' + secondaryColor + ' ' + target.type + ' flag is already created');
                }
            }
            else{
                Logs.Error('Observers ScanPowerBanksAndDeposits wrong target.type', target.type);
            }
        }

        function DeleteFlag(flagType, roomKey, freeSpaces){ // remove the flag and remove the flag in memory
            const flagName = flagType + '_' + roomKey + '-' + freeSpaces;
            const flagToRemove = Game.flags[flagName];
            if (flagType === 'powerBank' && Memory.MemRooms[gameRoomKey].powerBankFlag && Memory.MemRooms[gameRoomKey].powerBankFlag.roomName === roomKey) {
                Memory.MemRooms[gameRoomKey].powerBankFlag = undefined;
                console.log('Observers DeleteFlag removed powerBankFlag memory in ' + gameRoomKey);
            } else if (flagType === 'deposit' && Memory.MemRooms[gameRoomKey].depositFlag && Memory.MemRooms[gameRoomKey].depositFlag.roomName === roomKey) {
                Memory.MemRooms[gameRoomKey].depositFlag = undefined;
                console.log('Observers DeleteFlag removed depositFlag memory in ' + gameRoomKey);
            }
            if(flagToRemove){
                Logs.Info('observers DeleteFlag', flagName);
                flagToRemove.remove();
            }else{
                console.log('Observers DeleteFlag could not delete flag');
            }
        }

        function TryAddDeposit(roomKey, observer){ // room need to be visible!
            if(Game.rooms[roomKey]){
                const deposit = Game.rooms[roomKey].find(FIND_DEPOSITS, {filter: function (deposit) {return deposit.lastCooldown < 70;}})[0];
                if (deposit) {
                    const freeSpaces = FreeSpaces(deposit.pos);
                    const depositScan = {
                        'type': 'deposit',
                        'id': deposit.id,
                        'pos': deposit.pos,
                        'deadline': deposit.ticksToDecay + Game.time,
                        'depositType': deposit.depositType,
                        'lastCooldown': deposit.lastCooldown,
                        'freeSpaces': freeSpaces,
                        'observerId': observer.id
                    };
                    console.log('Observers AddDeposit found! in ' + roomKey + ' ' + JSON.stringify(depositScan));
                    return depositScan;
                }
            }
        }

        function TryAddPowerBank(roomKey, observer){ // room need to be visible!
            if(Game.rooms[roomKey]){
                const powerBank = Game.rooms[roomKey].find(FIND_STRUCTURES, {filter: function (powerBank) {return powerBank.structureType === STRUCTURE_POWER_BANK && powerBank.ticksToDecay > 0;}})[0];
                if (powerBank) {
                    const freeSpaces = FreeSpaces(powerBank.pos);
                    const powerBankScan = {
                        'type': 'powerBank',
                        'id': powerBank.id,
                        'pos': powerBank.pos,
                        'deadline': powerBank.ticksToDecay + Game.time,
                        'freeSpaces': freeSpaces,
                        'observerId': observer.id
                    };
                    console.log('Observers AddPowerBank found! in ' + roomKey + ' ' + JSON.stringify(powerBankScan));
                    return powerBankScan;
                }
            }
        }

        /**@return {number}*/
        function FreeSpaces(pos) { // get the number of free spaces around the power bank or deposit
            let freeSpaces = 0;
            const terrain = Game.map.getRoomTerrain(pos.roomName);
            for (let x = pos.x - 1; x <= pos.x + 1; x++) {
                for (let y = pos.y - 1; y <= pos.y + 1; y++) {
                    const t = terrain.get(x, y);
                    if (t === 0 && (pos.x !== x || pos.y !== y)) {
                        freeSpaces++;
                    }
                }
            }
            return freeSpaces;
        }
    }
};
module.exports = Observers;