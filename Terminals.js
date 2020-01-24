let Util = require('Util');
const Terminals = {
    run: function () {
        const terminals = LoadMyTerminals();
        for (const terminalKey in terminals) {
            const terminal = terminals[terminalKey];
            if (terminal.cooldown === 0) {
                let terminalSendCount = 0;
                terminalSendCount = DistributeResources(terminal, terminals, terminalSendCount);
                terminalSendCount = SellExcessResource(terminal, terminalSendCount);
                terminalSendCount = BuyBasicResources(terminal, terminalSendCount);
            }
        }

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

        // distribute ALL available resources to all terminals 2k each and only to 5k - except with energy 50k each and only to 100k
        /**@return {number}*/
        function DistributeResources(fromTerminal, terminals, terminalSendCount) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store[resourceType];
                let target;
                if (resourceType === RESOURCE_ENERGY) {
                    target = Util.TERMINAL_TARGET_ENERGY;
                } else {
                    target = Util.TERMINAL_TARGET_RESOURCE;
                }
                for (const toTerminalKey in terminals) {
                    if (terminalSendCount < 10 && fromAmount > target) { // is allowed to send this resource to another terminal
                        const toTerminal = terminals[toTerminalKey];
                        const toAmount = toTerminal.store[resourceType];
                        let shouldSend = false;
                        if (toAmount < target && toTerminal.id !== fromTerminal.id) {
                            shouldSend = true;
                        }
                        if (shouldSend) {
                            let sendAmount = fromAmount - target; // possible send amount
                            const resourcesNeeded = (toAmount - target) * -1;
                            if (sendAmount > resourcesNeeded) {
                                sendAmount = resourcesNeeded; // does not need more resources than this
                            }
                            let result = fromTerminal.send(resourceType, sendAmount, toTerminal.pos.roomName);
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

        /**@return {number}*/
        function SellExcessResource(fromTerminal, terminalSendCount) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store[resourceType];
                let max;
                if (resourceType === RESOURCE_ENERGY) {
                    max = Util.TERMINAL_MAX_ENERGY;
                } else if(resourceType === RESOURCE_PHLEGM){
                    max = 0;
                }  else if(resourceType === RESOURCE_POWER){ // will never sell out on power
                    max = Number.MAX_SAFE_INTEGER;
                } else {
                    max = Util.TERMINAL_MAX_RESOURCE;
                }
                if (terminalSendCount < 10 && fromAmount > max) { // is allowed to sell this resource
                    const resourceHistory = Game.market.getHistory(resourceType);
                    const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                        && order.type === ORDER_BUY
                        /*&& Game.market.calcTransactionCost(500, fromTerminal.pos.roomName, order.roomName) <= 500*/
                        && (resourceHistory[0].avgPrice <= order.price || resourceType === RESOURCE_ENERGY && fromTerminal.room.storage && fromTerminal.room.storage[RESOURCE_ENERGY] > 800000)
                        && order.remainingAmount > 0
                    );
                    if(orders.length > 0){
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
        function BuyBasicResources(terminal, terminalSendCount){
            const basicResourceList = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_KEANIUM, RESOURCE_LEMERGIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
            for(const basicResourceKey in basicResourceList){
                const basicResource = basicResourceList[basicResourceKey];
                const usedCapacity = terminal.store.getUsedCapacity(basicResource);
                if (usedCapacity  < 500 && terminalSendCount < 10) {
                    terminalSendCount = BuyResource(terminal, basicResource, 500 - usedCapacity, terminalSendCount);
                }
            }
            // buy power - logic here is a bit more custom
            const usedPowerCapacity = terminal.store.getUsedCapacity(RESOURCE_POWER);
            if(usedPowerCapacity === 0 && terminalSendCount < 10){
                terminalSendCount = BuyResource(terminal, RESOURCE_POWER, 1000 - usedPowerCapacity, terminalSendCount, 1, 1);
            }
            return terminalSendCount;
        }

        /**@return {number}*/
        function BuyResource(terminal, resourceType, amount, terminalSendCount,
                             avgPrice = 1.5, // set if one wants a another acceptable average price
                             maxPrice = undefined // set if one should use a fixed price to buy under
        ){
            const resourceHistory = Game.market.getHistory(resourceType);
            const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                && order.type === ORDER_SELL
                && Game.market.calcTransactionCost(500, terminal.pos.roomName, order.roomName) <= 500
                && ((resourceHistory[0].avgPrice * avgPrice) >= order.price || maxPrice && maxPrice >= order.price)
                && order.remainingAmount > 0
            );
            if(orders.length > 0){
                orders.sort(comparePriceCheapestFirst);
                Util.Info('Terminals', 'BuyResource', 'WTB ' + amount + ' ' + resourceType + ' from ' + terminal + ' ' + JSON.stringify(orders) + ' avg price ' + resourceHistory[0].avgPrice);
            }
            let amountBought = 0;
            for (const orderKey in orders) {
                const order = orders[orderKey];
                const amountToBuy = amount - amountBought;
                const result = Game.market.deal(order.id, amountToBuy, terminal.pos.roomName);
                Util.InfoLog('Terminals', 'BuyResource', amountToBuy + ' ' + resourceType + ' from ' + terminal.pos.roomName + ' to ' + order.roomName + ' result ' + result + ' terminalSendCount ' + terminalSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + (order.price * amountToBuy));
                terminalSendCount++;
                if(result === OK){
                    amountBought = amountToBuy + amountBought;
                }
                if (terminalSendCount >= 10 || amount <= amountBought) {
                    break;
                }
            }
            return terminalSendCount;
        }

        function comparePriceCheapestFirst(a, b) {
            if (a.price < b.price) { return -1; }
            if (a.price > b.price) { return 1; }
            return 0;
        }

        function comparePriceExpensiveFirst(a, b) {
            if (a.price > b.price) { return -1; }
            if (a.price < b.price) { return 1; }
            return 0;
        }
    }
};
module.exports = Terminals;