const CreateFlagJobs = {
    run: function() {
        if (Memory.flagJobs === undefined) {
            Memory.flagJobs = [];
        }
        for (const flagName in Game.flags) {
            const flag = Game.flags[flagName];
            let jobName;
            if(flag.color === COLOR_ORANGE && flag.secondaryColor === COLOR_ORANGE){ // scout tag
                jobName = "TagController";
            }

            if (jobName) { // flag found with appropriate colors
                let foundJob = false;
                for(let i = 0; i < Memory.flagJobs.length; i++) { // check if the flag job already exists
                    if(Memory.flagJobs[i].pos.roomName === flag.pos.roomName && Memory.flagJobs[i].pos.x === flag.pos.x && Memory.flagJobs[i].pos.y === flag.pos.y){
                        foundJob = true;
                        break;
                    }
                }
                if(!foundJob){ // only add once
                    const flagJobOBJ = {'name': jobName, 'flagName': flagName, 'pos': flag.pos, 'creeps': []};
                    Memory.flagJobs.push(flagJobOBJ);
                    Memory.openJobs.push(flagJobOBJ);
                    console.log("CreateFlagJobs, new flag " + jobName + " " + JSON.stringify(flag))
                }
            }
        }
    }
};
module.exports = CreateFlagJobs;