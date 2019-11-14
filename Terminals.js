const Terminals = {
    run: function () {
        const TARGET_ENERGY = 30000;
        const TARGET_RESOURCE = 2000;
        const MAX_ENERGY = 90000;
        const MAX_RESOURCE = 4000;
        const terminals = LoadMyTerminals();
        for (const terminalKey in terminals) {
            const terminal = terminals[terminalKey];
            if (terminal.cooldown === 0) {
                let terminalSendCount = 0;
                terminalSendCount = DistributeResources(terminal, terminals, terminalSendCount);
                terminalSendCount = SellExcessResource(terminal, terminals, terminalSendCount);
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
                    target = TARGET_ENERGY;
                } else {
                    target = TARGET_RESOURCE;
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
                            console.log('Terminals DistributeResources result ' + result + ' resource ' + resourceType + ' sendAmount ' + sendAmount + ' from ' + fromTerminal.pos.roomName + ' to ' + toTerminal.pos.roomName + ' terminalSendCount ' + terminalSendCount + ' resourcesNeeded ' + resourcesNeeded);
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
        function SellExcessResource(fromTerminal, terminals, terminalSendCount) {
            for (const resourceType in fromTerminal.store) { // for each resource type
                let fromAmount = fromTerminal.store[resourceType];
                let max;
                if (resourceType === RESOURCE_ENERGY) {
                    max = MAX_ENERGY;
                } else {
                    max = MAX_RESOURCE;
                }
                if (terminalSendCount < 10 && fromAmount > max) { // is allowed to sell this resource
                    const resourceHistory = Game.market.getHistory(resourceType);
                    const orders = Game.market.getAllOrders(order => order.resourceType === resourceType
                        && order.type === ORDER_BUY
                        && Game.market.calcTransactionCost(500, fromTerminal.pos.roomName, order.roomName) <= 500
                        && resourceHistory[0].avgPrice <= order.price
                        && order.remainingAmount > 0
                    );
                    for (const orderKey in orders) {
                        const order = orders[orderKey];
                        let sendAmount = fromAmount - max; // possible send amount
                        if (sendAmount > order.remainingAmount) {
                            sendAmount = order.remainingAmount; // does not need more resources than this
                        }
                        const result = Game.market.deal(order.id, sendAmount, fromTerminal.pos.roomName);
                        console.log('Terminals SellExcessResource result ' + result + ' resource ' + resourceType + ' sendAmount ' + sendAmount + ' from ' + fromTerminal.pos.roomName + ' to ' + order.roomName + ' terminalSendCount ' + terminalSendCount + ' order.remainingAmount ' + order.remainingAmount + ' price ' + order.price + ' total price ' + order.price * sendAmount + ' fromAmount ' + fromAmount);
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
    }
};
module.exports = Terminals;