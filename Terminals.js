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

        function TerminalActions(terminals){
            for (const terminalKey in terminals) {
                const terminal = terminals[terminalKey];
                if (terminal.cooldown === 0) {
                    let terminalSendCount = 0;
                    if(terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= 10000){
                        terminalSendCount = DistributeResources(terminal, terminals, terminalSendCount);
                        terminalSendCount = SellExcessResource(terminal, terminalSendCount);
                        terminalSendCount = BuyBasicResources(terminal, terminalSendCount);
                    }
                }
            }
        }

        // distribute ALL available resources to all terminals 2k each and only to 5k - except with energy 50k each and only to 100k
        /**@return {number}*/
        function DistributeResources(fromTerminal, terminals, terminalSendCount) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store[resourceType];
                let target;
                if(resourceType === RESOURCE_SWITCH || resourceType === RESOURCE_PHLEGM || resourceType === RESOURCE_TUBE || resourceType === RESOURCE_CONCENTRATE) { // SWITCH, PHLEGM, TUBE or CONCENTRATE should only be sent to a terminal that has a factory of level 2
                    terminalSendCount = DistributeFactoryCommodities(terminalSendCount, fromTerminal, resourceType, fromAmount, 2);
                } else if(resourceType === RESOURCE_SILICON || resourceType === RESOURCE_BIOMASS || resourceType === RESOURCE_METAL || resourceType === RESOURCE_MIST) { // SILICON, BIOMASS, METAL or MIST should only be sent to a terminal that has a factory that uses SILICON, BIOMASS, METAL or MIST
                    terminalSendCount = DistributeFactoryCommodities(terminalSendCount, fromTerminal, resourceType, fromAmount);
                } else{
                    if (resourceType === RESOURCE_ENERGY) {
                        target = Util.TERMINAL_TARGET_ENERGY;
                    } else {
                        target = Util.TERMINAL_TARGET_RESOURCE;
                    }
                    for (const toTerminalKey in terminals) {
                        const toTerminal = terminals[toTerminalKey];
                        const toAmount = toTerminal.store[resourceType];
                        if (terminalSendCount < 10
                            && fromAmount > (target + 500/*buffer to prevent many small send*/)
                            && toAmount < target
                            && toTerminal.id !== fromTerminal.id
                        ) { // is allowed to send this resource to another terminal
                            let sendAmount = fromAmount - target; // possible send amount
                            const resourcesNeeded = (toAmount - target) * -1;
                            if (sendAmount > resourcesNeeded) {
                                sendAmount = resourcesNeeded; // does not need more resources than this
                            }
                            const result = fromTerminal.send(resourceType, sendAmount, toTerminal.pos.roomName);
                            Util.Info('Terminals', 'DistributeResources', sendAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result + ' terminalSendCount ' + terminalSendCount + ' resourcesNeeded ' + resourcesNeeded);
                            toTerminal.store[resourceType] += sendAmount;
                            fromTerminal.store[resourceType] -= sendAmount;
                            fromAmount -= sendAmount;
                            terminalSendCount++;
                        }
                    }
                }
            }
            return terminalSendCount;
        }

        // factory commodities are not destributed like the other resources should be
        /**@return {number}*/
        function DistributeFactoryCommodities(terminalSendCount, fromTerminal, resourceType, fromAmount, factoryLevel = 0) {
            const fromFactory = fromTerminal.room.find(FIND_MY_STRUCTURES, {
                filter: function (s) {
                    return s.structureType === STRUCTURE_FACTORY && (factoryLevel === s.level || factoryLevel === 0);
                }
            })[0];
            if(terminalSendCount < 10 && !fromFactory) {
                for (const toTerminalKey in terminals) {
                    const toTerminal = terminals[toTerminalKey];
                    if (toTerminal.id !== fromTerminal.id
                        && toTerminal.store.getUsedCapacity(resourceType) < Util.TERMINAL_STORAGE_LOW_TRANSFER // do not transfer anymore commodities if toTerminal already has more than TERMINAL_STORAGE_HIGH_TRANSFER
                        && toTerminal.room.find(FIND_MY_STRUCTURES, {
                        filter: function (s) {
                            return s.structureType === STRUCTURE_FACTORY && (factoryLevel === s.level || factoryLevel === 0);
                        }
                    })[0]) {
                        const result = fromTerminal.send(resourceType, fromAmount, toTerminal.pos.roomName);
                        Util.Info('Terminals', 'DistributeResources', fromAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' result ' + result + ' terminalSendCount ' + terminalSendCount);
                        terminalSendCount++;
                        break;
                    }
                }
            }
            return terminalSendCount;
        }

        /**@return {number}*/
        function SellExcessResource(fromTerminal, terminalSendCount) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store.getUsedCapacity(resourceType);
                let max;
                if (resourceType === RESOURCE_ENERGY) {
                    max = Util.TERMINAL_MAX_ENERGY;
                } else if(resourceType === RESOURCE_TISSUE){
                    max = 0; // right now i am selling out on tissue
                } else if (resourceType === RESOURCE_POWER
                    || resourceType === RESOURCE_SILICON // deposit
                    || resourceType === RESOURCE_WIRE // factory lvl 0
                    || resourceType === RESOURCE_SWITCH // factory lvl 1

                    || resourceType === RESOURCE_BIOMASS // deposit
                    || resourceType === RESOURCE_CELL // factory lvl 0
                    || resourceType === RESOURCE_PHLEGM // factory lvl 1

                    || resourceType === RESOURCE_METAL // deposit
                    || resourceType === RESOURCE_ALLOY // factory lvl 0
                    || resourceType === RESOURCE_TUBE // factory lvl 1

                    || resourceType === RESOURCE_MIST // deposit
                    || resourceType === RESOURCE_CONDENSATE // factory lvl 0
                    || resourceType === RESOURCE_CONCENTRATE // factory lvl 1
                ) { // will never sell out on these resources
                    max = Number.MAX_SAFE_INTEGER;
                } else {
                    max = Util.TERMINAL_MAX_RESOURCE;
                }
                if (terminalSendCount < 10 && fromAmount > max) { // is allowed to sell this resource
                    const resourceHistory = Game.market.getHistory(resourceType);
                    const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                        && order.type === ORDER_BUY
                        /*&& Game.market.calcTransactionCost(500, fromTerminal.pos.roomName, order.roomName) <= 500*/
                        && (!resourceHistory[0] || resourceHistory[0].avgPrice <= order.price || resourceType === RESOURCE_ENERGY && fromTerminal.room.storage && fromTerminal.room.storage[RESOURCE_ENERGY] > 800000)
                        && order.remainingAmount > 0
                    );
                    if (orders.length > 0) {
                        orders.sort(comparePriceExpensiveFirst);
                    }
                    for (const orderKey in orders) {
                        const order = orders[orderKey];
                        let sendAmount = fromAmount - max; // possible send amount
                        if (sendAmount > order.remainingAmount) {
                            sendAmount = order.remainingAmount; // does not need more resources than this
                        }
                        const result = Game.market.deal(order.id, sendAmount, fromTerminal.pos.roomName);
                        Util.Info('Terminals', 'SellExcessResource', sendAmount + ' ' + resourceType + ' from ' + fromTerminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' terminalSendCount ' + terminalSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + order.price * sendAmount + ' fromAmount ' + fromAmount);
                        // the terminals may try and sell to the same order - I will ignore this error
                        fromTerminal.store[resourceType] -= sendAmount;
                        fromAmount -= sendAmount;
                        terminalSendCount++;
                        if (terminalSendCount >= 10 || fromAmount <= max) {
                            break;
                        }
                    }
                }
            }
            return terminalSendCount;
        }

        // buy resources to make sure that there are at least 500 Hydrogen, Oxygen, Utrium, Keanium, Lemergium, Zynthium and Catalyst in each terminal
        /**@return {number}*/
        function BuyBasicResources(terminal, terminalSendCount) {
            const basicResourceList = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_KEANIUM, RESOURCE_LEMERGIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
            for (const basicResourceKey in basicResourceList) {
                const basicResource = basicResourceList[basicResourceKey];
                const usedCapacity = terminal.store.getUsedCapacity(basicResource);
                if (usedCapacity === 0 && terminalSendCount < 10 && terminal.room.storage.store.getUsedCapacity(basicResource) === 0) {
                    terminalSendCount = BuyResource(terminal, basicResource, 500, terminalSendCount);
                }
            }
            // buy power - logic here is a bit more custom
            const usedPowerCapacity = terminal.store.getUsedCapacity(RESOURCE_POWER);
            if (usedPowerCapacity === 0 && terminalSendCount < 10 && terminal.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > Util.TERMINAL_STORAGE_ENERGY_LOW_TRANSFER) {
                terminalSendCount = BuyResource(terminal, RESOURCE_POWER, 1000, terminalSendCount, 1, 1);
            }
            return terminalSendCount;
        }

        /**@return {number}*/
        function BuyResource(terminal, resourceType, amount, terminalSendCount,
                             avgPrice = 1.5, // set if one wants a another acceptable average price
                             maxPrice = undefined // set if one should use a fixed price to buy under
        ) {
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                && order.type === ORDER_SELL
                && Game.market.calcTransactionCost(500, terminal.pos.roomName, order.roomName) <= 500
                && ((resourceHistory[0].avgPrice * avgPrice) >= order.price || maxPrice && maxPrice >= order.price)
                && order.remainingAmount > 0
            );
            if (orders.length > 0) {
                orders.sort(comparePriceCheapestFirst);
                Util.Info('Terminals', 'BuyResource', 'WTB ' + amount + ' ' + resourceType + ' from ' + terminal + ' ' + JSON.stringify(orders) + ' avg price ' + resourceHistory[0].avgPrice);
            }
            let amountBought = 0;
            for (const orderKey in orders) {
                const order = orders[orderKey];
                const amountToBuy = amount - amountBought;
                const result = Game.market.deal(order.id, amountToBuy, terminal.pos.roomName);
                if(result === OK){
                    Util.InfoLog('Terminals', 'BuyResource', amountToBuy + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result OK terminalSendCount ' + terminalSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + (order.price * amountToBuy));
                }else{
                    Util.Warning('Terminals', 'BuyResource', amountToBuy + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' terminalSendCount ' + terminalSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + (order.price * amountToBuy));
                }
                terminalSendCount++;
                if (result === OK) {
                    amountBought = amountToBuy + amountBought;
                }
                if (terminalSendCount >= 10 || amount <= amountBought) {
                    break;
                }
            }
            return terminalSendCount;
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