export function memoryCheckpoint(label: string) {
    const mem = process.memoryUsage();

    console.log(
        `[MEMORY] ${label}`,
        JSON.stringify({
            heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(2),
            heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(2),
            rssMB: +(mem.rss / 1024 / 1024).toFixed(2),
            externalMB: +(mem.external / 1024 / 1024).toFixed(2),
        }),
    );
}