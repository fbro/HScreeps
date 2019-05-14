const CreateFlagJobs = {
    run: function(room) {
        // TODO
        if (Memory.flagJobs === undefined) {
            Memory.flagJobs = [];
        }
        for (const flagName in Game.flags) {
            const flag = Game.creeps[flagName];
            let jobName;
            if(flag.color === COLOR_ORANGE && flag.secondaryColor === COLOR_ORANGE){ // scout tag
                jobName = "tagController";
            }
            if(jobName){
                Memory.flagJobs.push({'jobName': jobName, 'flagName': flagName, 'pos': flag.pos});
            }
        }

    }
};
module.exports = CreateFlagJobs;