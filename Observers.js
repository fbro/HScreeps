let Util = require('Util');
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
                        //Memory.MemRooms[gameRoomKey].PowerBankFlag = undefined;
                        //Memory.MemRooms[gameRoomKey].DepositFlag = undefined;
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
                    if (modLon % 10 === 0 || modLat % 10 === 0) { // only neutral empty rooms that divIde living sectors on the map
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
                if (!hasScanned && scanStatus === '?') { // make a scan
                    observer.observeRoom(roomKey);
                    hasScanned = true;
                    Memory.MemRooms[gameRoomKey].MapScan[roomKey] = 's';
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
                    if (!Memory.MemRooms[gameRoomKey].PowerBankFlag) {
                        const powerBank = LookForPowerBank(roomKey, observer);
                        if (powerBank && (powerBank.Deadline - 4000) > Game.time && !shouldVacateHallway && powerBank.FreeSpaces >= 2) {
                            Memory.MemRooms[gameRoomKey].PowerBankFlag = powerBank;
                            const result = Game.rooms[powerBank.pos.roomName].createFlag(powerBank.pos, CreateFlagName(powerBank.Type, powerBank.pos.roomName, powerBank.FreeSpaces), COLOR_ORANGE, COLOR_PURPLE);
                            Util.Info('Observers','ScanPowerBanksAndDeposits', 'add ' + powerBank.pos.roomName + ' ' + powerBank.Type + ' ' + powerBank.pos + ' ' + powerBank.FreeSpaces + ' ' + COLOR_ORANGE + ' ' + COLOR_PURPLE + ' result ' + result);
                        }
                    } else if (Memory.MemRooms[gameRoomKey].PowerBankFlag
                        && (Memory.MemRooms[gameRoomKey].PowerBankFlag.Deadline < Game.time
                            || Memory.MemRooms[gameRoomKey].PowerBankFlag.pos.roomName === roomKey
                            && (!Game.rooms[roomKey].find(FIND_STRUCTURES, {
                                    filter: function (pb) {
                                        return pb.structureType === STRUCTURE_POWER_BANK;
                                    }
                                })[0]
                                && !Game.rooms[roomKey].find(FIND_DROPPED_RESOURCES, {
                                    filter: function (r) {
                                        return r.resourceType === RESOURCE_POWER;
                                    }
                                })[0]
                                && !Game.rooms[roomKey].find(FIND_RUINS)[0]))) {
                        DeleteFlag(Memory.MemRooms[gameRoomKey].PowerBankFlag.FlagName);
                    }else{
                        const leftoverFlag = Game.rooms[roomKey].find(FIND_FLAGS)[0];
                        if(leftoverFlag && leftoverFlag.color === COLOR_ORANGE && leftoverFlag.secondaryColor === COLOR_PURPLE
                            && leftoverFlag.name !== Memory.MemRooms[gameRoomKey].PowerBankFlag.FlagName){
                            Util.ErrorLog('Observers', 'ScanPowerBanksAndDeposits', 'remove leftoverFlag ' + leftoverFlag.name);
                            leftoverFlag.remove();
                        }
                    }

                    // DepositFlag
                    if (!Memory.MemRooms[gameRoomKey].DepositFlag) {
                        const deposit = LookForDeposit(roomKey, observer);
                        if (deposit) {
                            if (deposit.LastCooldown < 70 && !shouldVacateHallway) {
                                Memory.MemRooms[gameRoomKey].DepositFlag = deposit;
                                const result = Game.rooms[deposit.pos.roomName].createFlag(deposit.pos, CreateFlagName(deposit.Type, deposit.pos.roomName, deposit.FreeSpaces), COLOR_ORANGE, COLOR_CYAN);
                                Util.Info('Observers', 'ScanPowerBanksAndDeposits', 'add ' + deposit.pos.roomName + ' ' + deposit.Type + ' ' + deposit.pos + ' ' + deposit.FreeSpaces + ' ' + COLOR_ORANGE + ' ' + COLOR_CYAN + ' result ' + result);
                            }
                        }
                    } else if (Memory.MemRooms[gameRoomKey].DepositFlag && Memory.MemRooms[gameRoomKey].DepositFlag.LastCooldown > 70) {
                        DeleteFlag(Memory.MemRooms[gameRoomKey].DepositFlag.FlagName);
                    } else if (Memory.MemRooms[gameRoomKey].DepositFlag && Memory.MemRooms[gameRoomKey].DepositFlag.pos.roomName === roomKey) { // if room is the same then update deposit
                        Memory.MemRooms[gameRoomKey].DepositFlag = LookForDeposit(roomKey, observer);
                    }else{
                        const leftoverFlag = Game.rooms[roomKey].find(FIND_FLAGS)[0];
                        if(leftoverFlag && leftoverFlag.color === COLOR_ORANGE && leftoverFlag.secondaryColor === COLOR_CYAN
                            && leftoverFlag.name !== Memory.MemRooms[gameRoomKey].DepositFlag.FlagName){
                            Util.ErrorLog('Observers', 'ScanPowerBanksAndDeposits', 'remove leftoverFlag ' + leftoverFlag.name);
                            leftoverFlag.remove();
                        }
                    }

                    numOfScansLeft++;
                    delete Memory.MemRooms[gameRoomKey].MapScan[roomKey];
                }
            }
            if (numOfScansLeft === 0) {
                Memory.MemRooms[gameRoomKey].MapReScan = true;
            }
        }

        function DeleteFlag(flagName) { // remove the flag and remove the flag in memory
            const flagToRemove = Game.flags[flagName];
            if (flagName.startsWith('powerBank')) {
                Util.Info('Observers', 'DeleteFlag', 'removed PowerBankFlag memory in ' + gameRoomKey + ' ' + JSON.stringify(Memory.MemRooms[gameRoomKey].PowerBankFlag));
                Memory.MemRooms[gameRoomKey].PowerBankFlag = undefined;
            } else if (flagName.startsWith('deposit')) {
                Util.Info('Observers', 'DeleteFlag', 'removed DepositFlag memory in ' + gameRoomKey + ' ' + JSON.stringify(Memory.MemRooms[gameRoomKey].DepositFlag));
                Memory.MemRooms[gameRoomKey].DepositFlag = undefined;
            }
            if (flagToRemove) {
                Util.InfoLog('Observers', 'DeleteFlag', flagName);
                flagToRemove.remove();
            } else {
                Util.Info('Observers', 'DeleteFlag', 'could not delete flag ' + flagName + ' it does not exist'); // maybe JobTransportPowerBank have removed it
            }
        }

        function LookForDeposit(roomKey, observer) { // room need to be visible!
            if (Game.rooms[roomKey]) {
                const deposit = Game.rooms[roomKey].find(FIND_DEPOSITS, {
                    filter: function (deposit) {
                        return deposit.lastCooldown < 70;
                    }
                })[0];
                if (deposit) {
                    const freeSpaces = Util.FreeSpaces(deposit.pos);
                    const depositScan = {
                        'Type': 'deposit',
                        'Id': deposit.id,
                        'pos': deposit.pos,
                        'Deadline': deposit.ticksToDecay + Game.time,
                        'DepositType': deposit.depositType,
                        'LastCooldown': deposit.lastCooldown,
                        'FreeSpaces': freeSpaces,
                        'ObserverId': observer.id,
                        'FlagName' : CreateFlagName('deposit', roomKey, freeSpaces)
                    };
                    return depositScan;
                }
            }
        }

        function LookForPowerBank(roomKey, observer) { // room need to be visible!
            if (Game.rooms[roomKey]) {
                const powerBank = Game.rooms[roomKey].find(FIND_STRUCTURES, {
                    filter: function (powerBank) {
                        return powerBank.structureType === STRUCTURE_POWER_BANK && powerBank.ticksToDecay > 0;
                    }
                })[0];
                if (powerBank) {
                    const freeSpaces = Util.FreeSpaces(powerBank.pos);
                    const powerBankScan = {
                        'Type': 'powerBank',
                        'Id': powerBank.id,
                        'pos': powerBank.pos,
                        'Deadline': powerBank.ticksToDecay + Game.time,
                        'FreeSpaces': freeSpaces,
                        'ObserverId': observer.id,
                        'FlagName' : CreateFlagName('powerBank', roomKey, freeSpaces)
                    };
                    return powerBankScan;
                }
            }
        }

        /**@return {string}*/
        function CreateFlagName(flagType, roomKey, freeSpaces){
            return flagType + '_' + roomKey + '-' + freeSpaces;
        }
    }
};
module.exports = Observers;