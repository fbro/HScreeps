# HScreeps
My code for the game Screeps, it is OS based with "jobs" in Game.memory

main loop:

**create jobs** - creates jobs that are placed in Game.memory.MemRooms

**assign jobs** - assign the jobs in each room, flag jobs may be occupied by creeps that originate from other rooms

**execute jobs** - do the actual action and keep doing the job until return code != 0