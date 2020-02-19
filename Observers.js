let Util = require('Util');
const Observers = {
    run: function (gameRoom, observerRoomKey) {
        ObserversActions(gameRoom, observerRoomKey);

        function ObserversActions(gameRoom, observerRoomKey) {
            if (gameRoom.controller && gameRoom.controller.my && gameRoom.controller.level === 8) {
                const observer = gameRoom.find(FIND_MY_STRUCTURES, {
                    filter: function (observer) {
                        return observer.structureType === STRUCTURE_OBSERVER;
                    }
                })[0];
                if (observer) {
                    const flagAtObserver = observer.pos.lookFor(LOOK_FLAGS)[0];
                    // observer is dedicated to scanning for power banks or deposits
                    if (Memory.MemRooms[observerRoomKey] && flagAtObserver && flagAtObserver.color === COLOR_ORANGE) {
                        //Memory.MemRooms[observerRoomKey].MapScan = undefined;
                        //Memory.MemRooms[observerRoomKey].PowerBankFlag = undefined;
                        //Memory.MemRooms[observerRoomKey].DepositFlag = undefined;
                        //Memory.MemRooms[observerRoomKey].MapReScan = undefined;
                        if (!Memory.MemRooms[observerRoomKey].MapScan || Memory.MemRooms[observerRoomKey].MapReScan) {
                            CreateScan(observerRoomKey);
                        }
                        if (flagAtObserver.secondaryColor === COLOR_RED) {
                            ScanPowerBanksAndDeposits(observerRoomKey, observer);
                        }
                    }
                }
            }
        }

        function CreateScan(observerRoomKey) {
            if (!Memory.MemRooms[observerRoomKey].MapScan) {
                Memory.MemRooms[observerRoomKey].MapScan = {};
            } else if (Memory.MemRooms[observerRoomKey].MapReScan) {
                Memory.MemRooms[observerRoomKey].MapReScan = undefined;
            }
            const lonLat = observerRoomKey.match(/\d+(?=\D|$)/g);
            const lonLatQuadrant = observerRoomKey.match(/\D(?=\d)/g);
            const lon = parseInt(lonLat[0], 10);
            const lat = parseInt(lonLat[1], 10);
            let numOfScansFound = 0;
            for (let o = (-Util.OBSERVER_SCAN_RADIUS_POWER_DEPOSIT + lon); o <= (Util.OBSERVER_SCAN_RADIUS_POWER_DEPOSIT + lon); o++) {
                for (let a = (-Util.OBSERVER_SCAN_RADIUS_POWER_DEPOSIT + lat); a <= (Util.OBSERVER_SCAN_RADIUS_POWER_DEPOSIT + lat); a++) {
                    let modLonQ = lonLatQuadrant[0];
                    let modLatQ = lonLatQuadrant[1];
                    let modLon = o;
                    let modLat = a;
                    if (modLon < 0) {
                        if (modLonQ === 'W') {
                            modLonQ = 'E';
                        } else {
                            modLonQ = 'W';
                        }
                        modLon = Math.abs(modLon) - 1;
                    }
                    if (modLat < 0) {
                        if (modLatQ === 'S') {
                            modLatQ = 'N';
                        } else {
                            modLatQ = 'S';
                        }
                        modLat = Math.abs(modLat) - 1;
                    }
                    if (modLon % 10 === 0 || modLat % 10 === 0) { // only neutral empty rooms that divIde living sectors on the map
                        const newScan = modLonQ + modLon + modLatQ + modLat;
                        if (Memory.MemRooms[observerRoomKey].MapScan[newScan] === 's' || !Memory.MemRooms[observerRoomKey].MapScan[newScan]) {
                            Memory.MemRooms[observerRoomKey].MapScan[newScan] = '?';
                        }
                        numOfScansFound++;
                    }
                }
            }
        }

        function ScanPowerBanksAndDeposits(observerRoomKey, observer) {
            let numOfScansLeft = 0;
            let hasScanned = false;
            const observerRoom = Memory.MemRooms[observerRoomKey];
            for (const roomKey in observerRoom.MapScan) {
                let scanStatus = observerRoom.MapScan[roomKey];
                if (!hasScanned && scanStatus === '?') { // make a scan
                    observer.observeRoom(roomKey);
                    hasScanned = true;
                    observerRoom.MapScan[roomKey] = 's';
                    numOfScansLeft++;
                } else if (hasScanned && scanStatus === '?') {
                    numOfScansLeft++;
                } else if (scanStatus === 's' && Game.rooms[roomKey]) { // check in rooms that where scanned last tick
                    const walls = Game.rooms[roomKey].find(FIND_STRUCTURES, { // if any walls are present the rooms resources might be walled off - better to just ignore the room!
                        filter: function (s) {
                            return s.structureType === STRUCTURE_WALL;
                        }
                    });
                    let shouldVacateHallway = false;
                    if (walls[0]) { // other factors could be added here like hostile creeps
                        shouldVacateHallway = true;
                    }

                    // PowerBankFlag
                    if (!observerRoom.PowerBankFlag) {
                        const powerBank = LookForPowerBank(roomKey, observer, observerRoomKey);
                        if (powerBank && (powerBank.Deadline - 4000) > Game.time && !shouldVacateHallway && powerBank.FreeSpaces >= 2) {
                            observerRoom.PowerBankFlag = powerBank;
                            const result = Game.rooms[powerBank.pos.roomName].createFlag(powerBank.pos, CreateFlagName(powerBank.Type, powerBank.pos.roomName, observerRoomKey), COLOR_ORANGE, COLOR_PURPLE);
                            Util.Info('Observers', 'ScanPowerBanksAndDeposits', 'add ' + powerBank.pos.roomName + ' ' + powerBank.Type + ' ' + powerBank.pos + ' ' + powerBank.FreeSpaces + ' result ' + result);
                        }
                    } else if (observerRoom.PowerBankFlag
                        && (observerRoom.PowerBankFlag.Deadline < Game.time
                            || observerRoom.PowerBankFlag.pos.roomName === roomKey &&
                                (!Game.rooms[roomKey].lookForAt(LOOK_STRUCTURES, observerRoom.PowerBankFlag.pos.x, observerRoom.PowerBankFlag.pos.y)[0]
                                || !Game.rooms[roomKey].lookForAt(LOOK_FLAGS, observerRoom.PowerBankFlag.pos.x, observerRoom.PowerBankFlag.pos.y)[0])
                        )) {
                        Util.Info('Observers', 'ScanPowerBanksAndDeposits', 'delete ' + JSON.stringify(observerRoom.PowerBankFlag));
                        delete observerRoom.PowerBankFlag;
                    }

                    const deposits = Game.rooms[roomKey].find(FIND_DEPOSITS, {
                        filter: function (deposit) {
                            return deposit.lastCooldown < Util.DEPOSIT_MAX_LAST_COOLDOWN;
                        }
                    });
                    for(const depositKey in deposits){
                        const deposit = deposits[depositKey];
                        if(!deposit.pos.lookFor(LOOK_FLAGS)[0]){ // if there are no flags on deposit then add a flag
                            const result = Game.rooms[deposit.pos.roomName].createFlag(deposit.pos, CreateFlagName('deposit', deposit.pos.roomName, observerRoomKey), COLOR_ORANGE, COLOR_CYAN);
                            Util.Info('Observers', 'ScanPowerBanksAndDeposits', 'add ' + deposit.pos.roomName + ' ' + 'deposit' + ' ' + deposit.pos + ' ' + deposit.FreeSpaces + ' result ' + result);
                        }
                    }

                    numOfScansLeft++;
                    delete observerRoom.MapScan[roomKey];
                }
            }
            if (numOfScansLeft === 0) {
                observerRoom.MapReScan = true;
            }
        }

        function LookForPowerBank(roomKey, observer, observerRoomKey) { // room need to be visible!
            if (Game.rooms[roomKey]) {
                const powerBank = Game.rooms[roomKey].find(FIND_STRUCTURES, {
                    filter: function (powerBank) {
                        return powerBank.structureType === STRUCTURE_POWER_BANK && powerBank.ticksToDecay > 0;
                    }
                })[0];
                if (powerBank && !powerBank.pos.lookFor(LOOK_FLAGS)[0]) { // only add flag if no other powerBank flags are present
                    const freeSpaces = Util.FreeSpaces(powerBank.pos);
                    const powerBankScan = {
                        'Type': 'powerBank',
                        'Id': powerBank.id,
                        'pos': powerBank.pos,
                        'Deadline': powerBank.ticksToDecay + Game.time,
                        'FreeSpaces': freeSpaces,
                        'ObserverId': observer.id,
                        'FlagName': CreateFlagName('powerBank', roomKey, observerRoomKey),
                        'Power': powerBank.power
                    };
                    return powerBankScan;
                }
            }
        }

        /**@return {string}*/
        function CreateFlagName(flagType, roomKey, observerRoomKey) {
            return flagType + '_' + roomKey + '_' + observerRoomKey;
        }
    }
};
module.exports = Observers;