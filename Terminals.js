let Util = require('Util');
const Terminals = {
    run: function () {
        const terminals = LoadMyTerminals();
        TerminalActions(terminals);

        function LoadMyTerminals() {
            let terminals = [];
            for (const gameRoomKey in Game.rooms) {
                const gameRoom = Game.rooms[gameRoomKey];
                if (gameRoom.terminal && gameRoom.terminal.my) {
                    terminals.push(gameRoom.terminal);
                }
            }
            return terminals;
        }

        function TerminalActions(terminals) {
            let marketDealSendCount = 0;
            for (const terminalKey in terminals) {
                const terminal = terminals[terminalKey];
                if (terminal.cooldown === 0) {
                    if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= Util.STORAGE_ENERGY_LOW) {
                        DistributeResources(terminal, terminals);
                        marketDealSendCount = SellExcessResource(terminal, marketDealSendCount);
                        marketDealSendCount = BuyResources(terminal, marketDealSendCount);
                        marketDealSendCount = BuyLabResources(terminal, marketDealSendCount);
                    }
                }
            }
        }

        // distribute ALL available resources to all terminals
        function DistributeResources(fromTerminal, terminals) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store[resourceType];
                let target;
                if (resourceType === RESOURCE_FIXTURES || resourceType === RESOURCE_TUBE) {
                    DistributeFactoryCommodities(fromTerminal, resourceType, fromAmount, 3); // only send to factories that are of lvl 3
                } else if (resourceType === RESOURCE_SWITCH || resourceType === RESOURCE_PHLEGM || resourceType === RESOURCE_COMPOSITE || resourceType === RESOURCE_CONCENTRATE) { // SWITCH, PHLEGM, COMPOSITE or CONCENTRATE should only be sent to a terminal that has a factory of level 2
                    DistributeFactoryCommodities(fromTerminal, resourceType, fromAmount, 2); // only send to factories that are of lvl 2
                } else if (resourceType === RESOURCE_SILICON || resourceType === RESOURCE_BIOMASS || resourceType === RESOURCE_METAL || resourceType === RESOURCE_MIST) { // SILICON, BIOMASS, METAL or MIST should only be sent to a terminal that has a factory that uses SILICON, BIOMASS, METAL or MIST
                    DistributeFactoryCommodities(fromTerminal, resourceType, fromAmount); // send to any level factory
                } else {
                    if (resourceType === RESOURCE_ENERGY) {
                        target = Util.TERMINAL_TARGET_ENERGY;
                    } else {
                        target = Util.TERMINAL_TARGET_RESOURCE;
                    }
                    for (const toTerminalKey in terminals) {
                        const toTerminal = terminals[toTerminalKey];
                        const toAmount = toTerminal.store[resourceType];
                        if (fromAmount > (target + 500/*buffer to prevent many small send*/)
                            && toAmount < target
                            && toTerminal.id !== fromTerminal.id
                        ) { // is allowed to send this resource to another terminal
                            let sendAmount = fromAmount - target; // possible send amount
                            const resourcesNeeded = target - toAmount;
                            if (sendAmount > resourcesNeeded) {
                                sendAmount = resourcesNeeded; // does not need more resources than this
                            }
                            const result = fromTerminal.send(resourceType, sendAmount, toTerminal.pos.roomName);
                            Util.Info('Terminals', 'DistributeResources', sendAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result + ' resourcesNeeded ' + resourcesNeeded);
                            toTerminal.store[resourceType] += sendAmount;
                            fromTerminal.store[resourceType] -= sendAmount;
                            fromAmount -= sendAmount;
                            break;
                        }
                    }
                }
            }
        }

        // factory commodities are not distributed like the other resources should be
        /**@return {number}*/
        function DistributeFactoryCommodities(fromTerminal, resourceType, fromAmount, sendToFactoryLevel = 0) {
            const fromFactory = fromTerminal.room.find(FIND_MY_STRUCTURES, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_FACTORY && (sendToFactoryLevel === s.level || sendToFactoryLevel === 0);
                }
            })[0];
            if (!fromFactory || fromTerminal.room.storage.store.getUsedCapacity(resourceType) > Util.STORAGE_HIGH) { // only send the resource if the factory lvl in sender room is not the same as sendToFactoryLevel unless there is a surplus
                for (const toTerminalKey in terminals) {
                    const toTerminal = terminals[toTerminalKey];
                    if (toTerminal.id !== fromTerminal.id
                        && toTerminal.store.getUsedCapacity(resourceType) < Util.TERMINAL_TARGET_RESOURCE // do not transfer anymore commodities if toTerminal already has more than STORAGE_HIGH_TRANSFER
                        && toTerminal.room.find(FIND_MY_STRUCTURES, {
                            filter: function (s) {
                                return s.structureType === STRUCTURE_FACTORY && (sendToFactoryLevel === s.level || sendToFactoryLevel === 0);
                            }
                        })[0]) {
                        const result = fromTerminal.send(resourceType, fromAmount, toTerminal.pos.roomName);
                        Util.Info('Terminals', 'DistributeResources', fromAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result);
                        break;
                    }
                }
            }
        }

        /**@return {number}*/
        function SellExcessResource(fromTerminal, marketDealSendCount) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store.getUsedCapacity(resourceType);
                let max;
                let lowestSellingValue = 0.1; // if the mineral has a lower selling value than this then it is not worth the computational value to mine and sell
                if (resourceType === RESOURCE_ENERGY) {
                    max = Util.TERMINAL_MAX_ENERGY;
                } else if (resourceType === RESOURCE_TISSUE || resourceType === RESOURCE_FRAME) {
                    max = 0; // right now i am selling out on tissue and frame
                } else if (resourceType === RESOURCE_POWER
                    || resourceType     === RESOURCE_SILICON // deposit
                    || resourceType     === RESOURCE_WIRE // factory lvl 0
                    || resourceType     === RESOURCE_SWITCH // factory lvl 1

                    || resourceType     === RESOURCE_BIOMASS // deposit
                    || resourceType     === RESOURCE_CELL // factory lvl 0
                    || resourceType     === RESOURCE_PHLEGM // factory lvl 1

                    || resourceType     === RESOURCE_METAL // deposit
                    || resourceType     === RESOURCE_ALLOY // factory lvl 0
                    || resourceType     === RESOURCE_TUBE // factory lvl 1
                    || resourceType     === RESOURCE_FIXTURES // factory lvl 2

                    || resourceType     === RESOURCE_MIST // deposit
                    || resourceType     === RESOURCE_CONDENSATE // factory lvl 0
                    || resourceType     === RESOURCE_CONCENTRATE // factory lvl 1

                    || resourceType     === RESOURCE_COMPOSITE // factory lvl 1
                    || resourceType     === RESOURCE_CRYSTAL // factory lvl 2
                    || resourceType     === RESOURCE_LIQUID // factory lvl 3
                ) { // will never sell out on these resources
                    max = Number.MAX_SAFE_INTEGER;
                } else {
                    max = Util.TERMINAL_MAX_RESOURCE;
                }
                if (marketDealSendCount <= 10 && fromAmount > max) { // is allowed to sell this resource
                    const resourceHistory = Game.market.getHistory(resourceType);
                    const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                        && order.type === ORDER_BUY
                        /*&& Game.market.calcTransactionCost(500, fromTerminal.pos.roomName, order.roomName) <= 500*/
                        &&
                        (
                            (!resourceHistory[0]
                                || IsOutdated(resourceHistory[resourceHistory.length - 1].date)
                                || (resourceHistory[resourceHistory.length - 1].avgPrice / 1.5/*medium price fall is okay*/) <= order.price
                            ) && lowestSellingValue <= order.price
                            ||
                            resourceType === RESOURCE_ENERGY
                            && fromTerminal.room.storage
                            && fromTerminal.room.storage.store[RESOURCE_ENERGY] > Util.STORAGE_ENERGY_HIGH // hard sellout because storage is full with energy
                        )
                        && order.remainingAmount > 0
                    );
                    if (orders.length > 0) {
                        orders.sort(comparePriceExpensiveFirst);
                        const order = orders[0];
                        let sendAmount = fromAmount - max; // possible send amount
                        if (sendAmount > order.remainingAmount) {
                            sendAmount = order.remainingAmount; // does not need more resources than this
                        }
                        const result = Game.market.deal(order.id, sendAmount, fromTerminal.pos.roomName);
                        if (result === OK) {
                            marketDealSendCount++;
                        }
                        if (resourceType === RESOURCE_TISSUE || resourceType === RESOURCE_FRAME) {
                            Util.InfoLog('Terminals', 'SellExcessResource', sendAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' marketDealSendCount ' + marketDealSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + order.price * sendAmount + ' fromAmount ' + fromAmount);
                        } else {
                            Util.Info('Terminals', 'SellExcessResource', sendAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' marketDealSendCount ' + marketDealSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + order.price * sendAmount + ' fromAmount ' + fromAmount);
                        }
                    }
                }
            }
            return marketDealSendCount;
        }

        /**@return {boolean}*/
        function IsOutdated(date1, date2 = Date.now(), millisecondsToWait = 86400000/*24h*/) {
            const elapsed = date2 - Date.parse(date1); // date1 format: "2019-06-24"
            if (elapsed > millisecondsToWait) {
                //Util.Info('Terminals', 'IsOutdated', 'date ' + date1 + ' elapsed ' + elapsed + ' parsed date ' + Date.parse(date1) + ' now ' + date2);
                return true;
            }
            return false;
        }

        /**@return {number}*/
        function BuyResources(terminal, marketDealSendCount) {
            // buy resources to make sure that there are at least 500 Hydrogen, Oxygen, Utrium, Keanium, Lemergium, Zynthium and Catalyst in each terminal
            const basicResourceList = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_KEANIUM, RESOURCE_LEMERGIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
            for (const basicResourceKey in basicResourceList) {
                const basicResource = basicResourceList[basicResourceKey];
                const usedCapacity = terminal.store.getUsedCapacity(basicResource);
                if (usedCapacity === 0 && marketDealSendCount <= 10 && terminal.room.storage.store.getUsedCapacity(basicResource) === 0) {
                    marketDealSendCount = BuyResource(terminal, basicResource, 500, marketDealSendCount);
                }
            }
            // buy power
            const usedPowerCapacity = terminal.store.getUsedCapacity(RESOURCE_POWER);
            if (usedPowerCapacity === 0 && marketDealSendCount <= 10 && terminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.STORAGE_ENERGY_LOW_TRANSFER) {
                marketDealSendCount = BuyResource(terminal, RESOURCE_POWER, 1000, marketDealSendCount, 1, 2);
            }
            return marketDealSendCount;
        }

        function BuyLabResources(terminal, marketDealSendCount) {
            // find FillLabMineralJobs flags
            const labFlags = terminal.room.find(FIND_FLAGS, {
                filter: function (flag) {
                    return flag.color === COLOR_PURPLE && flag.secondaryColor === COLOR_PURPLE && flag.name.split('-') === 'BUY'
                }
            });
            for (const labFlagKey in labFlags) {
                const labFlag = labFlags[labFlagKey];
                const mineral = labFlag.name.split(/[-]+/).filter(function (e) {
                    return e;
                })[1];
                const usedMineralCapacity = terminal.store.getUsedCapacity(mineral);
                if (usedMineralCapacity < 500 && marketDealSendCount <= 10 && terminal.room.storage.store.getUsedCapacity(mineral) === 0) {
                    marketDealSendCount = BuyResource(terminal, mineral, 500 - usedMineralCapacity, marketDealSendCount, 2, 2);
                }
            }
            return marketDealSendCount;
        }

        /**@return {number}*/
        function BuyResource(terminal, resourceType, amount, marketDealSendCount,
                             avgPrice = 1.5, // set if one wants a another acceptable average price
                             maxPrice = undefined // set if one should use a fixed price to buy under
        ) {
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                && order.type === ORDER_SELL
                && Game.market.calcTransactionCost(500, terminal.pos.roomName, order.roomName) <= 500
                && (!resourceHistory[0] || (resourceHistory[0].avgPrice * avgPrice) >= order.price && (maxPrice && maxPrice >= order.price || !maxPrice))
                && order.remainingAmount > 0
            );
            if (orders.length > 0) {
                orders.sort(comparePriceCheapestFirst);
                Util.Info('Terminals', 'BuyResource', 'WTB ' + amount + ' ' + resourceType + ' from ' + terminal + ' ' + JSON.stringify(orders) + ' avg price ' + resourceHistory[0].avgPrice);
                const order = orders[0];
                if (order.remainingAmount < amount) {
                    amount = order.remainingAmount;
                }
                const result = Game.market.deal(order.id, amount, terminal.pos.roomName);
                if (result === OK) {
                    marketDealSendCount++;
                }
                Util.InfoLog('Terminals', 'BuyResource', amount + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' marketDealSendCount ' + marketDealSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + (order.price * amount));
            }
            return marketDealSendCount;
        }

        function comparePriceCheapestFirst(a, b) {
            if (a.price < b.price) {
                return -1;
            }
            if (a.price > b.price) {
                return 1;
            }
            return 0;
        }

        function comparePriceExpensiveFirst(a, b) {
            if (a.price > b.price) {
                return -1;
            }
            if (a.price < b.price) {
                return 1;
            }
            return 0;
        }
    }
};
module.exports = Terminals;