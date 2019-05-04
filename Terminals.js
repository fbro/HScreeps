const Terminals = {
    run: function(room) {
        // TODO

        // try to sell stuff
        const orders = [];
        for (const resourceType in room.terminal.store) {
            if (resourceType !== RESOURCE_ENERGY && room.terminal.store[resourceType] >= 1000) {
                orders.push(...Game.market.getAllOrders(order => order.resourceType === resourceType && order.type === ORDER_SELL &&
                    Game.market.calcTransactionCost(1000, room.room.name, order.roomName) < 500));
            }
        }
        for(const orderCount in orders){
            const order = orders[orderCount];
            if(order.price > 0.08){
                room.terminal
            }
        }
    }
};
module.exports = Terminals;